
import React, { useState, useRef, useEffect } from 'react';
import { analyzeImageAndGhostwrite, generateTTS, playTTS, generateVeoVideo, decode, pcmToWav, triggerDownload, downloadFromUrl, notifyUser, ensureApiKey, saveToGallery, getAI, encode, decodeAudioData } from '../services/geminiService';
import { checkPermission, registerChallengeUsage } from '../services/subscriptionService';
import { StoryData, AVAILABLE_VOICES, VoiceName, Language, StoryGenre, UserAccount } from '../types';
import { Modality, LiveServerMessage } from '@google/genai';
import ShareMenu from './ShareMenu';
import { i18n } from '../services/i18nService';

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

const VisualLab: React.FC<VisualLabProps> = ({ language, user, db }) => {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<StoryGenre>('fantasy');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(i18n.t('loading_vision'));
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<StoryData | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [isReading, setIsReading] = useState(false);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'narrative' | 'world' | 'sensory' | 'twists'>('narrative');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shareData, setShareData] = useState<{title: string, text: string, url?: string, fileData?: string, fileType?: string, fileName?: string} | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const perm = checkPermission(user, 'challenge');
    if (!perm.allowed) {
      notifyUser({ code: "auth/quota-exceeded", message: perm.message });
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
      setIsProcessing(true);
      setProcessingMessage(i18n.t('loading_vision'));
      setError(null);
      try {
        const result = await analyzeImageAndGhostwrite(base64, file.type, language, selectedGenre);
        setStory(result);
        if (user && db) await registerChallengeUsage(user, db);
      } catch (err: any) {
        notifyUser(err);
        setError("Analysis failed. Please try a different image.");
      } finally { setIsProcessing(false); }
    };
    reader.readAsDataURL(file);
  };

  const onAnimate = async () => {
    if (!image) return;
    setIsProcessing(true);
    setProcessingMessage(i18n.t('loading_motion'));
    try {
      await ensureApiKey(); 
      const animationPrompt = story 
        ? `Cinematic animation of this scene. Genre: ${selectedGenre}. Atmosphere: ${story.mood}. Narrative direction: ${story.openingParagraph}`
        : `Animate this scene beautifully in the style of ${selectedGenre}`;
      const { url } = await generateVeoVideo(animationPrompt, image.split(',')[1], mimeType);
      if (url) setVideoUrl(url);
      else throw new Error("Video generation not supported in this region.");
    } catch (err: any) {
      notifyUser(err);
    } finally { setIsProcessing(false); }
  };

  const onReadAloud = async () => {
    if (!story) return;
    setIsReading(true);
    try {
      const base64 = await generateTTS(story.openingParagraph, selectedVoice);
      if (base64) {
        setLastAudioBase64(base64);
        await playTTS(base64);
      }
    } catch (err: any) {
      notifyUser(err);
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tighter text-white leading-none">
          {i18n.t('studio_title').split(' ')[0]} <span className="text-indigo-400 italic">{i18n.t('studio_title').split(' ').slice(1).join(' ')}</span>
        </h2>
        <p className="text-zinc-500 text-sm md:text-lg font-light">{i18n.t('studio_subtitle')}</p>
        
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-12 px-4">
        <div className="xl:col-span-5 space-y-6">
          <div 
            className={`aspect-[4/3] glass rounded-[2.5rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-zinc-800/50 hover:border-indigo-500/30 transition-all shadow-2xl relative group bg-black/20`}
          >
            {videoUrl ? (
              <div className="w-full h-full relative group">
                <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover rounded-[2.5rem]" />
                <button onClick={() => setVideoUrl(null)} className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 z-20"><i className="fa-solid fa-xmark"></i></button>
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
                  <i className="fa-solid fa-image-polaroid text-3xl"></i>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em]">Upload Vision Reference</p>
                  <p className="text-[10px] opacity-50 mt-1 uppercase tracking-widest">Image Analysis & Animation</p>
                </div>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFile} />
          
          <div className="glass p-8 rounded-[2.5rem] space-y-8 bg-black/40 shadow-2xl">
            <button onClick={onAnimate} disabled={!image || isProcessing} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-3 active:scale-95">
              {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><i className="fa-solid fa-clapperboard"></i><span>{videoUrl ? 'Regenerate Animation' : i18n.t('btn_animate')}</span></>}
            </button>
            
            {videoUrl && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => downloadFromUrl(videoUrl, 'animation.mp4')} className="py-4 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-3xl font-black uppercase text-[9px] tracking-[0.2em] hover:bg-emerald-600/20 transition-all flex items-center justify-center space-x-3"><i className="fa-solid fa-file-video text-xs"></i><span>{i18n.t('btn_export')}</span></button>
                <button onClick={() => setShareData({title: "My AI Animation", text: "Check this out!", url: videoUrl})} className="py-4 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-3xl font-black uppercase text-[9px] tracking-[0.2em] hover:bg-indigo-600/20 transition-all flex items-center justify-center space-x-3"><i className="fa-solid fa-share-nodes text-xs"></i><span>{i18n.t('btn_share')}</span></button>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-7 space-y-8 lg:sticky lg:top-32">
          {story ? (
            <div className="flex flex-col space-y-8 animate-in slide-in-from-right-8 duration-700">
              <div className="flex justify-between items-center">
                <div className="glass p-1.5 rounded-2xl border border-white/5 flex items-center space-x-1 shadow-lg bg-black/40 self-start">
                  {(['narrative', 'world', 'sensory', 'twists'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveAnalysisTab(tab)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeAnalysisTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>{i18n.t(`tab_${tab}`)}</button>
                  ))}
                </div>
              </div>

              <div className="glass p-8 md:p-12 rounded-[2.5rem] space-y-10 shadow-2xl relative overflow-hidden border border-white/5 bg-black/40 min-h-[500px]">
                {activeAnalysisTab === 'narrative' && (
                  <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="space-y-4">
                       <p className="text-2xl md:text-3xl font-serif leading-relaxed text-zinc-100 first-letter:text-7xl md:first-letter:text-8xl first-letter:font-black first-letter:mr-4 first-letter:float-left first-letter:text-indigo-400 first-letter:mt-3">{story.openingParagraph}</p>
                    </div>
                  </div>
                )}
                {/* Other tabs follow same pattern ... */}

                <div className="pt-12 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-8">
                  <div className="flex flex-col items-center sm:items-start space-y-3 w-full sm:w-auto">
                    <span className="text-[9px] uppercase font-black tracking-widest text-zinc-600">{i18n.t('voice_persona')}</span>
                    <select className="w-full sm:w-auto bg-zinc-900/60 text-[10px] font-black px-5 py-2.5 rounded-xl border border-zinc-800" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value as VoiceName)}>
                      {AVAILABLE_VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center space-x-3 bg-zinc-900/40 p-2 rounded-full border border-white/5">
                    <button onClick={onReadAloud} disabled={isReading} className="w-16 h-16 bg-white text-black hover:bg-zinc-200 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90 disabled:opacity-50">
                      {isReading ? <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin"></div> : <i className="fa-solid fa-microphone-lines text-xl"></i>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center glass rounded-[3rem] border-dashed border-2 border-zinc-800/50 text-zinc-700 bg-black/5">
              <i className="fa-solid fa-feather-pointed text-4xl mb-6 opacity-20"></i>
              <h3 className="text-2xl font-serif mb-3 text-zinc-600">{i18n.t('vault_empty')}</h3>
              <p className="text-[10px] opacity-50 uppercase tracking-[0.3em] font-bold italic">"{i18n.t('vault_subtitle')}"</p>
            </div>
          )}
        </div>
      </div>

      {shareData && <ShareMenu {...shareData} onClose={() => setShareData(null)} />}

      {isProcessing && (
        <div className="fixed inset-0 bg-[#09090b]/98 backdrop-blur-3xl z-[200] flex items-center justify-center p-10 text-center animate-in fade-in duration-700">
          <div className="space-y-12 max-w-xl">
            <div className="relative w-32 h-32 mx-auto">
               <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-serif text-white tracking-tighter">{processingMessage}</h3>
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Neural Synthesis Active</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualLab;
