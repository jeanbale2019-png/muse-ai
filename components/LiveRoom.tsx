
import React, { useState, useEffect, useRef } from 'react';
import { Modality, LiveServerMessage } from "@google/genai";
import { getAI, encode, decode, decodeAudioData, handleGeminiError, generateTTS, playTTS } from '../services/geminiService';
import { checkPermission } from '../services/subscriptionService';
import { Language, IAMode, UserAccount } from '../types';

interface LiveRoomProps {
  language: Language;
  user: UserAccount;
  onBack: () => void;
}

interface Room {
  id: string;
  name: string;
  participants: number;
  type: 'public' | 'private';
  color: string;
}

const MOCK_ROOMS: Room[] = [
  { id: 'room-1', name: 'Le Sommet des Leaders', participants: 42, type: 'public', color: '#3B82F6' },
  { id: 'room-2', name: 'Cercle de Philo AI', participants: 18, type: 'public', color: '#10b981' },
  { id: 'room-3', name: 'Masterclass Eloquence', participants: 124, type: 'public', color: '#8B93FF' },
];

const LiveRoom: React.FC<LiveRoomProps> = ({ language, user, onBack }) => {
  const [view, setView] = useState<'lobby' | 'session'>('lobby');
  const [iaMode, setIaMode] = useState<IAMode>('coaching');
  const [status, setStatus] = useState('Standby');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const speakWelcome = async () => {
      let message = "";
      const name = user.username || "Orateur";

      if (user.tier === 'premium') {
        message = `Bienvenue dans l'élite, ${name}. Je suis votre Muse Premium. Je viens d'activer le Mode Débat. Prêt à ce que je challenge votre éloquence aujourd'hui ?`;
      } else if (user.tier === 'business') {
        message = `Bonjour. Votre espace Académie est prêt, ${name}. Je suis configurée pour suivre vos objectifs d'organisation. Par quoi commençons-nous ?`;
      } else {
        message = `Bonjour ! Je suis ravie de vous accompagner pour votre session quotidienne. Commençons doucement votre entraînement d'aujourd'hui.`;
      }

      try {
        const base64 = await generateTTS(message, 'Kore');
        if (base64) await playTTS(base64);
      } catch (e) {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = language;
        window.speechSynthesis.speak(utterance);
      }
    };

    speakWelcome();
  }, [user.tier, user.username, language]);

  const selectIaMode = (mode: IAMode) => {
    if (mode === 'debate') {
       const perm = checkPermission(user, 'debate_mode');
       if (!perm.allowed) {
          setPermissionError(perm.message || "Accès restreint.");
          setTimeout(() => setPermissionError(null), 5000);
          return;
       }
    }
    setIaMode(mode);
  };

  const stopSession = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    if (sessionRef.current) {
      sessionRef.current.then((s: any) => s.close());
      sessionRef.current = null;
    }

    if (inputCtxRef.current && inputCtxRef.current.state !== 'closed') {
      inputCtxRef.current.close().catch(() => {});
    }
    inputCtxRef.current = null;

    if (outputCtxRef.current && outputCtxRef.current.state !== 'closed') {
      outputCtxRef.current.close().catch(() => {});
    }
    outputCtxRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setView('lobby');
    setStatus('Standby');
  };

  const startSession = async () => {
    try {
      setView('session');
      setStatus('Connecting...');
      const ai = getAI();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480, frameRate: 15 } 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('Active');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (!isMicOn) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);

            frameIntervalRef.current = window.setInterval(() => {
              if (!isCamOn || !videoRef.current || !canvasRef.current) return;
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                canvasRef.current.toBlob(async (blob) => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      sessionPromise.then(s => s.sendRealtimeInput({ 
                        media: { data: base64, mimeType: 'image/jpeg' } 
                      }));
                    };
                    reader.readAsDataURL(blob);
                  }
                }, 'image/jpeg', 0.6);
              }
            }, 1000); 
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputCtx.state !== 'closed') {
              const buffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
            }
            if (message.serverContent?.outputTranscription) {
              setTranscripts(prev => [...prev.slice(-4), `AI: ${message.serverContent?.outputTranscription?.text}`]);
            }
            if (message.serverContent?.inputTranscription) {
               setTranscripts(prev => [...prev.slice(-4), `Vous: ${message.serverContent?.inputTranscription?.text}`]);
            }
          },
          onerror: (e) => { handleGeminiError(e); stopSession(); },
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are SOCIAL MUSE live facilitator. Observe the video frames and listen to the audio. Mode: ${iaMode}. Respond concisely in ${language}.`,
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err) {
      handleGeminiError(err);
      stopSession();
    }
  };

  return (
    <div className={`fixed inset-0 bg-[#050507] z-[100] flex flex-col animate-in fade-in duration-700 ${view === 'session' ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'}`}>
      
      {view === 'lobby' && (
        <div className="flex-1 flex flex-col items-center p-6 md:p-12 space-y-12">
          <header className="w-full flex justify-between items-center max-w-5xl">
            <div className="flex items-center space-x-4">
              <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
                <i className="fa-solid fa-chevron-left text-zinc-400"></i>
              </button>
              <h1 className="text-2xl font-serif font-black italic">Live <span className="text-indigo-400">Room</span></h1>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">1,204 en ligne</span>
            </div>
          </header>

          <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
             <div className="space-y-6">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 ml-1">Salons publics</h2>
                <div className="space-y-4">
                  {MOCK_ROOMS.map(room => (
                    <button 
                      key={room.id}
                      onClick={startSession}
                      className="w-full p-6 bg-zinc-900/50 border border-white/5 rounded-[2rem] text-left hover:border-indigo-500/30 transition-all group flex items-center justify-between shadow-xl active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-5">
                         <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${room.color}20`, border: `1px solid ${room.color}40` }}>
                            <i className="fa-solid fa-tower-broadcast text-lg" style={{ color: room.color }}></i>
                         </div>
                         <div>
                            <h3 className="text-sm font-bold uppercase tracking-tight">{room.name}</h3>
                            <p className="text-[10px] text-zinc-500">{room.participants} participants • Live IA Coaching</p>
                         </div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-zinc-700 group-hover:text-indigo-400 transition-colors"></i>
                    </button>
                  ))}
                </div>
             </div>

             <div className="space-y-6">
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 ml-1">Créer une session</h2>
                <div className="p-8 bg-[#0c0c0e] border border-white/5 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none"></div>
                   
                   <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                         <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i>
                         <h3 className="text-lg font-serif italic text-white">Espace Privé Augmenté</h3>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">Invitez des amis ou entraînez-vous seul avec l'IA. Choisissez votre mode pour une expérience personnalisée.</p>
                   </div>

                   {permissionError && (
                     <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[10px] font-bold uppercase tracking-widest animate-in shake">
                       {permissionError}
                     </div>
                   )}

                   <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => selectIaMode('coaching')} 
                        className={`py-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${iaMode === 'coaching' ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                      >
                        Mode Coaching
                      </button>
                      <button 
                        onClick={() => selectIaMode('debate')} 
                        className={`py-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${iaMode === 'debate' ? 'bg-[#f43f5e]/10 border-[#f43f5e]/40 text-[#f43f5e]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'} flex items-center justify-center space-x-2 relative`}
                      >
                        <span>Mode Débat</span>
                        {user.tier === 'free' && <i className="fa-solid fa-lock text-[8px]"></i>}
                      </button>
                   </div>

                   <button 
                    onClick={startSession}
                    className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center space-x-3"
                   >
                     <i className="fa-solid fa-plus"></i>
                     <span>Lancer mon salon</span>
                   </button>
                </div>
             </div>
          </main>
        </div>
      )}

      {view === 'session' && (
        <div className="flex-1 flex flex-col md:flex-row h-full">
          <main className="flex-1 flex flex-col relative">
            <header className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
               <div className="flex items-center space-x-4">
                  <button onClick={stopSession} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 text-white">
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400">{iaMode} session</span>
                    <h2 className="text-lg font-serif italic">Mon Studio de Live</h2>
                  </div>
               </div>
               <div className="px-3 py-1 bg-rose-600 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-lg animate-pulse">Live</div>
            </header>

            <div className="flex-1 bg-zinc-900 relative">
               <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover transition-all duration-1000 ${isCamOn ? 'opacity-100' : 'opacity-0'}`} 
               />
               {!isCamOn && (
                 <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                    <div className="w-32 h-32 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
                       <i className="fa-solid fa-user text-4xl text-zinc-800"></i>
                    </div>
                 </div>
               )}
               <canvas ref={canvasRef} width="320" height="240" className="hidden" />

               <div className="absolute bottom-32 left-0 right-0 h-16 pointer-events-none flex items-center justify-center space-x-1 opacity-60">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className={`w-1 rounded-full transition-all duration-300 ${iaMode === 'coaching' ? 'bg-[#10b981]' : 'bg-[#f43f5e]'}`} style={{ height: `${20 + Math.random() * 60}%` }}></div>
                  ))}
               </div>
            </div>

            <footer className="p-8 flex justify-center items-center space-x-6 bg-[#050507]">
               <button onClick={() => setIsMicOn(!isMicOn)} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isMicOn ? 'bg-zinc-900 text-zinc-400' : 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'}`}>
                 <i className={`fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'} text-xl`}></i>
               </button>
               <button onClick={stopSession} className="w-20 h-20 rounded-full bg-[#f43f5e] text-white flex items-center justify-center shadow-2xl rotate-[135deg] active:scale-95 transition-all">
                 <i className="fa-solid fa-phone text-2xl"></i>
               </button>
               <button onClick={() => setIsCamOn(!isCamOn)} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isCamOn ? 'bg-zinc-900 text-zinc-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'}`}>
                 <i className={`fa-solid ${isCamOn ? 'fa-video' : 'fa-video-slash'} text-xl`}></i>
               </button>
            </footer>
          </main>

          <aside className="w-full md:w-80 lg:w-96 bg-[#0c0c0e] border-l border-white/5 flex flex-col p-8 space-y-8 overflow-y-auto no-scrollbar">
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Flux de Pensée IA</h3>
                   <span className="text-[8px] font-black uppercase text-indigo-400">Stable</span>
                </div>
                <div className="space-y-3">
                   {transcripts.map((t, i) => (
                     <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 text-[11px] leading-relaxed italic text-zinc-400 animate-in slide-in-from-bottom-2">
                        {t}
                     </div>
                   ))}
                   {transcripts.length === 0 && (
                     <div className="py-12 flex flex-col items-center justify-center text-center opacity-10">
                        <i className="fa-solid fa-brain text-4xl mb-2"></i>
                        <p className="text-[9px] font-black uppercase tracking-widest">En attente de signal vocal...</p>
                     </div>
                   )}
                </div>
             </div>

             <div className="pt-8 border-t border-white/5 space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Métrique Social Muse</h3>
                <div className="p-6 bg-zinc-900/40 rounded-3xl border border-white/5 space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-zinc-400">Confiance</span>
                      <span className="text-[10px] font-black text-[#10b981]">Élevée</span>
                   </div>
                   <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#10b981]" style={{ width: '85%' }}></div>
                   </div>
                   <p className="text-[9px] text-zinc-500 italic leading-relaxed">"Votre ton est calme et assuré. Continuez à maintenir ce débit."</p>
                </div>
             </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default LiveRoom;
