
import React, { useState, useEffect, useRef } from 'react';
import { getAI, encode, decode, decodeAudioData, handleGeminiError } from '../services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';
import { Language, UserAccount } from '../types';

interface LiveVoiceChatProps {
  language: Language;
  // Fix: Adding user and db props to resolve TS mismatch in App.tsx
  user: UserAccount | null;
  db: any;
}

const LiveVoiceChat: React.FC<LiveVoiceChatProps> = ({ language, user, db }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [transcription, setTranscription] = useState<string[]>([]);
  const [volume, setVolume] = useState(0);
  const [analysis, setAnalysis] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);

  const startSession = async () => {
    try {
      setIsActive(true);
      setStatus('Analyzing Tonality...');
      setAnalysis(null);
      
      const ai = getAI();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('Recording');
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const sum = inputData.reduce((acc, v) => acc + Math.abs(v), 0);
              setVolume(sum / inputData.length * 100);

              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64 && outputCtx.state !== 'closed') {
              const buffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
            }
            if (msg.serverContent?.outputTranscription) {
              const text = msg.serverContent.outputTranscription.text;
              if (text) setTranscription(prev => [...prev.slice(-4), text]);
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => { handleGeminiError(e); stopSession(); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are SOCIAL MUSE Lab assistant. Analyze the user's speech tone, confidence, and clarity in real-time. Provide short, professional feedback. Language: ${language}.`,
          outputAudioTranscription: {}
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      handleGeminiError(err);
      setIsActive(false);
    }
  };

  const stopSession = () => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => s.close());
      sessionPromiseRef.current = null;
    }
    
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(() => {});
    }
    inputAudioContextRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;

    setIsActive(false);
    setVolume(0);
    setStatus('Ready');
    setAnalysis("Training session complete. High confidence detected, slight tension in vocal pacing. (Mock Analysis)");
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-12 animate-in fade-in py-12">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-serif font-black italic">The <span className="text-[#3B82F6]">Lab</span></h2>
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Smart Dictaphone & Tone Analyzer</p>
      </div>

      <div className={`relative w-80 h-80 rounded-[3rem] flex items-center justify-center transition-all duration-1000 bg-[#0c0c0e] border border-white/5 shadow-2xl ${isActive ? 'shadow-[#3B82F6]/20' : ''}`}>
        <div className={`absolute inset-6 border border-dashed rounded-[2.5rem] transition-all duration-1000 ${isActive ? 'border-[#3B82F6] animate-pulse' : 'border-zinc-800'}`}></div>
        
        <div className="z-10 flex flex-col items-center space-y-8">
           <div className="h-12 flex items-center space-x-1">
              {[...Array(12)].map((_, i) => (
                <div key={i} className={`w-1 rounded-full transition-all duration-75 ${isActive ? 'bg-[#3B82F6]' : 'bg-zinc-800'}`} style={{ height: isActive ? `${Math.random() * volume + 10}%` : '8px' }}></div>
              ))}
           </div>

           <button 
             onClick={isActive ? stopSession : startSession} 
             className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${isActive ? 'bg-[#f43f5e] text-white shadow-[#f43f5e]/40' : 'bg-white text-black'}`}
           >
             <i className={`fa-solid ${isActive ? 'fa-square' : 'fa-microphone'} text-2xl`}></i>
           </button>

           <div className="text-center">
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] block mb-1">{status}</span>
             <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Secure Neural Processing</span>
           </div>
        </div>
      </div>

      <div className="w-full max-w-xl space-y-6">
        {analysis && (
          <div className="p-6 rounded-[2rem] bg-[#3B82F6]/10 border border-[#3B82F6]/20 animate-in slide-in-from-bottom-4">
             <div className="flex items-center space-x-3 mb-3">
                <i className="fa-solid fa-wand-magic-sparkles text-[#3B82F6]"></i>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#3B82F6]">AI Lab Feedback</span>
             </div>
             <p className="text-xs text-zinc-300 leading-relaxed font-serif italic">"{analysis}"</p>
          </div>
        )}

        <div className="p-8 rounded-[2rem] bg-zinc-900/50 border border-white/5 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Real-time Transcription</h3>
          <div className="space-y-3 min-h-[100px]">
            {transcription.map((t, i) => (
              <p key={i} className="text-sm font-serif italic text-zinc-400 animate-in fade-in">"{t}"</p>
            ))}
            {transcription.length === 0 && (
              <p className="text-[10px] uppercase font-black tracking-widest text-zinc-800 text-center py-8">Awaiting input stream...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveVoiceChat;
