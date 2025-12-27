
import React, { useState, useRef } from 'react';
import { notifyUser, getAI } from '../services/geminiService';
import { Language, UserAccount } from '../types';

interface IntelligenceHubProps {
  language: Language;
  user: UserAccount | null;
}

type TerminalTool = 'search' | 'maps' | 'think' | 'media';

const IntelligenceHub: React.FC<IntelligenceHubProps> = ({ language, user }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTools, setActiveTools] = useState<Set<TerminalTool>>(new Set(['search']));
  const [attachedMedia, setAttachedMedia] = useState<{data: string, mimeType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTool = (tool: TerminalTool) => {
    const newTools = new Set(activeTools);
    if (newTools.has(tool)) newTools.delete(tool);
    else newTools.add(tool);
    setActiveTools(newTools);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedMedia({
          data: (reader.result as string).split(',')[1],
          mimeType: file.type
        });
        setActiveTools(prev => new Set(prev).add('media'));
      };
      reader.readAsDataURL(file);
    }
  };

  const executeTerminalQuery = async () => {
    if (!query && !attachedMedia) return;
    setLoading(true);
    setResult(null);

    try {
      const ai = getAI();
      const isDeepThink = activeTools.has('think');
      const isMaps = activeTools.has('maps');
      const isSearch = activeTools.has('search');

      // Model Selection Logic based on Tool capabilities
      let modelName = 'gemini-3-flash-preview';
      if (isMaps) modelName = 'gemini-2.5-flash'; // Required for Maps grounding
      else if (isDeepThink) modelName = 'gemini-3-pro-preview';

      let latLng = undefined;
      if (isMaps) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          latLng = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch (e) {
          console.warn("Location access unavailable for Maps grounding.");
        }
      }

      const contents: any[] = [];
      if (attachedMedia) {
        contents.push({ inlineData: { data: attachedMedia.data, mimeType: attachedMedia.mimeType } });
      }
      contents.push({ text: `${query}. Respond in ${language}. Use markdown for formatting.` });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: contents },
        config: {
          tools: [
            ...(isSearch ? [{ googleSearch: {} }] : []),
            ...(isMaps ? [{ googleMaps: {} }] : [])
          ],
          ...(isMaps && latLng ? { toolConfig: { retrievalConfig: { latLng } } } : {}),
          ...(isDeepThink && !isMaps ? { thinkingConfig: { thinkingBudget: 32768 } } : {})
        }
      });

      setResult({
        text: response.text,
        chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
      });
    } catch (err) {
      notifyUser(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 md:p-8 space-y-16 animate-in fade-in duration-1000">
      
      {/* Intelligence Terminal Container */}
      <div className="w-full max-w-4xl glass rounded-[3.5rem] border border-white/10 bg-[#0c0c0e]/90 shadow-[0_50px_150px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
        
        {/* Terminal Header */}
        <div className="px-12 py-10 border-b border-white/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-500 mb-1 font-mono">Intelligence Terminal</span>
            <div className="flex items-center space-x-2">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
               <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono">Session Active • v2.9.0</span>
            </div>
          </div>
          <div className="flex space-x-1.5 opacity-20">
             <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
          </div>
        </div>

        {/* Input Textarea */}
        <div className="p-12 space-y-10 flex-1">
          <textarea 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && executeTerminalQuery()}
            placeholder="Ask, analyze, or explore..."
            className="w-full bg-transparent text-4xl md:text-6xl font-serif italic text-white outline-none resize-none placeholder:text-zinc-800 leading-tight min-h-[180px] scrollbar-hide"
          />

          {attachedMedia && (
            <div className="animate-in zoom-in-95 flex items-center space-x-5 p-5 bg-white/5 rounded-[2rem] border border-white/5 self-start w-fit group">
               <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-transform group-hover:scale-105">
                  <img src={`data:${attachedMedia.mimeType};base64,${attachedMedia.data}`} className="w-full h-full object-cover" />
               </div>
               <div className="flex flex-col pr-4">
                  <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-1">Visual Context Attached</span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase truncate max-w-[180px]">Analyzing encoded media</span>
               </div>
               <button onClick={() => setAttachedMedia(null)} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-zinc-600 hover:text-rose-500 transition-all hover:bg-rose-500/10">
                  <i className="fa-solid fa-circle-xmark"></i>
               </button>
            </div>
          )}

          {/* Action Grid matching screenshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-6">
            <div className="flex flex-col xs:flex-row gap-4">
              <button 
                onClick={() => toggleTool('search')}
                className={`px-8 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeTools.has('search') ? 'bg-indigo-600 text-white border-transparent shadow-[0_10px_30px_rgba(79,70,229,0.3)]' : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'}`}
              >
                Search Grounding
              </button>
              <button 
                onClick={() => toggleTool('maps')}
                className={`px-8 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeTools.has('maps') ? 'bg-indigo-600 text-white border-transparent shadow-[0_10px_30px_rgba(79,70,229,0.3)]' : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'}`}
              >
                Maps Data
              </button>
            </div>
            
            <div className="flex flex-col xs:flex-row gap-4 sm:justify-end">
              <button 
                onClick={() => toggleTool('think')}
                className={`px-8 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeTools.has('think') ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.2)]' : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'}`}
              >
                <i className="fa-solid fa-brain-circuit mr-3 text-xs"></i>
                Deep Think Mode
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`px-8 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${attachedMedia ? 'bg-emerald-600 text-white border-transparent' : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'}`}
              >
                <i className="fa-solid fa-paperclip mr-3 text-xs"></i>
                Attach Media
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
            </div>
          </div>
        </div>

        {/* Neural Processing Progress */}
        {loading && (
          <div className="h-1.5 w-full bg-zinc-900 overflow-hidden relative">
             <div className="h-full bg-indigo-500 w-1/4 animate-[terminal-shimmer_1.5s_infinite_linear] shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
          </div>
        )}

        {/* Result Stream */}
        {result && (
          <div className="p-12 bg-black/50 border-t border-white/5 animate-in slide-in-from-bottom-12 duration-700">
             <div className="max-w-none">
                <p className="text-2xl md:text-3xl font-serif text-zinc-200 italic leading-[1.6] whitespace-pre-wrap">
                   {result.text}
                </p>
             </div>

             {result.chunks && result.chunks.length > 0 && (
               <div className="mt-16 space-y-6">
                  <span className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 font-mono">Neural Verification Nodes</span>
                  <div className="flex flex-wrap gap-4">
                    {result.chunks.map((chunk: any, i: number) => (
                      <div key={i}>
                        {chunk.web && (
                          <a 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center space-x-4 px-6 py-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                          >
                             <i className="fa-solid fa-link text-[10px] text-indigo-400 group-hover:rotate-12 transition-transform"></i>
                             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">{chunk.web.title || "Link"}</span>
                          </a>
                        )}
                        {chunk.maps && (
                           <a 
                            href={chunk.maps.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center space-x-4 px-6 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl hover:bg-indigo-500/20 transition-all group"
                          >
                             <i className="fa-solid fa-location-dot text-[10px] text-indigo-400"></i>
                             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">{chunk.maps.title || "Location"}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Terminal Footer Navigation (from screenshot) */}
      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-20 pb-10 opacity-40">
        <button className="text-[11px] font-black uppercase tracking-[0.4em] hover:opacity-100 hover:text-indigo-400 cursor-pointer transition-all font-mono">Protocol</button>
        <button className="text-[11px] font-black uppercase tracking-[0.4em] hover:opacity-100 hover:text-indigo-400 cursor-pointer transition-all font-mono">Identity</button>
        <button className="text-[11px] font-black uppercase tracking-[0.4em] hover:opacity-100 hover:text-indigo-400 cursor-pointer transition-all font-mono underline decoration-indigo-500 underline-offset-8">Neural</button>
        <button className="text-[11px] font-black uppercase tracking-[0.4em] hover:opacity-100 hover:text-indigo-400 cursor-pointer transition-all font-mono">Oracle</button>
      </div>

      <style>{`
        @keyframes terminal-shimmer {
          0% { left: -50%; }
          100% { left: 150%; }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default IntelligenceHub;
