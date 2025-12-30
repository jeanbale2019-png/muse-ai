
import React, { useState, useRef } from 'react';
import { analyzeImageAndGhostwrite, generateTTS, playTTS, decode, pcmToWav, triggerDownload } from '../services/geminiService';
import { StoryData, AVAILABLE_VOICES, VoiceName, Language } from '../types';

interface StoryGeneratorProps {
  language?: Language;
}

const StoryGenerator: React.FC<StoryGeneratorProps> = ({ language = 'en-US' }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [story, setStory] = useState<StoryData | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage(reader.result as string);
      setIsAnalyzing(true);
      setLastAudioBase64(null);
      try {
        // Fix: Explicitly cast language to Language to satisfy the type system if it is inferred as a generic string.
        const result = await analyzeImageAndGhostwrite(base64, file.type, language as Language);
        setStory(result);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to analyze image. Please check your API key and connection.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
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
      setError("Failed to generate speech. Please try a different voice or try again later.");
    } finally {
      setIsReading(false);
    }
  };

  const onDownloadAudio = () => {
    if (!lastAudioBase64) return;
    try {
      const pcmData = new Int16Array(decode(lastAudioBase64).buffer);
      const wavBlob = pcmToWav(pcmData, 24000);
      const url = URL.createObjectURL(wavBlob);
      triggerDownload(url, `narration-${Date.now()}.wav`);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download audio file.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-serif font-light tracking-tight text-white">Muse <span className="text-blue-400">&</span> Vision</h1>
        <p className="text-zinc-400 text-lg">Upload an image to spark a world-building opening.</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center justify-between text-rose-400 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square w-full glass rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden border-dashed border-2 border-zinc-700 hover:border-blue-500 transition-all group"
          >
            {image ? (
              <img src={image} className="w-full h-full object-cover" alt="Uploaded scene" />
            ) : (
              <div className="flex flex-col items-center space-y-2 group-hover:scale-105 transition-transform">
                <div className="p-4 bg-zinc-800 rounded-full">
                  <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                </div>
                <span className="text-zinc-500 font-medium">Select Image</span>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
          />

          <div className="glass p-4 rounded-2xl space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block">Narrator Voice</label>
            <div className="relative">
              <select 
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-xl px-4 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
              >
                {AVAILABLE_VOICES.map((v) => (
                  <option key={v.name} value={v.name}>{v.label} — {v.description}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {isAnalyzing ? (
            <div className="glass h-full min-h-[400px] rounded-3xl flex flex-col items-center justify-center space-y-4 p-8">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-zinc-400 font-mono text-sm animate-pulse">Analyzing visual vectors...</p>
            </div>
          ) : story ? (
            <div className="glass rounded-3xl p-8 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Opening</span>
                  <div className="flex space-x-2">
                    <button onClick={handleReadAloud} disabled={isReading} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                       {isReading ? <span className="animate-pulse">●</span> : <i className="fa-solid fa-volume-high"></i>}
                    </button>
                    {lastAudioBase64 && (
                      <button onClick={onDownloadAudio} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                         <i className="fa-solid fa-download"></i>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-serif italic text-zinc-200 leading-relaxed">
                  "{story.openingParagraph}"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Mood</span>
                  <p className="text-sm text-zinc-300">{story.mood}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Genre</span>
                  <p className="text-sm text-zinc-300 capitalize">{story.sceneAnalysis?.split(' ')?.[0] || 'Fiction'}</p>
                </div>
              </div>

              {story.characters.length > 0 && (
                <div className="space-y-2">
                   <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Characters Identified</span>
                   <div className="flex flex-wrap gap-2">
                      {story.characters.map((char, i) => (
                        <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-xs text-zinc-300 border border-white/5">{char}</span>
                      ))}
                   </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[400px] rounded-3xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600 space-y-4">
               <i className="fa-solid fa-feather-pointed text-4xl opacity-20"></i>
               <p className="text-sm uppercase font-black tracking-widest opacity-40">Upload image to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryGenerator;
