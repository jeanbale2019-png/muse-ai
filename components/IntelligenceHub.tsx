
import React, { useState, useRef } from 'react';
import { handleGeminiError, getAI, ensureApiKey } from '../services/geminiService';
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
  const [error, setError] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<Set<TerminalTool>>(new Set(['search']));
  const [attachedMedia, setAttachedMedia] = useState<{data: string, mimeType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTool = (tool: TerminalTool) => {
    const newTools = new Set(activeTools);
    if (newTools.has(tool)) newTools.delete(tool);
    else newTools.add(tool);
    setActiveTools(newTools);
    setError(null);
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
    setError(null);

    try {
      const isDeepThink = activeTools.has('think');
      const isMaps = activeTools.has('maps');
      const isSearch = activeTools.has('search');

      if (isDeepThink || isMaps) {
        await ensureApiKey();
      }

      const ai = getAI();
      let modelName = 'gemini-3-flash-preview';
      if (isMaps) modelName = 'gemini-2.5-flash'; 
      else if (isDeepThink) modelName = 'gemini-3-pro-preview';

      let latLng = undefined;
      if (isMaps) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          latLng = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch (e) {
          console.warn("Location access denied or unavailable.");
          // We don't block the request if maps is still desired, but it will be less accurate
        }
      }

      const contents: any[] = [];
      if (attachedMedia) {
        contents.push({ inlineData: { data: attachedMedia.data, mimeType: attachedMedia.mimeType } });
      }
      
      const finalPrompt = isMaps 
        ? `Focus on geospatial and location data: ${query}. Respond in ${language}. Use markdown.`
        : `${query}. Respond in ${language}. Use markdown.`;

      contents.push({ text: finalPrompt });

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
    } catch (err: any) {
      setError(err.message || "La requête au terminal a échoué.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 md:p-8 space-y-16 animate-in fade-in duration-1000">
      
      {/* Intelligence Terminal Container */}
      <div className="w-full max-w-4xl glass rounded-[3.5rem] border border-white/10 bg-[#0c0c0e]/95 shadow-[0_50px_150px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
        
        {/* Terminal Header */}
        <div className="px-12 py-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-500 mb-1 font-mono">Intelligence Terminal</span>
            <div className="flex items-center space-x-2">
               <div className={`w-1.5 h-1.5 rounded-full ${activeTools.has('maps') ? 'bg-emerald-500' : 'bg-indigo-500'} animate-pulse`}></div>
               <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
                 {activeTools.has('maps') ? 'Geospatial Node Active' : 'Session Active'} • v3.1.0
               </span>
            </div>
          </div>
          <div className="flex space-x-1.5 opacity-20">
             <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-12 mt-8 animate-in slide-in-from-top-4">
             <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-center space-x-4 text-rose-400">
                <i className="fa-solid fa-circle-exclamation"></i>
                <div className="flex-1 text-[10px] font-bold uppercase tracking-widest">{error}</div>
                <button onClick={() => setError(null)} className="text-zinc-500 hover:text-white transition-colors">
                  <i className="fa-solid fa-xmark"></i>
                </button>
             </div>
          </div>
        )}

        {/* Input Textarea */}
        <div className="p-12 space-y-10 flex-1">
          <textarea 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && executeTerminalQuery()}
            placeholder={activeTools.has('maps') ? "Search places, landmarks, or addresses..." : "Ask, analyze, or explore..."}
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

          {/* Action Grid */}
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
                className={`px-8 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeTools.has('maps') ? 'bg-emerald-600 text-white border-transparent shadow-[0_10px_30px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'}`}
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
             <div className={`h-full ${activeTools.has('maps') ? 'bg-emerald-500' : 'bg-indigo-500'} w-1/4 animate-[terminal-shimmer_1.5s_infinite_linear] shadow-[0_0_15px_rgba(79,70,229,0.8)]`}></div>
             {activeTools.has('maps') && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.4em] text-emerald-500/40">Scanning Geospatial Grid...</div>
             )}
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
               <div className="mt-16 space-y-10">
                  <span className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 font-mono">Neural Verification Nodes</span>
                  
                  {/* Specialized Maps View */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.chunks.map((chunk: any, i: number) => (
                      <div key={i}>
                        {chunk.web && (
                          <a 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center space-x-4 px-6 py-4 bg-white/5 border border-white/5 rounded-[2rem] hover:bg-white/10 transition-all group w-full"
                          >
                             <i className="fa-solid fa-link text-[10px] text-indigo-400 group-hover:rotate-12 transition-transform"></i>
                             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors truncate">{chunk.web.title || "External Intelligence"}</span>
                          </a>
                        )}
                        {chunk.maps && (
                           <div className="p-6 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-[2.5rem] space-y-4 hover:border-emerald-500/30 transition-all group">
                             <div className="flex justify-between items-start">
                               <div className="flex items-center space-x-3">
                                 <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                   <i className="fa-solid fa-location-dot"></i>
                                 </div>
                                 <div className="flex flex-col">
                                   <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">{chunk.maps.title || "Point of Interest"}</h4>
                                   <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Verified Geospatial Node</span>
                                 </div>
                               </div>
                               <a 
                                 href={chunk.maps.uri} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="text-zinc-500 hover:text-white transition-colors"
                               >
                                 <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                               </a>
                             </div>

                             {/* Render Place Details if available */}
                             {chunk.maps.placeAnswerSources && chunk.maps.placeAnswerSources.length > 0 && (
                               <div className="space-y-3 pt-2">
                                 {chunk.maps.placeAnswerSources.map((source: any, j: number) => (
                                   <div key={j} className="space-y-2">
                                     {source.formattedAddress && (
                                       <p className="text-[10px] text-zinc-500 font-medium">
                                         <i className="fa-solid fa-map-pin mr-2 text-[8px]"></i>
                                         {source.formattedAddress}
                                       </p>
                                     )}
                                     {source.reviewSnippets && source.reviewSnippets.length > 0 && (
                                       <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 italic font-serif text-[11px] text-zinc-400 leading-relaxed">
                                         "{source.reviewSnippets[0].text || source.reviewSnippets[0]}"
                                       </div>
                                     )}
                                   </div>
                                 ))}
                               </div>
                             )}

                             <div className="pt-2 flex items-center space-x-3">
                                <a 
                                  href={chunk.maps.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[8px] font-black uppercase text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                                >
                                  Open Navigation
                                </a>
                                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">Grounding Reference: {i + 1}</span>
                             </div>
                           </div>
                        )}
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Terminal Footer Navigation */}
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
