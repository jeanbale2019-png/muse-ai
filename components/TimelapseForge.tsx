
import React, { useState, useEffect, useRef } from 'react';
import { Modality, LiveServerMessage } from "@google/genai";
import { 
  orchestrateStoryboard, 
  generateStepImage, 
  generateVeoVideo, 
  generateSocialPack,
  triggerDownload,
  handleGeminiError,
  getAI,
  encode,
  decode,
  decodeAudioData
} from '../services/geminiService';
import { TimelapseProject, StoryboardStep, SocialPack, Language, UserAccount, BrandKit } from '../types';

interface TimelapseForgeProps {
  language: Language;
  user: UserAccount | null;
}

const PRESETS = [
  { id: 'modern', label: 'Modern Minimalist', icon: 'fa-cube' },
  { id: 'industrial', label: 'Raw Industrial', icon: 'fa-industry' },
  { id: 'scandi', label: 'Scandinavian Warmth', icon: 'fa-leaf' },
  { id: 'futuristic', label: 'Cyberpunk Neon', icon: 'fa-bolt' },
];

const TimelapseForge: React.FC<TimelapseForgeProps> = ({ language, user }) => {
  const [step, setStep] = useState<'setup' | 'storyboard' | 'review'>('setup');
  const [project, setProject] = useState<Partial<TimelapseProject>>({
    title: '',
    roomType: 'Living Room',
    stylePreset: 'modern',
    targetAudience: 'Architects',
    language,
    references: [],
    brandKit: { primaryColor: '#4F46E5', secondaryColor: '#10B981', fontPreference: 'Inter' },
    steps: []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeGenId, setActiveGenId] = useState<number | null>(null);
  const [socialPacks, setSocialPacks] = useState<SocialPack[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  // Live Consultant States
  const [showConsultant, setShowConsultant] = useState(false);
  const [consultantStatus, setConsultantStatus] = useState('Standby');
  const [consultantVolume, setConsultantVolume] = useState(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const initProject = async () => {
    if (!project.title) return;
    setIsLoading(true);
    setGlobalError(null);
    try {
      const steps = await orchestrateStoryboard(project);
      setProject(prev => ({ ...prev, steps }));
      setStep('storyboard');
    } catch (e) {
      const msg = await handleGeminiError(e);
      setGlobalError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + (project.references?.length || 0) > 3) {
      alert("Max 3 reference images allowed.");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setProject(prev => ({
          ...prev,
          references: [...(prev.references || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file as Blob);
    });
  };

  const generateStepAssets = async (stepId: number) => {
    const targetStep = project.steps?.find(s => s.id === stepId);
    if (!targetStep || targetStep.status === 'completed') return;

    setActiveGenId(stepId);
    setProject(prev => ({
      ...prev,
      steps: prev.steps?.map(s => s.id === stepId ? { ...s, status: 'generating' } : s)
    }));

    try {
      const contextPrompt = `Follow the ${project.stylePreset} style for ${project.roomType}. References: ${project.references?.length} initial state provided.`;
      const img = await generateStepImage(`${contextPrompt} Step: ${targetStep.visualPrompt}`, project.stylePreset || 'modern');
      const videoRes = img ? await generateVeoVideo(targetStep.visualPrompt, img.split(',')[1]) : null;

      setProject(prev => ({
        ...prev,
        steps: prev.steps?.map(s => s.id === stepId ? { 
          ...s, 
          status: 'completed', 
          imageUrl: img || undefined,
          videoUrl: videoRes?.url,
          videoObject: videoRes?.videoObject
        } : s)
      }));
    } catch (e: any) {
      console.error(e);
      const msg = await handleGeminiError(e);
      setProject(prev => ({
        ...prev,
        steps: prev.steps?.map(s => s.id === stepId ? { ...s, status: 'error' } : s)
      }));
      setGlobalError(msg);
    } finally {
      setActiveGenId(null);
    }
  };

  const finalizeProject = async () => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      const packs = await generateSocialPack(project as TimelapseProject);
      setSocialPacks(packs);
      setStep('review');
    } catch (e) {
      const msg = await handleGeminiError(e);
      setGlobalError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleConsultant = async () => {
    if (showConsultant) {
      if (sessionPromiseRef.current) sessionPromiseRef.current.then(s => s.close());
      if (audioContextRef.current) audioContextRef.current.close();
      setShowConsultant(false);
      return;
    }

    setShowConsultant(true);
    setConsultantStatus('Connecting to Project Lead...');
    
    try {
      const ai = getAI();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setConsultantStatus('Ready to guide your vision');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const sum = inputData.reduce((a, b) => a + Math.abs(b), 0);
              setConsultantVolume(sum / inputData.length * 100);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64 && outputCtx.state !== 'closed') {
              setConsultantStatus('Lead Architect is speaking...');
              const buffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start();
              source.onended = () => setConsultantStatus('Listening to your ideas...');
            }
          },
          onerror: (e) => handleGeminiError(e)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are the Lead Project Architect. Help refine: ${project.title}. Respond in ${language}.`,
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) {
      console.error(e);
      setShowConsultant(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20 px-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-3 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 mb-4">
           <i className="fa-solid fa-layer-group text-xs"></i>
           <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Generation Hub</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-serif font-black tracking-tight text-white uppercase italic leading-none">
          Build <span className="text-indigo-500">To</span> Timelapse
        </h1>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.6em]">Construction Visualization & Marketing Chain</p>
      </div>

      {globalError && (
        <div className="max-w-3xl mx-auto p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] flex items-center justify-between text-rose-400 animate-in slide-in-from-top-4">
          <div className="flex items-center space-x-4">
            <i className="fa-solid fa-triangle-exclamation text-xl"></i>
            <span className="text-xs font-black uppercase tracking-widest">{globalError}</span>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => window.aistudio?.openSelectKey?.()}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all"
            >
              Switch Key
            </button>
            <button onClick={() => setGlobalError(null)} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>
      )}

      {step === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 glass p-10 md:p-14 rounded-[3.5rem] border border-white/5 space-y-10 shadow-2xl">
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Project Identity</label>
                <input 
                  value={project.title}
                  onChange={e => setProject({...project, title: e.target.value})}
                  placeholder="Ex: The Zenith Penthouse"
                  className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 text-2xl font-serif text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 {PRESETS.map(p => (
                   <button 
                    key={p.id}
                    onClick={() => setProject({...project, stylePreset: p.id})}
                    className={`p-6 rounded-3xl border flex flex-col items-center justify-center space-y-3 transition-all ${project.stylePreset === p.id ? 'bg-indigo-600 border-transparent text-white shadow-xl shadow-indigo-600/20' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'}`}
                   >
                      <i className={`fa-solid ${p.icon} text-xl`}></i>
                      <span className="text-[10px] font-black uppercase tracking-widest">{p.label}</span>
                   </button>
                 ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Space Geometry</label>
                  <select 
                    value={project.roomType}
                    onChange={e => setProject({...project, roomType: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-zinc-300 outline-none cursor-pointer"
                  >
                    <option>Modern Living Room</option>
                    <option>Kitchen Island</option>
                    <option>Luxury Bathroom</option>
                    <option>Garden Oasis</option>
                    <option>Full Home Exterior</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Target Audience</label>
                  <input 
                    value={project.targetAudience}
                    onChange={e => setProject({...project, targetAudience: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-zinc-300 outline-none"
                    placeholder="e.g. Real Estate Investors"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={initProject}
              disabled={!project.title || isLoading}
              className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-indigo-500 transition-all flex items-center justify-center space-x-4 active:scale-95 disabled:opacity-20"
            >
              {isLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt-lightning"></i>}
              <span>Synthesize Storyboard</span>
            </button>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <div className="glass p-8 rounded-[3rem] border border-white/5 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Visual References</h3>
                <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">{project.references?.length || 0}/3</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                 {project.references?.map((ref, i) => (
                   <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10 relative group">
                      <img src={ref} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setProject(prev => ({ ...prev, references: prev.references?.filter((_, idx) => idx !== i) }))}
                        className="absolute inset-0 bg-rose-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      >
                         <i className="fa-solid fa-trash-can"></i>
                      </button>
                   </div>
                 ))}
                 {(project.references?.length || 0) < 3 && (
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600 hover:border-indigo-500/50 hover:text-indigo-400 transition-all bg-white/5"
                   >
                      <i className="fa-solid fa-plus text-xl mb-1"></i>
                      <span className="text-[8px] font-black uppercase">Add Photo</span>
                   </button>
                 )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleReferenceUpload} />
            </div>

            <div className="glass p-8 rounded-[3rem] border border-white/5 space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Brand Kit Integration</h3>
              <div className="space-y-4">
                 <div 
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-all bg-white/5 overflow-hidden"
                 >
                    {project.brandKit?.logo ? (
                      <img src={project.brandKit.logo} className="h-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <i className="fa-solid fa-stamp text-xl text-zinc-700 mb-1"></i>
                        <span className="text-[8px] font-black uppercase text-zinc-600">Overlay Logo</span>
                      </div>
                    )}
                 </div>
                 <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) {
                     const reader = new FileReader();
                     reader.onload = () => setProject(prev => ({ ...prev, brandKit: { ...prev.brandKit!, logo: reader.result as string } }));
                     reader.readAsDataURL(file as Blob);
                   }
                 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'storyboard' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-8">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/5 p-8 md:px-12 rounded-[3rem] border border-white/5 space-y-6 md:space-y-0">
              <div className="flex flex-col">
                 <h2 className="text-3xl font-serif italic text-white leading-tight">{project.title}</h2>
                 <div className="flex items-center space-x-3 mt-1">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Architectural Storyboard</span>
                    <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">12 Strategic Steps</span>
                 </div>
              </div>
              <div className="flex items-center space-x-6">
                 <button 
                  onClick={toggleConsultant}
                  className="flex items-center space-x-3 px-6 py-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all group"
                 >
                    <div className="relative">
                       <i className="fa-solid fa-headset group-hover:scale-110 transition-transform"></i>
                       <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-400 rounded-full animate-ping"></span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Live Lead Consultant</span>
                 </button>
                 <button 
                  onClick={finalizeProject}
                  disabled={project.steps?.some(s => s.status !== 'completed')}
                  className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all shadow-2xl disabled:opacity-20"
                 >
                   Export Campaign Pack
                 </button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {project.steps?.map(s => (
                <div key={s.id} className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-4 flex flex-col group relative overflow-hidden transition-all hover:bg-white/[0.02]">
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                         <span className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/20">{s.id}</span>
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{s.title}</h4>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-zinc-500 border border-white/5'}`}>
                         {s.status}
                      </span>
                   </div>
                   
                   <div className="aspect-video w-full bg-zinc-950 rounded-[1.5rem] overflow-hidden relative group-hover:shadow-2xl transition-all border border-white/5">
                      {s.videoUrl ? (
                        <video src={s.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                      ) : s.imageUrl ? (
                        <img src={s.imageUrl} className="w-full h-full object-cover opacity-80" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-10">
                           <i className="fa-solid fa-play text-3xl mb-2"></i>
                           <span className="text-[8px] font-black uppercase">Pending Synthesis</span>
                        </div>
                      )}

                      {s.status === 'generating' && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                           <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                           <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest animate-pulse">Rendering Veo Motion</span>
                        </div>
                      )}
                      
                      {s.status === 'error' && (
                        <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-2">
                           <i className="fa-solid fa-triangle-exclamation text-rose-400 text-xl"></i>
                           <span className="text-[8px] font-black uppercase text-rose-300">Synthesis Failed</span>
                           <button onClick={() => generateStepAssets(s.id)} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[8px] font-black uppercase">Retry</button>
                        </div>
                      )}
                   </div>

                   <button 
                    onClick={() => generateStepAssets(s.id)}
                    disabled={s.status === 'generating' || s.status === 'completed'}
                    className={`w-full py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${s.status === 'completed' ? 'bg-white/5 text-zinc-700 cursor-default' : 'bg-white text-black hover:bg-zinc-200 active:scale-[0.98]'}`}
                   >
                     {s.status === 'completed' ? 'Broadcast Synchronized' : s.status === 'generating' ? 'Synthesizing...' : 'Forge Cinematic Assets'}
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-12 animate-in zoom-in-95 duration-500">
           <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <button onClick={() => setStep('storyboard')} className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white transition-colors border border-white/5">
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="flex flex-col">
                   <h2 className="text-4xl font-serif italic text-white">Project <span className="text-indigo-400">Master Vault</span></h2>
                   <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">All assets compiled and ready for distribution</p>
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-5 space-y-8">
                <div className="glass p-10 rounded-[3rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
                   <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl relative group border border-white/10">
                      <video src={project.steps?.[11]?.videoUrl} loop autoPlay muted className="w-full h-full object-cover" />
                   </div>
                   <div className="grid grid-cols-1 gap-4">
                      <button 
                        onClick={() => project.steps?.forEach(s => s.videoUrl && triggerDownload(s.videoUrl, `step-${s.id}.mp4`))}
                        className="py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
                      >
                        Download 4K Bundle
                      </button>
                   </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-10">
                 <div className="space-y-6">
                    {socialPacks.map((pack, i) => (
                      <div key={i} className="glass p-10 rounded-[3.5rem] border border-white/5 space-y-8 animate-in slide-in-from-right duration-500 group" style={{ animationDelay: `${i * 100}ms` }}>
                         <div className="flex items-center justify-between border-b border-white/5 pb-6">
                            <div className="flex items-center space-x-4">
                               <i className={`fa-brands fa-${pack.platform.toLowerCase().includes('in') ? 'linkedin-in' : pack.platform.toLowerCase()} text-xl text-indigo-400`}></i>
                               <span className="text-xl font-serif italic text-white">{pack.platform} Strategy</span>
                            </div>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`${pack.suggestedTitle}\n\n${pack.copy}`);
                                alert(`${pack.platform} copied.`);
                              }}
                              className="px-5 py-3 rounded-xl bg-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-indigo-400 transition-all"
                            >
                              Copy Pack
                            </button>
                         </div>
                         <div className="space-y-6">
                            <h4 className="text-xl font-bold text-zinc-200 tracking-tight">{pack.suggestedTitle}</h4>
                            <p className="text-sm text-zinc-400 leading-relaxed italic font-medium">"{pack.copy}"</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TimelapseForge;
