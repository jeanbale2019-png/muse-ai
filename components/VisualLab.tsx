
import React, { useState, useRef, useEffect } from 'react';
import { 
  analyzeImageAndGhostwrite, 
  generateTTS, 
  playTTS, 
  decode, 
  pcmToWav, 
  triggerDownload,
  handleGeminiError,
  generateVeoVideo
} from '../services/geminiService';
import { StoryData, AVAILABLE_VOICES, VoiceName, Language, UserAccount } from '../types';

interface VisualLabProps {
  language: Language;
  user: UserAccount | null;
  db: any;
}

const VisualLab: React.FC<VisualLabProps> = ({ language }) => {
  const [sourceFile, setSourceFile] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [analysisFrame, setAnalysisFrame] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [story, setStory] = useState<StoryData | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Video States
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Extract a frame from a video file to use for Gemini analysis
  const captureVideoFrame = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.currentTime = 0.5; // Seek a bit to avoid black start frames
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl.split(',')[1]);
      };

      video.onerror = (e) => reject(e);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const isVideo = file.type.startsWith('video/');
    const fileUrl = URL.createObjectURL(file);
    
    setSourceFile({ url: fileUrl, type: isVideo ? 'video' : 'image' });
    setIsAnalyzing(true);
    setLastAudioBase64(null);
    setStory(null);
    setVideoUrl(null);

    try {
      let base64ForAnalysis = '';
      let mimeTypeForAnalysis = 'image/jpeg';

      if (isVideo) {
        base64ForAnalysis = await captureVideoFrame(file);
      } else {
        const reader = new FileReader();
        base64ForAnalysis = await new Promise((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        mimeTypeForAnalysis = file.type;
      }

      setAnalysisFrame(base64ForAnalysis);
      const result = await analyzeImageAndGhostwrite(base64ForAnalysis, mimeTypeForAnalysis, language as any);
      setStory(result);
    } catch (err: any) {
      console.error(err);
      setError("Analysis failed. Please try another file or check your connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateCinematicPreview = async () => {
    if (!analysisFrame || !story) return;
    setIsGeneratingVideo(true);
    setError(null);
    try {
      const prompt = `Cinematic visualization: ${story.openingParagraph}. Mood: ${story.mood}. Sensory details: ${story.sensoryDetails.join(', ')}.`;
      const res = await generateVeoVideo(prompt, analysisFrame, 'image/jpeg', '16:9', '720p');
      if (res) {
        setVideoUrl(res.url);
      }
    } catch (err: any) {
      handleGeminiError(err);
      setError("Cinematic generation failed. Quota might be reached.");
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleReadAloud = async () => {
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
      console.error(err);
      setError("Audio synthesis failed.");
    } finally {
      setIsReading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.volume = volume;
    }
  }, [playbackSpeed, volume]);

  const onDownloadAudio = () => {
    if (!lastAudioBase64) return;
    const pcmData = new Int16Array(decode(lastAudioBase64).buffer);
    const wavBlob = pcmToWav(pcmData, 24000);
    const url = URL.createObjectURL(wavBlob);
    triggerDownload(url, `narration-${Date.now()}.wav`);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-serif font-light tracking-tight text-white">Muse <span className="text-blue-400">&</span> Vision</h1>
        <p className="text-zinc-400 text-lg">Projetez votre vision (image ou vidéo) pour éveiller le Ghostwriter.</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center justify-between text-rose-400 animate-in shake">
          <div className="flex items-center space-x-3">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span className="text-xs font-black uppercase tracking-widest">{error}</span>
          </div>
          <button onClick={() => setError(null)}><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square w-full glass rounded-[3rem] flex flex-col items-center justify-center cursor-pointer overflow-hidden border-dashed border-2 border-zinc-800 hover:border-blue-500 transition-all group shadow-2xl bg-black/20"
          >
            {sourceFile ? (
              sourceFile.type === 'video' ? (
                <video src={sourceFile.url} className="w-full h-full object-cover" autoPlay loop muted playsInline />
              ) : (
                <img src={sourceFile.url} className="w-full h-full object-cover" alt="Uploaded scene" />
              )
            ) : (
              <div className="flex flex-col items-center space-y-3 group-hover:scale-110 transition-transform text-center p-8">
                <div className="p-6 bg-zinc-900 rounded-full border border-white/5">
                  <i className="fa-solid fa-cloud-arrow-up text-3xl text-zinc-600 group-hover:text-blue-400 transition-colors"></i>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Vision Source</span>
                  <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-tighter">Image ou Vidéo supportée</span>
                </div>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,video/*" 
            onChange={handleFileChange} 
          />

          <div className="glass p-6 rounded-[2.5rem] space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Narrateur</label>
              <span className="text-[8px] font-bold text-blue-400 uppercase bg-blue-500/10 px-2 py-0.5 rounded-full">Neural Synth</span>
            </div>
            <div className="relative">
              <select 
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                className="w-full bg-zinc-950 border border-white/5 text-zinc-200 text-xs rounded-2xl px-5 py-4 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
              >
                {AVAILABLE_VOICES.map((v) => (
                  <option key={v.name} value={v.name}>{v.label} — {v.description}</option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <i className="fa-solid fa-chevron-down text-[10px]"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {isAnalyzing ? (
            <div className="glass h-full min-h-[450px] rounded-[3.5rem] flex flex-col items-center justify-center space-y-6 p-12">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center space-y-2">
                <p className="text-zinc-400 font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">Extraction de l'Essence...</p>
                <p className="text-[9px] text-zinc-600 font-black uppercase">Calcul des vecteurs narratifs</p>
              </div>
            </div>
          ) : story ? (
            <div className="glass rounded-[3.5rem] p-10 space-y-8 animate-in slide-in-from-bottom-8 duration-700 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] pointer-events-none"></div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Genèse du Script</span>
                  <div className="flex space-x-2">
                    <button 
                      onClick={handleReadAloud} 
                      disabled={isReading} 
                      className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center transition-all ${isReading ? 'text-blue-400' : 'text-zinc-500 hover:text-white'}`}
                    >
                       {isReading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-volume-high"></i>}
                    </button>
                    {lastAudioBase64 && (
                      <button onClick={onDownloadAudio} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all">
                         <i className="fa-solid fa-download"></i>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-serif italic text-zinc-200 leading-[1.6] transition-all">
                  "{story.openingParagraph}"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Mood Dominant</span>
                  <p className="text-sm font-medium text-zinc-300">{story.mood}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Analyse de Scène</span>
                  <p className="text-sm font-medium text-zinc-300 capitalize">{story.sceneAnalysis?.split(' ')?.[0] || 'Fiction'}</p>
                </div>
              </div>

              <div className="pt-4">
                {videoUrl ? (
                  <div className="space-y-4">
                    <div ref={videoContainerRef} className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl group bg-black">
                       <video 
                          ref={videoRef}
                          src={videoUrl} 
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          playsInline
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md rounded-xl p-1 px-3 border border-white/10">
                                   <i className={`fa-solid ${volume === 0 ? 'fa-volume-mute' : 'fa-volume-high'} text-[10px] text-zinc-400`}></i>
                                   <input 
                                      type="range" 
                                      min="0" max="1" step="0.1" 
                                      value={volume}
                                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                                      className="w-16 accent-blue-500 cursor-pointer"
                                   />
                                </div>
                             </div>
                             <button 
                              onClick={toggleFullscreen}
                              className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-blue-600 transition-all"
                             >
                                <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                             </button>
                          </div>
                       </div>
                    </div>
                    <button 
                      onClick={() => triggerDownload(videoUrl, `cinematic-${Date.now()}.mp4`)}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center justify-center space-x-3"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Télécharger le Rendu Vidéo</span>
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={generateCinematicPreview}
                    disabled={isGeneratingVideo}
                    className="w-full py-5 bg-white/5 border border-dashed border-zinc-800 rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:border-blue-500/50 hover:text-blue-400 transition-all flex items-center justify-center space-x-3 group"
                  >
                    {isGeneratingVideo ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        <span>Rendu Cinématique en cours...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-clapperboard group-hover:animate-bounce"></i>
                        <span>Générer un Preview Cinématique</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[450px] rounded-[3.5rem] border-2 border-dashed border-zinc-900 flex flex-col items-center justify-center text-zinc-600 space-y-6">
               <div className="w-20 h-20 bg-zinc-950 rounded-[2rem] flex items-center justify-center border border-white/5 shadow-inner">
                  <i className="fa-solid fa-feather-pointed text-2xl opacity-20"></i>
               </div>
               <div className="text-center space-y-1">
                  <p className="text-[10px] uppercase font-black tracking-[0.4em] opacity-40">Ghostwriter en veille</p>
                  <p className="text-[9px] uppercase font-bold text-zinc-700 tracking-widest">En attente de signal visuel</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualLab;
