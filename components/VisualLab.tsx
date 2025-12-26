
import React, { useState, useRef, useEffect } from 'react';
import { analyzeImageAndGhostwrite, expandStory, generateTTS, playTTS, editImage, generateVeoVideo, decode, pcmToWav, triggerDownload, downloadFromUrl, handleGeminiError, ensureApiKey, saveToGallery, getAI, encode, decodeAudioData } from '../services/geminiService';
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
  const [isExpanding, setIsExpanding] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Analyzing Vision...');
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<StoryData | null>(null);
  const [manuscript, setManuscript] = useState<string[]>([]);
  const [editPrompt, setEditPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [isReading, setIsReading] = useState(false);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'narrative' | 'visual' | 'world' | 'prompts'>('narrative');
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
      setStory(null);
      setManuscript([]);
      setLastAudioBase64(null);
      setIsProcessing(true);
      setProcessingMessage('Casting initial vision...');
      setError(null);
      try {
        const result = await analyzeImageAndGhostwrite(base64, file.type, language, selectedGenre);
        setStory(result);
        setManuscript([result.openingParagraph]);
        if (user && db) await registerChallengeUsage(user, db);
      } catch (err: any) {
        setError(err.message || "L'analyse a échoué.");
      } finally { setIsProcessing(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleExpandStory = async () => {
    if (!story || isExpanding) return;
    setIsExpanding(true);
    setError(null);
    try {
      const lastParagraph = manuscript[manuscript.length - 1];
      const nextParagraph = await expandStory(lastParagraph, story.sceneAnalysis, selectedGenre, language);
      setManuscript(prev => [...prev, nextParagraph]);
    } catch (err: any) {
      setError(err.message || "Échec de l'extension de l'histoire.");
    } finally {
      setIsExpanding(false);
    }
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
        setManuscript([newStory.openingParagraph]);
      }
    } catch (err: any) {
      setError(err.message || "Échec du raffinement de l'image.");
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
          onerror: async (e: any) => {
            const msg = await handleGeminiError(e);
            setError(msg);
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
      const msg = await handleGeminiError(err);
      setError(msg);
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
      const { url } = await generateVeoVideo(animationPrompt, image.split(',')[1], mimeType);
      setVideoUrl(url);
    } catch (err: any) {
      setError(err.message || "L'animation a échoué.");
    } finally { setIsProcessing(false); }
  };

  const onReadAloud = async () => {
    if (manuscript.length === 0) return;
    setIsReading(true);
    setError(null);
    try {
      const fullText = manuscript.join(' ');
      const base64 = await generateTTS(fullText, selectedVoice);
      if (base64) {
        setLastAudioBase64(base64);
        await playTTS(base64);
      }
    } catch (err: any) {
      setError(err.message || "La synthèse vocale a échoué.");
    } finally {
      setIsReading(false);
    }
  };

  const onDownloadAudio = () => {
    if (!lastAudioBase64) return;
    const pcmData = new Int16Array(decode(lastAudioBase64).buffer);
    const wavBlob = pcmToWav(pcmData, 24000);
    const url = URL.createObjectURL(wavBlob);
    triggerDownload(url, `manuscript-${Date.now()}.wav`);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-20 px-4">
      {/* Dynamic Error HUD */}
      {error && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-top-4">
           <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-[2.5rem] flex items-start space-x-4 text-rose-400">
             <i className="fa-solid fa-triangle-exclamation text-xl mt-1"></i>
             <div className="flex-1 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest">Studio Status: Alert</p>
                <p className="text-sm italic leading-relaxed">{error}</p>
                <div className="flex space-x-4">
                  <button onClick={() => setError(null)} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Dismiss</button>
                  <button onClick={() => window.location.reload()} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors">Retry Connection</button>
                </div>
             </div>
           </div>
        </div>
      )}

      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tighter text-white leading-none">Creative <span className="text-indigo-400 italic">Manuscript</span> Studio</h2>
        <p className="text-zinc-500 text-sm md:text-lg font-light">Ground your narrative in visual truth. Expand your scene. Master the flow.</p>
        
        <div className="flex flex-wrap justify-center gap-3 pt-6">
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              onClick={() => setSelectedGenre(genre.id)}
              className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center space-x-2 ${
                selectedGenre === genre.id 
                  ? `bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-lg` 
                  : 'bg-zinc-900/50 border-white/5 text-zinc-600 hover:text-zinc-300'
              }`}
            >
              <i className={`fa-solid ${genre.icon}`}></i>
              <span>{genre.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-12">
        {/* Visual Tools Column (Left) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="aspect-[4/3] glass rounded-[2.5rem] overflow-hidden border-2 border-dashed border-zinc-800/50 hover:border-indigo-500/30 transition-all shadow-2xl relative group bg-black/20">
            {videoUrl ? (
              <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
            ) : image ? (
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-full cursor-pointer relative group">
                <img src={image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3000ms]" alt="Vision Reference" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="bg-white/10 backdrop-blur-xl px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20">Change Visual Reference</div>
                </div>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center space-y-4 text-zinc-600 p-8 text-center group-hover:text-indigo-400 transition-colors cursor-pointer w-full h-full justify-center">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                  <i className="fa-solid fa-cloud-arrow-up text-3xl"></i>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">Inspirer la Muse (Upload)</p>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFile} />

          {/* Quick Stylistic Edits */}
          <div className="glass p-6 md:p-8 rounded-[2.5rem] space-y-6 border border-white/5 bg-black/40 shadow-2xl">
            <div className="flex justify-between items-center">
               <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Visual Essence</span>
               {story?.visualAnalysis && (
                 <div className="flex space-x-1">
                   {story.visualAnalysis.colorPalette.map((color, i) => (
                     <div key={i} className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: color }} title={color}></div>
                   ))}
                 </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {QUICK_EDITS.map(preset => (
                <button 
                  key={preset.id}
                  onClick={() => onEdit(preset.prompt)}
                  disabled={!image || isProcessing || isLiveActive}
                  className="flex flex-col items-center justify-center p-4 bg-zinc-900/30 border border-zinc-800 rounded-3xl hover:border-indigo-500/20 transition-all group disabled:opacity-50"
                >
                  <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{preset.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500 group-hover:text-white">{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="pt-4 space-y-3">
               <button onClick={onAnimate} disabled={!image || isProcessing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3">
                 <i className="fa-solid fa-film"></i>
                 <span>Animatic Render</span>
               </button>
               <button onClick={isLiveActive ? stopLiveDiscussion : startLiveDiscussion} disabled={!image} className={`w-full py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest border transition-all ${isLiveActive ? 'bg-rose-600 text-white border-transparent animate-pulse' : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'}`}>
                 {isLiveActive ? 'Terminate Neural Discussion' : 'Brainstorm with Muse (Audio)'}
               </button>
            </div>
          </div>
        </div>

        {/* Studio Manuscript Column (Right) */}
        <div className="xl:col-span-7 space-y-8">
          {story ? (
            <div className="flex flex-col space-y-8 animate-in slide-in-from-right-8 duration-700">
              {/* Manuscript Navigation Tabs */}
              <div className="glass p-1.5 rounded-2xl border border-white/5 flex items-center space-x-1 shadow-lg bg-black/40 self-start overflow-x-auto no-scrollbar">
                {(['narrative', 'visual', 'world', 'prompts'] as const).map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveAnalysisTab(tab)}
                    className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeAnalysisTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Manuscript Area */}
              <div className="glass p-8 md:p-14 rounded-[3rem] space-y-12 shadow-2xl relative border border-white/5 bg-black/60 min-h-[600px] flex flex-col">
                {activeAnalysisTab === 'narrative' && (
                  <div className="flex-1 space-y-10 animate-in fade-in">
                    <div className="space-y-8">
                       <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500">Live Manuscript</span>
                       <div className="space-y-8">
                          {manuscript.map((paragraph, i) => (
                            <p key={i} className="text-2xl md:text-3xl font-serif leading-relaxed text-zinc-100 first-letter:text-7xl first-letter:font-black first-letter:mr-4 first-letter:float-left first-letter:text-indigo-400">
                              {paragraph}
                            </p>
                          ))}
                          {isExpanding && (
                            <div className="flex space-x-2 py-8 animate-pulse">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            </div>
                          )}
                       </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 pt-12 border-t border-white/5">
                      <button 
                        onClick={handleExpandStory}
                        disabled={isExpanding}
                        className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center space-x-3"
                      >
                        <i className="fa-solid fa-plus-large"></i>
                        <span>Extend Narrative</span>
                      </button>
                      <button onClick={onReadAloud} disabled={isReading} className="px-8 py-4 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-500/20 active:scale-95 transition-all">
                        <i className="fa-solid fa-play mr-2"></i>
                        Perform Reading
                      </button>
                      {lastAudioBase64 && (
                        <button onClick={onDownloadAudio} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white">
                          <i className="fa-solid fa-download"></i>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeAnalysisTab === 'visual' && (
                  <div className="space-y-10 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Lighting Dynamics</h4>
                          <p className="text-sm text-zinc-400 font-light italic leading-relaxed">"{story.visualAnalysis.lighting}"</p>
                       </div>
                       <div className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Composition Study</h4>
                          <p className="text-sm text-zinc-400 font-light italic leading-relaxed">"{story.visualAnalysis.composition}"</p>
                       </div>
                    </div>
                    
                    <div className="pt-8 border-t border-white/5 space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Suggested Sensory Palette</h4>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {story.sensoryDetails.map((detail, i) => (
                            <div key={i} className="p-5 bg-white/5 rounded-2xl border border-white/5 italic text-[11px] text-zinc-400 leading-relaxed">
                              "{detail}"
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

                {activeAnalysisTab === 'world' && (
                  <div className="space-y-10 animate-in fade-in">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Neural Worldbuilding</h4>
                       <p className="text-lg font-serif italic text-zinc-300 leading-relaxed">{story.worldBuilding}</p>
                    </div>
                    <div className="pt-8 border-t border-white/5 space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Characters in Frame</h4>
                       <div className="flex flex-wrap gap-3">
                          {story.characters.map((char, i) => (
                            <div key={i} className="px-5 py-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-indigo-400">
                               {char}
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

                {activeAnalysisTab === 'prompts' && (
                  <div className="space-y-10 animate-in fade-in">
                    <div className="space-y-8">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Creative Sparks</h4>
                       <div className="space-y-6">
                          <div className="p-8 bg-zinc-900/40 rounded-[2.5rem] border border-white/5 space-y-3">
                             <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest">Dialogue Prompt</span>
                             <p className="text-base font-serif italic text-zinc-200 leading-relaxed">"{story.writingPrompts.dialogue}"</p>
                          </div>
                          <div className="p-8 bg-zinc-900/40 rounded-[2.5rem] border border-white/5 space-y-3">
                             <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest">Action Prompt</span>
                             <p className="text-base font-serif italic text-zinc-200 leading-relaxed">"{story.writingPrompts.action}"</p>
                          </div>
                          <div className="p-8 bg-zinc-900/40 rounded-[2.5rem] border border-white/5 space-y-3">
                             <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Internal Monologue</span>
                             <p className="text-base font-serif italic text-zinc-200 leading-relaxed">"{story.writingPrompts.internal}"</p>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center glass rounded-[3rem] border-dashed border-2 border-zinc-800/50 text-zinc-700 bg-black/5">
              <i className="fa-solid fa-feather-pointed text-5xl mb-6 opacity-20"></i>
              <h3 className="text-2xl font-serif mb-2 text-zinc-600">The Ink is Dry</h3>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Cast a visual reference to initiate the manuscript flow.</p>
            </div>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-[#09090b]/98 backdrop-blur-3xl z-[200] flex items-center justify-center p-10 text-center animate-in fade-in">
          <div className="space-y-8 max-w-md">
            <div className="w-24 h-24 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
            <h3 className="text-4xl font-serif italic text-white tracking-tighter leading-none">{processingMessage}</h3>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em]">Neural Creative Synthesis Active</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualLab;
