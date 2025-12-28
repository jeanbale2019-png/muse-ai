
import React, { useState, useRef, useEffect } from 'react';
import { 
  analyzeImageAndGhostwrite, 
  generateTTS, 
  playTTS, 
  editImage, 
  generateVeoVideo, 
  extendVeoVideo,
  decode, 
  pcmToWav, 
  triggerDownload, 
  downloadFromUrl,
  handleGeminiError, 
  ensureApiKey, 
  saveToGallery,
  getAI
} from '../services/geminiService';
import { checkPermission, registerChallengeUsage } from '../services/subscriptionService';
import { StoryData, AVAILABLE_VOICES, VoiceName, Language, StoryGenre, UserAccount } from '../types';
import { i18n } from '../services/i18nService';

interface VisualLabProps {
  language: Language;
  user: UserAccount | null;
  db: any;
}

const GENRES: { id: StoryGenre; label: string; icon: string; color: string }[] = [
  { id: 'fantasy', label: 'Fantasy', icon: 'fa-wand-sparkles', color: 'indigo' },
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
  const [editPrompt, setEditPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lastVideoObject, setLastVideoObject] = useState<any>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [isReading, setIsReading] = useState(false);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'narrative' | 'world' | 'sensory' | 'twists'>('narrative');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const perm = checkPermission(user, 'challenge');
    if (!perm.allowed) {
      setError(perm.message || "Limit reached.");
      return;
    }

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
      setProcessingMessage(i18n.t('loading_vision'));
      setError(null);
      
      try {
        const result = await analyzeImageAndGhostwrite(base64, file.type, language, selectedGenre);
        setStory(result);
        if (user && db) await registerChallengeUsage(user, db);
      } catch (err: any) {
        handleGeminiError(err);
        setError("AI Analysis failed. Please check your connection or API key.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onEdit = async () => {
    if (!image || !editPrompt) return;
    
    setIsProcessing(true);
    setProcessingMessage(i18n.t('loading_alchemy'));
    setError(null);
    try {
      const base64 = image.split(',')[1];
      const result = await editImage(base64, mimeType, editPrompt);
      if (result) {
        setImage(result);
        setEditPrompt('');
        const newStory = await analyzeImageAndGhostwrite(result.split(',')[1], 'image/png', language, selectedGenre);
        setStory(newStory);
      }
    } catch (err: any) {
      handleGeminiError(err);
      setError("Image refinement failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onAnimate = async () => {
    if (!image) return;
    setIsProcessing(true);
    setProcessingMessage(i18n.t('loading_motion'));
    setError(null);
    try {
      await ensureApiKey(); 
      const animationPrompt = story 
        ? `Cinematic high-quality animation for a ${selectedGenre} scene. ${story.mood}. ${story.openingParagraph}`
        : `Animate this ${selectedGenre} scene beautifully with cinematic lighting.`;
      
      const res = await generateVeoVideo(animationPrompt, image.split(',')[1], mimeType);
      setVideoUrl(res.url || null);
      setLastVideoObject(res.videoObject || null);
    } catch (err: any) {
      handleGeminiError(err);
      setError("Animation failed. This feature requires a paid API key.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onExtend = async () => {
    if (!lastVideoObject) return;
    setIsProcessing(true);
    setProcessingMessage("Extending narrative by 7 seconds...");
    setError(null);
    try {
      await ensureApiKey();
      const extendPrompt = editPrompt || (story ? `The sequence continues, unveiling more depth. ${story.mood}` : "The scene continues to unfold.");
      const res = await extendVeoVideo(extendPrompt, lastVideoObject);
      setVideoUrl(res.url || null);
      setLastVideoObject(res.videoObject || null);
      setEditPrompt('');
    } catch (err: any) {
      handleGeminiError(err);
      setError("Extension failed. Only 720p videos can be extended.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onDownloadVideo = () => {
    if (!videoUrl) return;
    downloadFromUrl(videoUrl, `manuscript-video-${Date.now()}.mp4`);
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
      handleGeminiError(err);
    } finally {
      setIsReading(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!lastAudioBase64) return;
    const pcmData = new Int16Array(decode(lastAudioBase64).buffer);
    const wavBlob = pcmToWav(pcmData, 24000);
    const url = URL.createObjectURL(wavBlob);
    triggerDownload(url, `narration-${Date.now()}.wav`);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Area */}
      <div className="text-center space-y-6 max-w-3xl mx-auto px-4">
        <h2 className="text-4xl md:text-6xl font-serif font-light tracking-tighter text-white">
          Manuscript <span className="text-indigo-400 italic">Studio</span>
        </h2>
        <p className="text-zinc-500 text-lg font-light">Cast a visual seed. Let the Muse weave the narrative.</p>
        
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          {GENRES.map((genre) => (
            <button 
              key={genre.id} 
              onClick={() => setSelectedGenre(genre.id)} 
              className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedGenre === genre.id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-zinc-900/50 border-white/5 text-zinc-600 hover:text-zinc-400'}`}
            >
              <i className={`fa-solid ${genre.icon} mr-2`}></i>{genre.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 px-4">
        {/* Left Panel: Visual Source */}
        <div className="xl:col-span-5 space-y-8">
          <div className="group relative aspect-[4/3] glass rounded-[3rem] overflow-hidden border border-white/5 bg-black/40 shadow-2xl flex items-center justify-center">
            {videoUrl ? (
              <>
                <video key={videoUrl} src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                <button 
                  onClick={onDownloadVideo}
                  className="absolute top-6 left-6 w-12 h-12 glass rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 z-10"
                  title="Download Video"
                >
                  <i className="fa-solid fa-download text-white"></i>
                </button>
              </>
            ) : image ? (
              <img src={image} className="w-full h-full object-cover" alt="Source Inspiration" />
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center space-y-6 text-zinc-700 cursor-pointer hover:text-indigo-400 transition-colors"
              >
                <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-cloud-arrow-up text-3xl"></i>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest">Select Narrative Anchor</p>
                  <p className="text-[8px] opacity-40 uppercase tracking-tighter mt-1">Image Reference Required</p>
                </div>
              </div>
            )}
            
            {image && !videoUrl && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-6 right-6 w-12 h-12 glass rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
              >
                <i className="fa-solid fa-sync text-white"></i>
              </button>
            )}
          </div>

          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFile} />

          {/* Refinement Panel */}
          <div className="glass p-8 rounded-[3rem] space-y-6 border border-white/5 bg-[#0c0c0e]/60">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Alchemy Forge</h3>
              <i className="fa-solid fa-wand-sparkles text-zinc-800"></i>
            </div>
            <textarea 
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-indigo-500/50 resize-none min-h-[100px] placeholder:text-zinc-800"
              placeholder="Refine the visual... e.g., 'Add thick cinematic fog' or 'Change the lighting to sunset gold'"
              value={editPrompt}
              onChange={e => setEditPrompt(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={onEdit}
                disabled={!image || isProcessing || !editPrompt}
                className="py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-20"
              >
                Refine Vision
              </button>
              <button 
                onClick={onAnimate}
                disabled={!image || isProcessing}
                className="py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-20 shadow-lg shadow-indigo-600/20"
              >
                Animate Scene
              </button>
            </div>
            
            {videoUrl && (
              <div className="space-y-3">
                <button 
                  onClick={onExtend}
                  disabled={isProcessing}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Extend +7s Narrative</span>
                </button>
                <button 
                  onClick={onDownloadVideo}
                  className="w-full py-3 bg-zinc-800 text-zinc-400 rounded-2xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-file-video"></i>
                  <span>Download Video</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: The Manuscript */}
        <div className="xl:col-span-7 flex flex-col">
          {story ? (
            <div className="glass p-10 md:p-16 rounded-[3.5rem] bg-[#0c0c0e]/80 border border-white/5 shadow-3xl flex-1 flex flex-col min-h-[600px] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <i className="fa-solid fa-feather text-8xl"></i>
              </div>

              {/* Tabs */}
              <div className="flex space-x-8 border-b border-white/5 mb-10 pb-4 overflow-x-auto no-scrollbar">
                {(['narrative', 'world', 'sensory', 'twists'] as const).map(tab => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)} 
                    className={`text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    {i18n.t(`tab_${tab}`)}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'narrative' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500/50">Mood: {story.mood}</span>
                       <p className="text-3xl md:text-4xl font-serif italic text-white leading-[1.6] first-letter:text-7xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-indigo-500">
                        {story.openingParagraph}
                      </p>
                    </div>
                    
                    <div className="space-y-4 pt-8 border-t border-white/5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Dramatis Personae</h4>
                      <div className="flex flex-wrap gap-2">
                        {story.characters?.map((char, i) => (
                          <span key={i} className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[10px] text-indigo-300 font-bold uppercase tracking-widest">
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'world' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Scene Analysis</h4>
                      <p className="text-xl font-light text-zinc-300 leading-relaxed italic">{story.sceneAnalysis}</p>
                    </div>
                    <div className="space-y-4 pt-8 border-t border-white/5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">World Building</h4>
                      <p className="text-sm text-zinc-500 leading-relaxed">{story.worldBuilding}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'sensory' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4">
                    {story.sensoryDetails?.map((detail, i) => (
                      <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-[2rem] flex items-center space-x-4 group hover:bg-white/10 transition-all">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-indigo-500 text-xs">
                          {i + 1}
                        </div>
                        <p className="text-xs text-zinc-400 italic font-medium">"{detail}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'twists' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    {story.plotTwists?.map((twist, i) => (
                      <div key={i} className="p-8 bg-rose-500/5 border border-rose-500/10 rounded-[2.5rem] relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                          <i className="fa-solid fa-shuffle text-4xl"></i>
                        </div>
                        <p className="text-lg font-serif italic text-rose-200">"{twist}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Narrator Controls */}
              <div className="pt-10 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Narrator Persona</span>
                  <select 
                    value={selectedVoice} 
                    onChange={e => setSelectedVoice(e.target.value as VoiceName)}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-indigo-400 focus:ring-0 outline-none cursor-pointer"
                  >
                    {AVAILABLE_VOICES.map(v => <option key={v.name} value={v.name} className="bg-[#0c0c0e]">{v.label}</option>)}
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  {lastAudioBase64 && (
                    <button 
                      onClick={handleDownloadAudio}
                      className="w-12 h-12 glass rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                      title="Export Narrator Voice"
                    >
                      <i className="fa-solid fa-download"></i>
                    </button>
                  )}
                  <button 
                    onClick={onReadAloud}
                    disabled={isReading}
                    className="w-16 h-16 bg-white text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                  >
                    {isReading ? (
                      <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <i className="fa-solid fa-volume-high text-xl"></i>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 glass rounded-[3.5rem] border-2 border-dashed border-zinc-900 flex flex-col items-center justify-center text-center p-12 space-y-6">
              <i className="fa-solid fa-feather-pointed text-5xl text-zinc-900"></i>
              <div className="space-y-2">
                <h3 className="text-xl font-serif text-zinc-800">The Script Awaits</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-800 opacity-40">Cast your vision anchor to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-[#09090b]/95 backdrop-blur-3xl z-[200] flex items-center justify-center text-center animate-in fade-in">
          <div className="space-y-12">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-serif text-white tracking-tighter">{processingMessage}</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Consulting the Oracle</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[250] animate-in slide-in-from-bottom-8">
          <div className="bg-rose-600 text-white px-8 py-4 rounded-2xl flex items-center space-x-4 shadow-2xl">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualLab;
