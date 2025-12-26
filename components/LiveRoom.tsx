
import React, { useState, useEffect, useRef } from 'react';
import { Modality, LiveServerMessage } from "@google/genai";
import { getAI, encode, decode, decodeAudioData, handleGeminiError } from '../services/geminiService';
import { Language, IAMode, UserAccount } from '../types';

interface LiveRoomProps {
  language: Language;
  user: UserAccount;
  onBack: () => void;
}

const LiveRoom: React.FC<LiveRoomProps> = ({ language, user, onBack }) => {
  const [view, setView] = useState<'lobby' | 'session'>('lobby');
  const [iaMode, setIaMode] = useState<IAMode>('coaching');
  const [status, setStatus] = useState('Standby');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const stopSession = () => {
    // 1. Arrêter les timers de capture
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    // 2. Fermer la session Gemini Live
    if (sessionRef.current) {
      sessionRef.current.then((s: any) => s.close());
      sessionRef.current = null;
    }

    // 3. Fermer les contextes audio
    if (inputCtxRef.current && inputCtxRef.current.state !== 'closed') {
      inputCtxRef.current.close().catch(() => {});
    }
    inputCtxRef.current = null;

    if (outputCtxRef.current && outputCtxRef.current.state !== 'closed') {
      outputCtxRef.current.close().catch(() => {});
    }
    outputCtxRef.current = null;

    // 4. Libérer la caméra et le micro
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setView('lobby');
    setStatus('Standby');
    setTranscripts([]);
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
            setStatus('En Direct');
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
              setTranscripts(prev => [...prev.slice(-3), `IA: ${message.serverContent?.outputTranscription?.text}`]);
            }
          },
          onerror: (e) => { handleGeminiError(e); stopSession(); },
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `Tu es SOCIAL MUSE facilitator. Analyse vidéo et audio. Langue: ${language}.`,
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err) {
      handleGeminiError(err);
      stopSession();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] flex flex-col">
      {view === 'lobby' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
           <div className="space-y-2">
              <h1 className="text-4xl font-serif font-black italic">Live <span className="text-indigo-500">Studio</span></h1>
              <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Lancez votre session d'éloquence assistée</p>
           </div>
           <button 
            onClick={startSession}
            className="px-12 py-6 bg-white text-black rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all"
           >
             Démarrer le Direct
           </button>
           <button onClick={onBack} className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Retour au menu</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative">
          {/* Header Session */}
          <div className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
             <div className="flex items-center space-x-3">
                <div className="px-3 py-1 bg-rose-600 rounded-full text-[8px] font-black uppercase text-white animate-pulse">Live</div>
                <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">{status}</span>
             </div>
             <button 
              onClick={stopSession}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
             >
               <i className="fa-solid fa-phone-slash mr-2"></i>
               Arrêter le Live
             </button>
          </div>

          {/* Video View */}
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="flex-1 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
               <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
               <canvas ref={canvasRef} className="hidden" />
               
               {/* Controls Overlays */}
               <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center space-x-4">
                  <button onClick={() => setIsMicOn(!isMicOn)} className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isMicOn ? 'bg-white/10 text-white' : 'bg-rose-600 text-white'}`}>
                    <i className={`fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
                  </button>
                  <button onClick={() => setIsCamOn(!isCamOn)} className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isCamOn ? 'bg-white/10 text-white' : 'bg-rose-600 text-white'}`}>
                    <i className={`fa-solid ${isCamOn ? 'fa-video' : 'fa-video-slash'}`}></i>
                  </button>
               </div>
            </div>

            {/* Sidebar Transcripts */}
            <div className="w-full md:w-80 bg-black border-l border-white/5 p-6 flex flex-col space-y-6 overflow-y-auto">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Analyses en Temps Réel</h3>
               <div className="flex-1 space-y-4">
                  {transcripts.map((t, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-2xl text-[11px] italic text-zinc-400 border border-white/5 animate-in slide-in-from-bottom-2">
                       {t}
                    </div>
                  ))}
                  {!transcripts.length && <p className="text-[9px] text-zinc-600 uppercase font-bold text-center py-20">En attente de signal...</p>}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveRoom;
