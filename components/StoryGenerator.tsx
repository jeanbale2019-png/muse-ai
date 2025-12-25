
import React, { useState, useRef } from 'react';
import { analyzeImageAndGhostwrite, generateTTS, playTTS, decode, pcmToWav, triggerDownload } from '../services/geminiService';
import { StoryData, AVAILABLE_VOICES, VoiceName } from '../types';

const StoryGenerator: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [story, setStory] = useState<StoryData | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage(reader.result as string);
      setIsAnalyzing(true);
      setLastAudioBase64(null);
      try {
        const result = await analyzeImageAndGhostwrite(base64, file.type);
        setStory(result);
      } catch (err) {
        console.error(err);
        alert("Failed to analyze image. Ensure your API key is valid.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReadAloud = async () => {
    if (!story) return;
    setIsReading(true);
    try {
      const base64 = await generateTTS(story.openingParagraph, selectedVoice);
      if (base64) {
        setLastAudioBase64(base64);
        await playTTS(base64);
      }
    } catch (err) {
      console.error(err);
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-serif font-light tracking-tight text-white">Muse <span className="text-blue-400">&</span> Vision</h1>
        <p className="text-zinc-400 text-lg">Upload an image to spark a world-building opening.</p>
      </div>

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

          {/* Voice Selector */}
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
            <div className="glass p-8 rounded-3xl space-y-4 animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-800 rounded w-full"></div>
              <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
              <p className="text-zinc-500 text-sm text-center">Gemini is exploring the world within...</p>
            </div>
          ) : story ? (
            <div className="glass p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">Atmosphere</h3>
                  <p className="text-sm italic text-zinc-400">{story.mood}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={handleReadAloud}
                    disabled={isReading}
                    className="p-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-full transition-all shadow-xl shadow-blue-500/20 hover:scale-110 active:scale-95 flex items-center justify-center"
                    title="Narrate story"
                  >
                    {isReading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>
                    )}
                  </button>
                  {lastAudioBase64 && (
                    <button 
                      onClick={onDownloadAudio}
                      className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-full transition-all shadow-xl hover:scale-110 active:scale-95 flex items-center justify-center border border-zinc-700 animate-in zoom-in-50 duration-300"
                      title="Download Audio (WAV)"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-lg font-serif leading-relaxed text-zinc-100 first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-blue-400">
                  {story.openingParagraph}
                </p>
                
                <div className="pt-6 border-t border-zinc-800 flex flex-col space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Scene Analysis</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed italic">{story.sceneAnalysis}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-center glass rounded-3xl border-dashed border border-zinc-800 min-h-[300px]">
              <p className="text-zinc-500">Your story begins once the first frame is cast.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryGenerator;
