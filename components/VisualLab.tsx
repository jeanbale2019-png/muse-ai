
import React, { useState, useRef, useEffect } from 'react';
// Fix: Removed non-existent import 'extendVeoVideo'
import { analyzeImageAndGhostwrite, generateTTS, playTTS, editImage, generateVeoVideo, decode, pcmToWav, triggerDownload, downloadFromUrl, handleGeminiError, ensureApiKey, saveToGallery, getAI, encode, decodeAudioData } from '../services/geminiService';
import { checkPermission, registerChallengeUsage } from '../services/subscriptionService';
import { StoryData, AVAILABLE_VOICES, VoiceName, Language, StoryGenre, UserAccount } from '../types';
import { Modality, LiveServerMessage } from '@google/genai';

interface VisualLabProps {
  language: Language;
  user: UserAccount | null;
  db: any;
}

const GENRES: { id: StoryGenre; label: string; icon: string; color: string }[] = [
  { id: 'fantasy', label: 'Fantasy', icon: 'fa-wand-sparkles', color: 'purple' },
  { id: 'scifi', label: 'Sci-Fi', icon: 'fa-user-robot', color: 'blue' },
  { id: 'noir', label: 'Noir', icon: 'fa-hat-cowboy', color: 'zinc' },
  { id: 'horror', label: 'Horror', icon: 'fa-skull', color: 'rose' },
  { id: 'romance', label: 'Romance', icon: 'fa-heart', color: 'pink' },
  { id: 'historical', label: 'Historical', icon: 'fa-landmark', color: 'amber' },
];

const QUICK_EDITS = [
  { id: 'retro', label: 'Retro', prompt: 'Add a vintage retro 1970s film filter with slight grain, warm saturated tones, and a nostalgic feel.', icon: '📻' },
  { id: 'cinematic', label: 'Movie', prompt: 'Enhance with cinematic lighting, deep shadows, professional color grading, and high-end film aesthetics.', icon: '🎬' },
  { id: 'cyberpunk', label: 'Neon', prompt: 'Transform into a cyberpunk aesthetic with neon lights, rain-slicked surfaces, and futuristic city elements.', icon: '🔌' },
  { id: 'sunset', label: 'Sunset', prompt: 'Apply a beautiful golden hour sunset glow to the entire scene with long shadows and warm light.', icon: '🌅' },
  { id: 'noir', label: 'Noir', prompt: 'Convert to a high-contrast black and white noir style film look with dramatic shadows.', icon: '🕶️' },
  { id: 'anime', label: 'Anime', prompt: 'Reimagine this scene in a high-quality modern anime art style with vibrant colors and clean lines.', icon: '🎌' },
];

const VisualLab: React.FC<VisualLabProps> = ({ language, user, db }) => {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<StoryGenre>('fantasy');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Analyzing Vision...');
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<StoryData | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lastVideoObject, setLastVideoObject] = useState<any | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [isReading, setIsReading] = useState(false);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'narrative' | 'world' | 'sensory' | 'twists'>('narrative');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live API State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState<string[]>([]);
  const [inputVolume, setInputVolume] = useState(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const liveInputAudioContextRef = useRef<AudioContext | null>(null);
  const liveOutputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Check daily limit for free users
    const perm = checkPermission(user, 'challenge');
    if (!perm.allowed) {
      setError(perm.message || "Limite atteinte.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage(reader.result as string);
      setMimeType(file.type);
      setVideoUrl(null);
      setLastVideoObject(null);
      setStory(null);
      setLastAudioBase64(null);
      setIsProcessing(true);
      setProcessingMessage('Casting initial vision...');
      setError(null);
      try {
        const result = await analyzeImageAndGhostwrite(base64, file.type, language, selectedGenre);
        setStory(result);
        if (user && db) await registerChallengeUsage(user, db);
      } catch (err: any) {
        handleGeminiError(err);
        setError(err.message || "Analysis failed.");
      } finally { setIsProcessing(false); }
    };
    reader.readAsDataURL(file);
  };

  const onEdit = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || editPrompt;
    if (!image || !finalPrompt) return;
    
    setIsProcessing(true);
    setProcessingMessage('Alchemizing pixels...');
    setError(null);
    try {
      const base64 = image.split(',')[1];
      const result = await editImage(base64, mimeType, finalPrompt);
      if (result) {
        setImage(result);
        setEditPrompt('');
        const newStory = await analyzeImageAndGhostwrite(result.split(',')[1], 'image/png', language, selectedGenre);
        setStory(newStory);
      }
    } catch (err: any) {
      handleGeminiError(err);
      setError(err.message || "Image refinement failed.");
    } finally { setIsProcessing(false); }
  };

  const startLiveDiscussion = async () => {
    if (!image) return;
    try {
      setIsLiveActive(true);
      setError(null);
      const ai = getAI();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      liveInputAudioContextRef.current = inputCtx;
      liveOutputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const sum = inputData.reduce((acc, v) => acc + Math.abs(v), 0);
              setInputVolume(sum / inputData.length * 100);

              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);

            sessionPromise.then(s => {
              s.sendRealtimeInput({
                media: { data: image.split(',')[1], mimeType: mimeType }
              });
            });
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
              
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (msg.serverContent?.outputTranscription) {
               const text = msg.serverContent.outputTranscription.text;
               if (text) setLiveTranscription(prev => [...prev.slice(-3), text]);
            }
          },
          onclose: () => stopLiveDiscussion(),
          onerror: (e: any) => {
            handleGeminiError(e);
            setError(e.message || "Live session error.");
            stopLiveDiscussion();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are a creative writing assistant. I have provided an image. Discuss its mood, characters, and plot potential with me in real-time. Help me brainstorm for a story in the genre of ${selectedGenre}. Language: ${language}.`,
          outputAudioTranscription: {}
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      handleGeminiError(err);
      setError(err.message || "Failed to start live session.");
      stopLiveDiscussion();
    }
  };

  const stopLiveDiscussion = () => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => s.close());
      sessionPromiseRef.current = null;
    }

    if (liveInputAudioContextRef.current && liveInputAudioContextRef.current.state !== 'closed') {
      liveInputAudioContextRef.current.close().catch(() => {});
    }
    liveInputAudioContextRef.current = null;

    if (liveOutputAudioContextRef.current && liveOutputAudioContextRef.current.state !== 'closed') {
      liveOutputAudioContextRef.current.close().catch(() => {});
    }
    liveOutputAudioContextRef.current = null;

    setIsLiveActive(false);
    setLiveTranscription([]);
    setInputVolume(0);
  };

  const onAnimate = async () => {
    if (!image) return;
    setIsProcessing(true);
    setProcessingMessage('Weaving motion vectors...');
    setError(null);
    try {
      await ensureApiKey(); 
      const animationPrompt = story 
        ? `Cinematic animation of this scene. Genre: ${selectedGenre}. Atmosphere: ${story.mood}. Narrative direction: ${story.openingParagraph}`
        : `Animate this scene beautifully in the style of ${selectedGenre}`;
      const { url, videoObject } = await generateVeoVideo(animationPrompt, image.split(',')[1], mimeType);
      setVideoUrl(url);
      setLastVideoObject(videoObject);
    } catch (err: any) {
      handleGeminiError(err);
      setError(err.message || "Animation failed.");
    } finally { setIsProcessing(false); }
  };

  const onReadAloud = async () => {
    if (!story) return;
    setIsReading(true);
    setError(null);
    try {
      const base64 = await generateTTS(story.openingParagraph, selectedVoice);
      if (base64) {
        setLastAudioBase64(base64);
        await playTTS(base64);
      }
    } catch (err: any) {
      handleGeminiError(err);
      setError(err.message || "Speech synthesis failed.");
    } finally {
      setIsReading(false);
    }
  };

  const onDownloadAudio = () => {
    if (!lastAudioBase64) return;
    const pcmData = new Int16Array(decode(lastAudioBase64).buffer);
    const wavBlob = pcmToWav(pcmData, 24000);
    const url = URL.createObjectURL(wavBlob);
    triggerDownload(url, `narration-${Date.now()}.wav`);
    URL.revokeObjectURL(url);
  };

  const onDownloadVideo = () => {
    if (!videoUrl) return;
    downloadFromUrl(videoUrl, `animation-${Date.now()}.mp4`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tighter text-white leading-none">The <span className="text-indigo-400 italic">Ghostwriter's</span> Studio</h2>
        <p className="text-zinc-500 text-sm md:text-lg font-light">Cast your vision. Analyze the soul of the scene. Write the future.</p>
        
        {/* Genre Selector */}
        <div className="flex flex-wrap justify-center gap-3 pt-6">
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              onClick={() => setSelectedGenre(genre.id)}
              className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center space-x-2 ${
                selectedGenre === genre.id 
                  ? `bg-${genre.color}-500/20 border-${genre.color}-500 text-${genre.color}-400 shadow-lg shadow-${genre.color}-500/10` 
                  : 'bg-zinc-900/50 border-white/5 text-zinc-600 hover:text-zinc-300'
              }`}
            >
              <i className={`fa-solid ${genre.icon}`}></i>
              <span>{genre.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="max-w-xl mx-auto px-4 animate-in slide-in-from-top-4">
           <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center space-x-3 text-rose-400">
             <i className="fa-solid fa-triangle-exclamation"></i>
             <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed flex-1">{error}</p>
             <button onClick={() => setError(null)} className="hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>
           </div>
           {user?.tier === 'free' && error.includes('limite') && (
             <p className="text-[9px] font-black uppercase tracking-widest text-center mt-2 text-indigo-400 animate-pulse">Passez Premium pour débloquer l'accès illimité.</p>
           )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-12 px-4">
        {/* Visual & Tools Column (Left) */}
        <div className="xl:col-span-5 space-y-6">
          <div 
            className={`aspect-[4/3] glass rounded-[2.5rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-zinc-800/50 hover:border-indigo-500/30 transition-all shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative group bg-black/20`}
          >
            {videoUrl ? (
              <div className="w-full h-full relative group">
                <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover rounded-[2.5rem]" />
                <button 
                  onClick={() => setVideoUrl(null)} 
                  className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 z-20"
                  title="Return to image"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ) : image ? (
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-full cursor-pointer relative group">
                <img src={image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2000ms]" alt="Vision Reference" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/10 backdrop-blur-xl px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20">Change Visual Reference</div>
                </div>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center space-y-4 text-zinc-600 p-8 text-center group-hover:text-indigo-400 transition-colors cursor-pointer w-full h-full justify-center">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shadow-inner">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z"></path></svg>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em]">Upload Vision Reference</p>
                  <p className="text-[10px] opacity-50 mt-1 uppercase tracking-widest">Image Analysis & Animation</p>
                </div>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFile} />
          
          <div className="glass p-6 md:p-8 rounded-[2.5rem] space-y-8 border border-white/5 bg-black/40 shadow-2xl">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Vision Refinement</label>
                <div className="flex items-center space-x-2">
                   <button onClick={isLiveActive ? stopLiveDiscussion : startLiveDiscussion} disabled={!image} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isLiveActive ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/20' : 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-600/20'}`}>
                     {isLiveActive ? 'Terminate Session' : 'Consult the Muse'}
                   </button>
                </div>
              </div>
              
              {isLiveActive ? (
                <div className="bg-zinc-900/60 p-6 rounded-3xl border border-indigo-500/20 space-y-6 animate-in fade-in zoom-in-95">
                   <div className="flex items-center space-x-4">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-75" style={{ width: `${Math.min(inputVolume * 2, 100)}%` }}></div>
                      </div>
                      <i className="fa-solid fa-waveform-lines text-indigo-400 text-xs animate-pulse"></i>
                   </div>
                   <div className="space-y-3">
                      {liveTranscription.map((t, i) => (
                        <div key={i} className="animate-in slide-in-from-left-2 p-3 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[11px] text-zinc-300 italic font-serif leading-relaxed">"{t}"</p>
                        </div>
                      ))}
                      {liveTranscription.length === 0 && <p className="text-[10px] text-zinc-600 uppercase tracking-widest text-center py-6 font-bold">The Muse is listening to your thoughts...</p>}
                   </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="relative group">
                    <input 
                      className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl px-6 py-5 text-sm outline-none focus:border-indigo-500/30 transition-all placeholder:text-zinc-700 font-light"
                      placeholder="e.g. 'Add bioluminescent flowers to the scene'..."
                      value={editPrompt}
                      onChange={e => setEditPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onEdit()}
                    />
                    <button 
                      onClick={() => onEdit()} 
                      disabled={!image || isProcessing || !editPrompt} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30 active:scale-95 shadow-lg"
                    >
                      Refine
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 px-1">Stylistic Alchemy</p>
              <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
                {QUICK_EDITS.map(preset => (
                  <button 
                    key={preset.id}
                    onClick={() => onEdit(preset.prompt)}
                    disabled={!image || isProcessing || isLiveActive}
                    className="flex flex-col items-center justify-center p-4 bg-zinc-900/30 border border-zinc-800 rounded-3xl hover:border-indigo-500/20 transition-all group disabled:opacity-50"
                  >
                    <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">{preset.icon}</span>
                    <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500 group-hover:text-white">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-2 space-y-3">
              <button 
                onClick={onAnimate} 
                disabled={!image || isProcessing || isLiveActive} 
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_20px_40px_rgba(79,70,229,0.2)] transition-all disabled:opacity-50 flex items-center justify-center space-x-3 active:scale-95"
              >
                {isProcessing && !editPrompt && !lastVideoObject ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <i className="fa-solid fa-clapperboard"></i>
                    <span>{videoUrl ? 'Regenerate Animation' : 'Animate Narrative Frame'}</span>
                  </>
                )}
              </button>
              
              {videoUrl && (
                <button 
                  onClick={onDownloadVideo}
                  className="w-full py-4 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-3xl font-black uppercase text-[9px] tracking-[0.2em] hover:bg-emerald-600/20 transition-all flex items-center justify-center space-x-3 active:scale-95 shadow-xl"
                >
                  <i className="fa-solid fa-file-video text-xs"></i>
                  <span>Export MP4 Animation</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Studio Manuscript Column (Right) */}
        <div className="xl:col-span-7 space-y-8 lg:sticky lg:top-32">
          {story ? (
            <div className="flex flex-col space-y-8 animate-in slide-in-from-right-8 duration-700">
              {/* Studio Header & Analysis Selection */}
              <div className="glass p-1.5 rounded-2xl border border-white/5 flex items-center space-x-1 shadow-lg bg-black/40 self-start overflow-x-auto no-scrollbar">
                {(['narrative', 'world', 'sensory', 'twists'] as const).map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveAnalysisTab(tab)}
                    className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAnalysisTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Manuscript Content */}
              <div className="glass p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] space-y-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] relative overflow-hidden border border-white/5 bg-black/40 min-h-[500px]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] pointer-events-none"></div>
                
                {activeAnalysisTab === 'narrative' && (
                  <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="space-y-4">
                       <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">The Hook ({selectedGenre})</span>
                          <div className="h-px flex-1 bg-white/5"></div>
                       </div>
                       <p className="text-2xl md:text-3xl font-serif leading-relaxed text-zinc-100 first-letter:text-7xl md:first-letter:text-8xl first-letter:font-black first-letter:mr-4 first-letter:float-left first-letter:text-indigo-400 first-letter:mt-3">
                         {story.openingParagraph}
                       </p>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-4">
                       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Atmosphere Profile</span>
                       <p className="text-lg font-serif italic text-indigo-200/60 leading-relaxed">"{story.mood}"</p>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-6">
                       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Archetypes</span>
                       <div className="flex flex-wrap gap-3">
                         {story.characters.map((char, i) => (
                           <span key={i} className="px-4 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-300">
                             {char}
                           </span>
                         ))}
                       </div>
                    </div>
                  </div>
                )}

                {activeAnalysisTab === 'world' && (
                  <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="space-y-6">
                       <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Environment Analysis</span>
                          <div className="h-px flex-1 bg-white/5"></div>
                       </div>
                       <p className="text-sm md:text-base text-zinc-400 leading-relaxed font-light">{story.sceneAnalysis}</p>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-6">
                       <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Lore Snippet</span>
                          <div className="h-px flex-1 bg-white/5"></div>
                       </div>
                       <div className="p-6 bg-white/5 rounded-3xl border border-white/5 italic font-serif text-lg text-zinc-200 leading-relaxed">
                          {story.worldBuilding}
                       </div>
                    </div>
                  </div>
                )}

                {activeAnalysisTab === 'sensory' && (
                  <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="space-y-8">
                       <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Sensory Immersion</span>
                          <div className="h-px flex-1 bg-white/5"></div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {story.sensoryDetails.map((detail, i) => (
                            <div key={i} className="p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all group">
                               <div className="flex items-center space-x-4">
                                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                     <i className={`fa-solid ${['fa-eye', 'fa-ear-listen', 'fa-wind', 'fa-fingerprint'][i % 4]} text-sm`}></i>
                                  </div>
                                  <p className="text-xs md:text-sm font-medium text-zinc-300 leading-relaxed italic">"{detail}"</p>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                    
                    <div className="pt-8 border-t border-white/5 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                       <i className="fa-solid fa-dna text-2xl text-zinc-700"></i>
                       <p className="text-[10px] uppercase font-black tracking-widest text-zinc-600">The fabric of reality is woven from small details.</p>
                    </div>
                  </div>
                )}

                {activeAnalysisTab === 'twists' && (
                  <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="space-y-8">
                       <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Narrative Deviations</span>
                          <div className="h-px flex-1 bg-white/5"></div>
                       </div>
                       <div className="space-y-4">
                          {story.plotTwists.map((twist, i) => (
                            <div key={i} className="p-8 bg-zinc-900/40 rounded-[2.5rem] border border-white/5 hover:border-indigo-500/30 transition-all flex items-start space-x-6">
                               <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 font-black text-xs shadow-inner"># {i+1}</div>
                               <div className="space-y-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">The Twist</span>
                                  <p className="text-sm md:text-base font-serif italic text-zinc-200 leading-relaxed">"{twist}"</p>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                    
                    <div className="pt-8 border-t border-white/5 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                       <i className="fa-solid fa-code-merge text-2xl text-zinc-700"></i>
                       <p className="text-[10px] uppercase font-black tracking-widest text-zinc-600">Conflict is the heartbeat of every story.</p>
                    </div>
                  </div>
                )}

                {/* Narrative Controls Footer */}
                <div className="pt-12 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-8">
                  <div className="flex flex-col items-center sm:items-start space-y-3 w-full sm:w-auto">
                    <span className="text-[9px] uppercase font-black tracking-widest text-zinc-600">Narrator Persona</span>
                    <select 
                      className="w-full sm:w-auto bg-zinc-900/60 text-[10px] font-black px-5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none uppercase tracking-widest hover:border-indigo-500/30 transition-all"
                      value={selectedVoice}
                      onChange={e => setSelectedVoice(e.target.value as VoiceName)}
                    >
                      {AVAILABLE_VOICES.map(v => (
                        <option key={v.name} value={v.name}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-3 bg-zinc-900/40 p-2 rounded-full border border-white/5">
                    <button 
                      onClick={onReadAloud} 
                      disabled={isReading}
                      className="w-16 h-16 bg-white text-black hover:bg-zinc-200 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90 disabled:opacity-50"
                      title="Perform Manuscript"
                    >
                      {isReading ? (
                        <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                      ) : (
                        <i className="fa-solid fa-microphone-lines text-xl"></i>
                      )}
                    </button>
                    {lastAudioBase64 && (
                      <button 
                        onClick={onDownloadAudio}
                        className="w-16 h-16 bg-zinc-800 hover:bg-zinc-700 text-indigo-400 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 animate-in zoom-in-50"
                        title="Download Narrative Archive"
                      >
                        <i className="fa-solid fa-file-export text-xl"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Secondary Row */}
              <div className="flex justify-center md:justify-end space-x-4">
                 <button 
                  onClick={() => {
                    saveToGallery({
                      type: 'image',
                      url: image!,
                      prompt: story.openingParagraph,
                      quality: '1K'
                    });
                    setSavedSuccess(true);
                    setTimeout(() => setSavedSuccess(false), 2000);
                  }}
                  className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800/80 transition-all active:scale-95 flex items-center space-x-3"
                 >
                   <i className={`fa-solid ${savedSuccess ? 'fa-check text-emerald-500' : 'fa-bookmark text-zinc-500'}`}></i>
                   <span>{savedSuccess ? 'Vision Saved' : 'Archive Vision'}</span>
                 </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center glass rounded-[3rem] border-dashed border-2 border-zinc-800/50 text-zinc-700 bg-black/5">
              <div className="w-24 h-24 mb-8 bg-zinc-900/40 rounded-full flex items-center justify-center border border-zinc-800 shadow-inner group">
                 <i className="fa-solid fa-feather-pointed text-4xl opacity-10 group-hover:opacity-40 transition-opacity"></i>
              </div>
              <h3 className="text-2xl font-serif mb-3 text-zinc-600">The Script Awaits</h3>
              <p className="text-[10px] max-w-xs mx-auto opacity-50 uppercase tracking-[0.3em] leading-loose font-bold italic">"Every masterpiece begins with a single focused vision."</p>
              <p className="text-[9px] mt-6 text-indigo-400/50 font-black uppercase tracking-widest">Select a genre above and upload an image to begin.</p>
            </div>
          )}
        </div>
      </div>

      {/* Narrative Generation Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-[#09090b]/98 backdrop-blur-3xl z-[200] flex items-center justify-center p-10 text-center animate-in fade-in duration-700">
          <div className="space-y-12 max-w-xl">
            <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto">
               <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               <div className="absolute inset-6 border border-indigo-500/20 rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-8">
              <h3 className="text-4xl md:text-5xl font-serif text-white tracking-tighter leading-none">{processingMessage.split('...')[0]} <span className="text-indigo-400 italic">{selectedGenre} Creation</span>...</h3>
              <div className="space-y-4">
                <div className="inline-flex items-center px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                  <p className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em]">Neural Synthesis Active</p>
                </div>
                <p className="text-zinc-600 text-[10px] md:text-xs italic max-w-sm mx-auto leading-relaxed">Gemini is distilling the mood, sensory details, and narrative potential of your visual reference into a high-fidelity script.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualLab;
