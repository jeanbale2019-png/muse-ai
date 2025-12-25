
import React, { useState } from 'react';
import { groundedSearch, thinkingQuery, handleGeminiError } from '../services/geminiService';
import { Language, UserAccount } from '../types';

interface IntelligenceHubProps {
  language: Language;
  // Fix: Adding user prop to resolve TS mismatch in App.tsx
  user: UserAccount | null;
}

const IntelligenceHub: React.FC<IntelligenceHubProps> = ({ language, user }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const mockScores = [
    { label: 'Eloquence', value: 85, color: '#3B82F6' },
    { label: 'Empathy', value: 92, color: '#8B93FF' },
    { label: 'Persuasion', value: 78, color: '#10b981' },
    { label: 'Clarity', value: 88, color: '#f59e0b' },
  ];

  const onSearch = async () => {
    setLoading(true);
    try {
      const res = await groundedSearch(query || "My performance summary", language);
      setResult(res);
    } catch (err) {
      handleGeminiError(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in py-6">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-serif font-black italic">Intelligence <span className="text-[#8B93FF]">Hub</span></h2>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Analytics & AI Scorecards</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Analytics Summary */}
        <div className="lg:col-span-4 space-y-6">
           <div className="p-8 rounded-[2.5rem] bg-[#0c0c0e] border border-white/5 shadow-2xl space-y-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Metrics Summary</h3>
              <div className="space-y-6">
                {mockScores.map(score => (
                  <div key={score.label} className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black uppercase text-zinc-400">{score.label}</span>
                      <span className="text-[10px] font-black text-white">{score.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full transition-all duration-1000" style={{ width: `${score.value}%`, backgroundColor: score.color }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-4 bg-[#8B93FF]/10 text-[#8B93FF] border border-[#8B93FF]/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#8B93FF]/20 transition-all">
                Download Detailed Report
              </button>
           </div>
        </div>

        {/* AI Researcher Terminal */}
        <div className="lg:col-span-8 space-y-6">
           <div className="p-8 rounded-[2.5rem] bg-zinc-900/30 border border-white/5 space-y-6 backdrop-blur-xl">
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Knowledge Engine</label>
                <div className="relative group">
                   <input 
                    className="w-full bg-[#09090b] border border-white/5 rounded-2xl px-6 py-5 text-lg outline-none focus:border-[#8B93FF]/50 transition-all placeholder:text-zinc-800"
                    placeholder="Ask the Muse researcher..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onSearch()}
                  />
                  <button onClick={onSearch} className="absolute right-3 top-3 w-12 h-12 bg-white text-black rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                    <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-magnifying-glass'}`}></i>
                  </button>
                </div>
              </div>

              {result && (
                <div className="p-8 rounded-[2rem] bg-black/40 border border-white/5 animate-in slide-in-from-bottom-4">
                   <div className="prose prose-invert max-w-none text-zinc-300 font-serif text-lg italic leading-relaxed">
                     {result.text}
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceHub;
