
import React, { useState, useRef, useEffect } from 'react';
import { generateProImage, generateVeoVideo, extendVeoVideo, generateLogo, triggerDownload, downloadFromUrl, handleGeminiError, generateTTS, decode, decodeAudioData, saveToGallery, getGallery, playTTS, pcmToWav } from '../services/geminiService';
import { AspectRatio, ImageSize, VoiceName, Language, UI_TRANSLATIONS, AVAILABLE_VOICES, UserAccount } from '../types';
import ShareMenu from './ShareMenu';

interface CreationSuiteProps {
  language: Language;
  user: UserAccount | null;
}

const LOADING_MESSAGES = [
  "Forging brand identity...",
  "Distilling creativity into geometry...",
  "Synthesizing the essence of intelligence...",
  "Applying minimalist neural filters...",
  "Vectorizing the Muse...",
  "Almost there! Finalizing the brand mark..."
];

const VIDEO_LOADING_MESSAGES = [
  "Initializing Veo Cinema Model...",
  "Analyzing scene composition...",
  "Rendering temporal frames...",
  "Applying cinematic lighting...",
  "Smoothing motion vectors...",
  "Finalizing video stream..."
];

interface GalleryItem {
  id: string;
  type: 'image' | 'video' | 'logo';
  url: string;
  prompt: string;
  timestamp: number;
  quality: string;
}

const CreationSuite: React.FC<CreationSuiteProps> = ({ language, user }) => {
  const t = (UI_TRANSLATIONS[language] || UI_TRANSLATIONS['en-US'] || {}) as Record<string, string>;
  const [prompt, setPrompt] = useState('**Setting**: A futuristic city bathed in neon rain.\n\n**Action**: A sleek hovercar glides silently past a holographic billboard.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('video');
  
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [lastVideoObject, setLastVideoObject] = useState<any>(null);
  const [editorMode, setEditorMode] = useState<'compose' | 'preview' | 'gallery'>('compose');
  
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [videoResolution, setVideoResolution] = useState<"720p" | "1080p">("720p");
  const [lastGeneratedQuality, setLastGeneratedQuality] = useState<string>('');

  const [initialImage, setInitialImage] = useState<{data: string, type: string} | null>(null);
  const [savedCreations, setSavedCreations] = useState<GalleryItem[]>([]);
  
  const initialFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (editorMode === 'gallery') {
      setSavedCreations(getGallery());
    }
  }, [editorMode]);

  useEffect(() => {
    let interval: any;
    let progressInterval: any;
    const msgs = activeTab === 'video' ? VIDEO_LOADING_MESSAGES : LOADING_MESSAGES;
    
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % msgs.length);
      }, 4000);
      setProgress(0);
      const duration = activeTab === 'video' ? 60 : 10;
      progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + (100 / duration), 95));
      }, 1000);
    } else {
      setLoadingStep(0);
      setProgress(0);
    }
    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [isGenerating, activeTab]);

  const handleGenImage = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);
    setResultImage(null);
    try {
      const res = await generateProImage(prompt.replace(/\*\*|\*/g, ''), aspectRatio, imageSize);
      if (res) {
        setResultImage(res);
        setLastGeneratedQuality(imageSize);
        setEditorMode('preview');
      }
    } catch (err: any) { 
      handleGeminiError(err);
      setError(err.message || "Failed to generate image.");
    } finally { 
      setIsGenerating(false); 
    }
  };

  const handleGenVideo = async () => {
    setIsGenerating(true);
    setError(null);
    setResultVideo(null);
    abortControllerRef.current = new AbortController();
    try {
      const res = await generateVeoVideo(
        prompt.replace(/\*\*|\*/g, ''), 
        initialImage?.data, 
        initialImage?.type, 
        (aspectRatio === '9:16' ? '9:16' : '16:9'), 
        videoResolution,
        abortControllerRef.current.signal
      );
      if (res) {
        setResultVideo(res.url);
        setLastVideoObject(res.videoObject);
        setLastGeneratedQuality(videoResolution);
        setEditorMode('preview');
      }
    } catch (err: any) { 
      if (err.message !== "Cancelled by user") {
        handleGeminiError(err); 
        setError(err.message || "Failed to generate video.");
      }
    } finally { 
      setIsGenerating(false); 
      abortControllerRef.current = null;
    }
  };

  const handleExtendVideo = async () => {
    if (!lastVideoObject) return;
    setIsGenerating(true);
    setError(null);
    abortControllerRef.current = new AbortController();
    try {
      const res = await extendVeoVideo(prompt.replace(/\*\*|\*/g, ''), lastVideoObject, abortControllerRef.current.signal);
      if (res) {
        setResultVideo(res.url);
        setLastVideoObject(res.videoObject);
        setLastGeneratedQuality('720p (Extended)');
        setEditorMode('preview');
      }
    } catch (err: any) {
      if (err.message !== "Cancelled by user") {
        handleGeminiError(err);
        setError("Failed to extend video. Please ensure the original video is compatible.");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-serif font-black tracking-tight text-white italic">Visual <span className="text-indigo-400">Forge</span></h1>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.5em]">Neural Media Generation Suite</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-8">
          <div className="glass p-8 rounded-[2.5rem] border border-white/5 space-y-6">
            <div className="flex p-1 bg-white/5 rounded-2xl">
              <button onClick={() => setActiveTab('video')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'video' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500 hover:text-white'}`}>Video (Veo)</button>
              <button onClick={() => setActiveTab('image')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'image' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500 hover:text-white'}`}>Image (Pro)</button>
            </div>

            <div className="space-y-4">
              <div 
                onClick={() => initialFileInputRef.current?.click()}
                className="aspect-video w-full glass rounded-3xl border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden group"
              >
                {initialImage ? (
                  <img src={`data:${initialImage.type};base64,${initialImage.data}`} className="w-full h-full object-cover" alt="init" />
                ) : (
                  <div className="flex flex-col items-center space-y-2 opacity-30 group-hover:opacity-60 transition-opacity">
                    <i className="fa-solid fa-image text-3xl"></i>
                    <span className="text-[9px] font-black uppercase tracking-widest">Initial Context (Optional)</span>
                  </div>
                )}
              </div>
              <input type="file" ref={initialFileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setInitialImage({
                      data: (reader.result as string).split(',')[1],
                      type: file.type
                    });
                  };
                  reader.readAsDataURL(file);
                }
              }} />
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Aspect Ratio</span>
                <div className="flex space-x-2">
                  {["16:9", "9:16", "1:1"].map(ratio => (
                    <button key={ratio} onClick={() => setAspectRatio(ratio as AspectRatio)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black border transition-all ${aspectRatio === ratio ? 'bg-white text-black border-transparent' : 'bg-white/5 text-zinc-500 border-white/5'}`}>{ratio}</button>
                  ))}
                </div>
              </div>

              {activeTab === 'video' ? (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Resolution</span>
                  <div className="flex space-x-2">
                    {["720p", "1080p"].map(res => (
                      <button key={res} onClick={() => setVideoResolution(res as any)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black border transition-all ${videoResolution === res ? 'bg-white text-black border-transparent' : 'bg-white/5 text-zinc-500 border-white/5'}`}>{res}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Image Size</span>
                  <div className="flex space-x-2">
                    {["1K", "2K", "4K"].map(sz => (
                      <button key={sz} onClick={() => setImageSize(sz as ImageSize)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black border transition-all ${imageSize === sz ? 'bg-white text-black border-transparent' : 'bg-white/5 text-zinc-500 border-white/5'}`}>{sz}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="glass p-8 rounded-[3rem] border border-white/5 space-y-8">
            <div className="space-y-2">
              <h3 className="text-sm font-serif italic text-zinc-400">Prompting the Muse...</h3>
              <textarea 
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-transparent text-3xl md:text-5xl font-serif italic outline-none resize-none placeholder:text-zinc-800 leading-tight min-h-[250px]"
                placeholder="Describe your vision..."
              />
            </div>

            <div className="flex items-center justify-between pt-8 border-t border-white/5">
              <div className="flex items-center space-x-2">
                <button onClick={() => setEditorMode('gallery')} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-indigo-400 transition-colors">
                  <i className="fa-solid fa-box-archive"></i>
                </button>
              </div>

              <div className="flex items-center space-x-4">
                {isGenerating ? (
                  <button onClick={() => abortControllerRef.current?.abort()} className="px-8 py-4 bg-rose-600/10 text-rose-500 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-rose-500/20 hover:bg-rose-600 hover:text-white transition-all">Cancel Generation</button>
                ) : (
                  <button 
                    onClick={activeTab === 'video' ? handleGenVideo : handleGenImage}
                    disabled={!prompt}
                    className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-30"
                  >
                    Forge {activeTab === 'video' ? 'Cinematic Stream' : 'Visual Asset'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="glass p-12 rounded-[3rem] border border-white/5 flex flex-col items-center justify-center space-y-8 animate-in slide-in-from-bottom-8">
               <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
               <div className="text-center space-y-2">
                  <p className="text-xl font-serif italic text-white animate-pulse">{activeTab === 'video' ? VIDEO_LOADING_MESSAGES[loadingStep] : LOADING_MESSAGES[loadingStep]}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Neutral Sync in progress • {Math.round(progress)}%</p>
               </div>
               <div className="w-full max-w-md h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
               </div>
            </div>
          )}

          {error && (
            <div className="p-6 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center space-x-4 text-rose-400 animate-in shake">
               <i className="fa-solid fa-triangle-exclamation text-xl"></i>
               <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
            </div>
          )}

          {editorMode === 'preview' && (resultImage || resultVideo) && !isGenerating && (
            <div className="glass rounded-[3rem] overflow-hidden border border-white/5 animate-in zoom-in-95 duration-700 shadow-2xl">
               <div className="aspect-video bg-black relative">
                  {resultVideo ? (
                    <video ref={videoRef} src={resultVideo} controls className="w-full h-full object-contain" autoPlay loop />
                  ) : (
                    <img src={resultImage!} className="w-full h-full object-contain" alt="result" />
                  )}
               </div>
               <div className="p-8 flex items-center justify-between bg-black/40">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Generation Complete</span>
                     <span className="text-xs font-serif italic text-zinc-500">Quality: {lastGeneratedQuality} • Forge v3.1</span>
                  </div>
                  <div className="flex items-center space-x-3">
                     {resultVideo && (
                       <button onClick={handleExtendVideo} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Extend Video (7s)</button>
                     )}
                     <button onClick={() => triggerDownload(resultVideo || resultImage!, `creation-${Date.now()}`)} className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-all"><i className="fa-solid fa-download"></i></button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreationSuite;
