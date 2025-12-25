
import React, { useState, useMemo } from 'react';
import { Language, SUPPORTED_LANGUAGES } from '../types';

interface LanguageSelectorProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ currentLanguage, onLanguageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const current = useMemo(() => 
    SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage), 
    [currentLanguage]
  );

  const filtered = useMemo(() => 
    SUPPORTED_LANGUAGES.filter(l => 
      l.label.toLowerCase().includes(search.toLowerCase()) || 
      l.native.toLowerCase().includes(search.toLowerCase())
    ), 
    [search]
  );

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
      >
        <span className="text-lg">{current?.flag}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hidden md:block">
          {current?.label}
        </span>
        <i className={`fa-solid fa-chevron-down text-[8px] text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-72 glass rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden z-[100] animate-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-white/5 bg-white/5">
             <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs"></i>
                <input 
                  autoFocus
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs outline-none focus:border-indigo-500/50"
                  placeholder="Search language..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>
          </div>
          <div className="max-h-80 overflow-y-auto no-scrollbar p-2">
             {filtered.map(lang => (
               <button 
                key={lang.code}
                onClick={() => {
                  onLanguageChange(lang.code);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl hover:bg-indigo-600/10 group transition-all ${currentLanguage === lang.code ? 'bg-indigo-600/20' : ''}`}
               >
                  <div className="flex items-center space-x-4">
                     <span className="text-xl">{lang.flag}</span>
                     <div className="flex flex-col items-start">
                        <span className={`text-[11px] font-bold ${currentLanguage === lang.code ? 'text-indigo-400' : 'text-zinc-200'}`}>
                          {lang.label}
                        </span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">
                          {lang.native}
                        </span>
                     </div>
                  </div>
                  {currentLanguage === lang.code && (
                    <i className="fa-solid fa-circle-check text-indigo-500 text-xs"></i>
                  )}
               </button>
             ))}
             {filtered.length === 0 && (
               <div className="py-8 text-center opacity-20 text-xs font-black uppercase tracking-widest">
                  No results
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
