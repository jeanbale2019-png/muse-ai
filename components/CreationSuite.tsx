
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateProImage, generateVeoVideo, generateLogo, triggerDownload, downloadFromUrl, getAI, handleGeminiError, generateTTS, decode, decodeAudioData, saveToGallery, getGallery, playTTS, pcmToWav } from '../services/geminiService';
import { AspectRatio, ImageSize, VoiceName, Language, UI_TRANSLATIONS, AVAILABLE_VOICES, UserAccount } from '../types';

interface CreationSuiteProps {
  language: Language;
  // Fix: Adding user prop to resolve TS mismatch in App.tsx
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
  const [prompt, setPrompt] = useState('**Setting**: A celestial library where books are made of starlight.\n\n**Details**: The library walls are carved from *obsidian*, reflecting the swirling nebulae outside.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [scriptMode, setScriptMode] = useState<'edit' | 'preview'>('edit');
  
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [resultLogo, setResultLogo] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'compose' | 'preview' | 'forge' | 'gallery'>('compose');
  
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [videoResolution, setVideoResolution] = useState<"720p" | "1080p">("720p");
  const [lastGeneratedQuality, setLastGeneratedQuality] = useState<string>('');

  const [initialImage, setInitialImage] = useState<{data: string, type: string} | null>(null);
  const [savedCreations, setSavedCreations] = useState<GalleryItem[]>([]);
  const [showSavedToast, setShowSavedToast] = useState(false);
  
  const initialFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // TTS State
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [narrationBase64, setNarrationBase64] = useState<string | null>(null);
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [isPlayingNarration, setIsPlayingNarration] = useState(false);

  useEffect(() => {
    if (editorMode === 'gallery') {
      setSavedCreations(getGallery());
    }
  }, [editorMode]);

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 4000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-400 font-black">$1</strong>');
      formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic text-zinc-300 font-serif">$1</em>');
      formatted = formatted.replace(/^# (.*$)/g, '<h1 class="text-3xl font-serif text-white mb-4">$1</h1>');
      formatted = formatted.replace(/^## (.*$)/g, '<h2 class="text-2xl font-serif text-white mb-3">$1</h2>');
      return (
        <p key={i} className="mb-3 text-lg md:text-xl font-light leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted || '&nbsp;' }} />
      );
    });
  };

  const insertMarkdown = (tag: string, endTag: string = tag) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + tag + selection + endTag + after;
    setPrompt(newText);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, end + tag.length);
      }
    }, 0);
  };

  const handleGenImage = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);
    setResultImage(null);
    try {
      const res = await generateProImage(prompt.replace(/\*\*|\*/g, ''), aspectRatio, imageSize);
      setResultImage(res);
      setLastGeneratedQuality(imageSize);
      setEditorMode('preview');
    } catch (err: any) { 
      handleGeminiError(err);
      setError(err.message || "Failed to generate image.");
    } 
    finally { setIsGenerating(false); }
  };

  const handleGenVideo = async () => {
    setIsGenerating(true);
    setError(null);
    setResultVideo(null);
    try {
      const res = await generateVeoVideo(prompt.replace(/\*\*|\*/g, ''), initialImage?.data, initialImage?.type, (aspectRatio === '9:16' ? '9:16' : '16:9'), videoResolution);
      setResultVideo(res.url);
      setLastGeneratedQuality(videoResolution);
      setEditorMode('preview');
    } catch (err: any) { 
      handleGeminiError(err); 
      setError(err.message || "Failed to generate video.");
    } 
    finally { setIsGenerating(false); }
  };

  const handleGenerateNarration = async () => {
    if (!prompt) return;
    setIsGeneratingNarration(true);
    setError(null);
    try {
      const cleanText = prompt.replace(/\*\*|\*/g, '');
      const base64 = await generateTTS(cleanText, selectedVoice);
      setNarrationBase64(base64);
    } catch (err: any) {
      handleGeminiError(err);
      setError(err.message || "Narrator synthesis failed.");
    } finally {
      setIsGeneratingNarration(false);
    }
  };

  const handlePreviewNarration = async () => {
    if (!narrationBase64) return;
    setIsPlayingNarration(true);
    try {
      await playTTS(narrationBase64);
    } finally {
      setIsPlayingNarration(false);
    }
  };

  const handleSyncPlay = async () => {
    if (videoRef.current && narrationBase64) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      handlePreviewNarration();
    }
  };

  const handleSaveToGallery = (type: 'image' | 'video' | 'logo', url: string) => {
    saveToGallery({ type, url, prompt, quality: lastGeneratedQuality });
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleDownloadVideo = () => {
    if (!resultVideo) return;
    downloadFromUrl(resultVideo, `muse-video-${Date.now()}.mp4`);
  };

  const handleDownloadImage = () => {
    if (!resultImage) return;
    triggerDownload(resultImage, `muse-still-${Date.now()}.png`);
  };

  const handleDownloadLogo = () => {
    if (!resultLogo) return;
    triggerDownload(resultLogo, `muse-logo-${Date.now()}.png`);
  };

  const handleDownloadNarration = () => {
    if (!narrationBase64) return;
    const pcmData = new Int16Array(decode(narrationBase64).buffer);
    const wavBlob = pcmToWav(pcmData, 24000);
    const url = URL.createObjectURL(wavBlob);
    triggerDownload(url, `narration-${Date.now()}.wav`);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-40 text-white px-4">
      <div className="text-center space-y-6">
        <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tight text-white">{t.studio} <span className="text-indigo-400 italic">{t.omni}</span></h2>
        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
           <button onClick={() => {setEditorMode('compose'); setError(null);}} className={`text-[10px] font-black uppercase tracking-widest pb-1 transition-all ${editorMode === 'compose' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-500'}`}>Director's Desk</button>
           <button onClick={() => {setEditorMode('forge'); setError(null);}} className={`text-[10px] font-black uppercase tracking-widest pb-1 transition-all ${editorMode === 'forge' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-500'}`}>Logo Forge</button>
           <button onClick={() => {setEditorMode('gallery'); setError(null);}} className={`text-[10px] font-black uppercase tracking-widest pb-1 transition-all ${editorMode === 'gallery' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-500'}`}>Private Vault</button>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-top-4">
           <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-[2rem] flex items-start space-x-4 text-rose-400">
             <i className="fa-solid fa-triangle-exclamation text-xl mt-1"></i>
             <div className="flex-1 space-y-2">
                <p className="text-xs font-black uppercase tracking-widest">Master Studio Error</p>
                <p className="text-sm italic leading-relaxed">{error}</p>
                <button onClick={() => setError(null)} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Dismiss Alert</button>
             </div>
           </div>
        </div>
      )}

      {editorMode === 'gallery' ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             {savedCreations.length === 0 ? (
               <div className="col-span-full py-20 text-center glass rounded-[2rem] border-dashed border-zinc-800 text-zinc-600">
                  <i className="fa-solid fa-vault text-4xl mb-4 opacity-20"></i>
                  <p className="text-xs uppercase font-black tracking-widest">Le coffre est vide</p>
               </div>
             ) : (
               savedCreations.map((item) => (
                 <div key={item.id} className="glass rounded-[2rem] overflow-hidden group border border-white/5 bg-black/40 hover:border-indigo-500/30 transition-all shadow-xl">
                   <div className="aspect-square relative">
                      {item.type === 'video' ? (
                        <video src={item.url} className="w-full h-full object-cover" loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                      ) : (
                        <img src={item.url} className="w-full h-full object-cover" alt="Saved creation" />
                      )}
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-indigo-400 border border-white/10">
                         {item.type} • {item.quality}
                      </div>
                   </div>
                   <div className="p-5 space-y-3">
                      <p className="text-[10px] text-zinc-400 line-clamp-2 italic">"{item.prompt}"</p>
                      <div className="flex justify-between items-center">
                         <span className="text-[8px] text-zinc-600 font-bold uppercase">{new Date(item.timestamp).toLocaleDateString()}</span>
                         <button onClick={() => item.type === 'video' ? downloadFromUrl(item.url, `muse-video-${item.id}.mp4`) : triggerDownload(item.url, `muse-still-${item.id}.png`)} className="text-zinc-400 hover:text-white transition-colors">
                           <i className="fa-solid fa-download"></i>
                         </button>
                      </div>
                   </div>
                 </div>
               ))
             )}
           </div>
        </div>
      ) : editorMode === 'forge' ? (
        <div className="max-w-4xl mx-auto animate-in zoom-in-95">
           <div className="glass p-10 rounded-[3rem] text-center bg-[#0c0c0e] border-white/5 space-y-10 shadow-2xl">
              <h3 className="text-3xl font-serif">Brand <span className="text-indigo-400 italic">Forge</span></h3>
              <div className="max-w-lg mx-auto space-y-6">
                 <input className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-8 py-5 text-xl text-center outline-none focus:border-indigo-500/50" placeholder="Nom de la marque..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                 <button onClick={async () => { setIsGenerating(true); setError(null); try { const res = await generateLogo(prompt); setResultLogo(res); setLastGeneratedQuality("Vector"); } catch(e: any) { handleGeminiError(e); setError(e.message || "Forge process failed."); } finally { setIsGenerating(false); } }} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Forger l'identité</button>
              </div>
              {resultLogo && (
                <div className="pt-8 flex flex-col items-center space-y-8 animate-in fade-in">
                  <div className="p-12 glass rounded-3xl shadow-inner bg-white/5 relative group">
                    <img src={resultLogo} className="w-64 h-64 object-contain" alt="Logo" />
                    <button onClick={handleDownloadLogo} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                       <i className="fa-solid fa-download text-3xl text-white"></i>
                    </button>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button onClick={handleDownloadLogo} className="px-8 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">
                       Export PNG
                    </button>
                    <button onClick={() => handleSaveToGallery('logo', resultLogo)} className="px-8 py-3 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/20 transition-all">
                       Save to Vault
                    </button>
                  </div>
                </div>
              )}
           </div>
        </div>
      ) : (
        <div className="glass rounded-[3rem] overflow-hidden border border-white/5 bg-[#0c0c0e]/50 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-full min-h-[600px]">
             {/* LEFT: Controls */}
             <div className="p-8 border-r border-white/5 space-y-10 lg:block hidden">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Canvas de base</label>
                  <div onClick={() => initialFileInputRef.current?.click()} className="aspect-video glass rounded-2xl border-2 border-dashed border-zinc-800 hover:border-indigo-500/30 transition-all flex items-center justify-center cursor-pointer overflow-hidden relative group">
                    {initialImage ? (
                      <>
                        <img src={`data:${initialImage.type};base64,${initialImage.data}`} className="w-full h-full object-cover" alt="Ref" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <i className="fa-solid fa-sync text-white"></i>
                        </div>
                      </>
                    ) : (
                      <i className="fa-solid fa-plus text-zinc-800 text-2xl"></i>
                    )}
                  </div>
                  <input type="file" min-h-0 min-w-0 ref={initialFileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setInitialImage({ data: (reader.result as string).split(',')[1], type: file.type });
                      reader.readAsDataURL(file);
                    }
                  }} />
                </div>

                <div className="space-y-6 pt-6 border-t border-zinc-900">
                   <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-zinc-600 uppercase">Narration Voice</span>
                        {narrationBase64 && (
                           <button onClick={handleDownloadNarration} className="text-indigo-400 hover:text-white transition-colors">
                              <i className="fa-solid fa-file-arrow-down text-xs"></i>
                           </button>
                        )}
                      </div>
                      <select 
                        value={selectedVoice}
                        onChange={e => setSelectedVoice(e.target.value as VoiceName)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-4 py-3 outline-none focus:border-indigo-500/50"
                      >
                        {AVAILABLE_VOICES.map(v => (
                          <option key={v.name} value={v.name}>{v.label}</option>
                        ))}
                      </select>
                   </div>
                   <div className="flex flex-col space-y-2">
                     <button 
                      onClick={handleGenerateNarration}
                      disabled={isGeneratingNarration || !prompt}
                      className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-2 border border-white/5 active:scale-95"
                     >
                       {isGeneratingNarration ? (
                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       ) : (
                         <>
                           <i className="fa-solid fa-waveform-lines text-indigo-400"></i>
                           <span>{narrationBase64 ? 'Regenerate Audio' : 'Synthesize Voice'}</span>
                         </>
                       )}
                     </button>
                     {narrationBase64 && (
                        <button onClick={handlePreviewNarration} className="w-full py-2 text-[8px] font-black uppercase text-indigo-400/60 hover:text-indigo-400 tracking-[0.2em] transition-all">
                           Listen Preview
                        </button>
                     )}
                   </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-zinc-900">
                   <div className="space-y-3">
                      <span className="text-[9px] font-black text-zinc-600 uppercase">Aspect Ratio</span>
                      <div className="grid grid-cols-2 gap-2">
                        {["16:9", "9:16", "1:1"].map(ratio => (
                          <button key={ratio} onClick={() => setAspectRatio(ratio as any)} className={`py-3 text-[10px] border rounded-xl transition-all ${aspectRatio === ratio ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-zinc-800 text-zinc-600'}`}>{ratio}</button>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-3">
                      <span className="text-[9px] font-black text-zinc-600 uppercase">Render Detail</span>
                      <div className="grid grid-cols-3 gap-2">
                        {["1K", "2K", "4K"].map(size => (
                          <button key={size} onClick={() => setImageSize(size as any)} className={`py-3 text-[10px] border rounded-xl transition-all ${imageSize === size ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-zinc-800 text-zinc-600'}`}>{size}</button>
                        ))}
                      </div>
                   </div>
                </div>
             </div>

             {/* CENTER: Editor */}
             <div className="lg:col-span-2 flex flex-col">
                <div className="flex-1 p-8 md:p-12 space-y-8 flex flex-col">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500/50">Director's Script</span>
                      <div className="flex bg-zinc-900 p-1 rounded-xl">
                        <button onClick={() => setScriptMode('edit')} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg ${scriptMode === 'edit' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600'}`}>Edit</button>
                        <button onClick={() => setScriptMode('preview')} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg ${scriptMode === 'preview' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600'}`}>Preview</button>
                      </div>
                   </div>
                   
                   {scriptMode === 'edit' ? (
                     <div className="flex-1 flex flex-col space-y-4">
                       <div className="flex items-center space-x-2 bg-zinc-900/50 p-2 rounded-xl border border-white/5 self-start">
                          <button onClick={() => insertMarkdown('**')} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Bold">
                             <i className="fa-solid fa-bold text-xs"></i>
                          </button>
                          <button onClick={() => insertMarkdown('*')} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Italic">
                             <i className="fa-solid fa-italic text-xs"></i>
                          </button>
                          <button onClick={() => insertMarkdown('# ', '')} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Header 1">
                             <i className="fa-solid fa-heading text-xs"></i>
                          </button>
                          <button onClick={() => insertMarkdown('## ', '')} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Header 2">
                             <i className="fa-solid fa-heading text-[10px]"></i>
                          </button>
                          <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                          <button onClick={() => setPrompt('')} className="w-8 h-8 flex items-center justify-center hover:bg-rose-500/10 rounded-lg text-zinc-600 hover:text-rose-500 transition-colors" title="Clear">
                             <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                       </div>
                       
                       <textarea 
                        ref={textareaRef}
                        className="w-full flex-1 bg-transparent text-xl md:text-3xl font-serif italic text-zinc-200 outline-none resize-none leading-relaxed placeholder:text-zinc-800" 
                        placeholder="Compose your vision..." 
                        value={prompt} 
                        onChange={e => setPrompt(e.target.value)} 
                       />
                     </div>
                   ) : (
                     <div className="w-full flex-1 overflow-y-auto no-scrollbar">{renderMarkdown(prompt)}</div>
                   )}

                   <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                      <button onClick={handleGenImage} disabled={isGenerating} className="group relative py-5 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all overflow-hidden shadow-xl">
                        <span className="relative z-10">Image Studio ({imageSize})</span>
                      </button>
                      <button onClick={handleGenVideo} disabled={isGenerating} className="group relative py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-500/20 overflow-hidden">
                        <span className="relative z-10">Animate Vision ({videoResolution})</span>
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {(resultImage || resultVideo) && editorMode === 'preview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8">
           {resultImage && (
             <div className="glass p-8 rounded-[3rem] space-y-6 bg-black/40 border-white/5 relative group">
                <img src={resultImage} className="w-full aspect-video object-cover rounded-2xl shadow-2xl" alt="Result" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={handleDownloadImage} className="py-4 bg-zinc-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center space-x-2 hover:bg-zinc-700 transition-colors active:scale-95">
                    <i className="fa-solid fa-download"></i>
                    <span>Export PNG</span>
                  </button>
                  <button onClick={() => handleSaveToGallery('image', resultImage!)} className="w-full py-4 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center space-x-2 hover:bg-indigo-500/20 active:scale-95 transition-all">
                    <i className="fa-solid fa-bookmark"></i>
                    <span>Store in Vault</span>
                  </button>
                </div>
             </div>
           )}
           {resultVideo && (
             <div className="glass p-8 rounded-[3rem] space-y-6 bg-black/40 border-white/5 relative group">
                <video ref={videoRef} src={resultVideo} controls className="w-full aspect-video object-cover rounded-2xl shadow-2xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={handleDownloadVideo} className="py-4 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center space-x-2 hover:bg-emerald-600/20 transition-all active:scale-95">
                    <i className="fa-solid fa-download"></i>
                    <span>Export MP4</span>
                  </button>
                  <button onClick={() => handleSaveToGallery('video', resultVideo!)} className="w-full py-4 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center space-x-2 hover:bg-indigo-500/20 active:scale-95 transition-all">
                    <i className="fa-solid fa-bookmark"></i>
                    <span>Store in Vault</span>
                  </button>
                </div>
                {narrationBase64 && (
                  <button 
                    onClick={handleSyncPlay} 
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center space-x-3 shadow-2xl hover:bg-indigo-500 active:scale-95 transition-all"
                  >
                    <i className="fa-solid fa-play"></i>
                    <span>Play Synchronized (Video + Voice)</span>
                  </button>
                )}
             </div>
           )}
        </div>
      )}

      {showSavedToast && (
        <div className="fixed bottom-10 right-10 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl animate-in slide-in-from-right-8 duration-500 z-[200] flex items-center space-x-3">
           <i className="fa-solid fa-circle-check"></i>
           <span>Vision archived successfully</span>
        </div>
      )}

      {isGenerating && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-8 animate-in fade-in">
           <div className="max-w-md w-full text-center space-y-12">
              <div className="relative w-32 h-32 mx-auto">
                 <div className="absolute inset-0 border-2 border-indigo-500/10 rounded-full"></div>
                 <div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                 <div className="absolute inset-4 border border-white/5 rounded-full animate-pulse"></div>
              </div>
              <div className="space-y-4">
                 <h3 className="text-3xl font-serif text-white tracking-tight">{LOADING_MESSAGES[loadingStep]}</h3>
                 <div className="flex flex-col space-y-2 opacity-50">
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Neural Scaling in progress</p>
                   <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Processing high-fidelity cinematic frame</p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreationSuite;
