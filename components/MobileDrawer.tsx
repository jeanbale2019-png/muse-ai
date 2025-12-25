
import React from 'react';
import { Tab, UI_TRANSLATIONS } from '../types';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  language: string;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, activeTab, onTabChange, language }) => {
  const t = UI_TRANSLATIONS[language] || UI_TRANSLATIONS['fr-FR'];

  const items: { id: Tab; icon: string; label: string; desc: string }[] = [
    { id: 'writer', icon: 'fa-feather-pointed', label: t.writer, desc: 'Assistant Écriture IA' },
    { id: 'studio', icon: 'fa-wand-magic-sparkles', label: t.studio, desc: 'Génération Visuelle' },
    { id: 'lab', icon: 'fa-microphone-lines', label: t.lab, desc: 'Entraînement Solo' },
    { id: 'live', icon: 'fa-tower-broadcast', label: 'Live Room', desc: 'Session Directe' },
    { id: 'intel', icon: 'fa-brain', label: t.intel, desc: 'Analyses & Scores' },
    { id: 'social', icon: 'fa-share-nodes', label: t.social, desc: 'Communauté' },
    { id: 'profile', icon: 'fa-user-astronaut', label: t.profile, desc: 'Espace Personnel' },
    { id: 'settings', icon: 'fa-sliders', label: t.settings, desc: 'Configuration' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
        onClick={onClose}
      ></div>

      {/* Drawer Content */}
      <div className="relative w-80 bg-[#0c0c0e]/90 backdrop-blur-3xl border-r border-white/5 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-500 ease-out p-6 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#3B82F6] rounded-xl flex items-center justify-center shadow-xl shadow-[#3B82F6]/20">
              <i className="fa-solid fa-m text-white text-sm"></i>
            </div>
            <span className="font-serif font-black text-xl tracking-tighter">
              SOCIAL <span className="text-[#3B82F6] italic">MUSE</span>
            </span>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 glass rounded-xl flex items-center justify-center text-zinc-500 hover:text-white"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <nav className="flex-1 space-y-3">
          {items.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full group flex items-center space-x-4 p-4 rounded-[1.5rem] transition-all duration-300 border ${
                  isActive 
                  ? 'bg-[#3B82F6] text-white border-transparent shadow-xl shadow-[#3B82F6]/20' 
                  : 'text-zinc-500 bg-white/5 border-white/5 hover:bg-white/10 hover:text-zinc-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-white/20' : 'bg-zinc-900 group-hover:bg-zinc-800'}`}>
                  <i className={`fa-solid ${item.icon} text-lg`}></i>
                </div>
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="text-[11px] font-black uppercase tracking-widest truncate">{item.label}</span>
                  <span className={`text-[8px] font-medium opacity-50 truncate uppercase tracking-tighter ${isActive ? 'text-blue-100' : 'text-zinc-600'}`}>
                    {item.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="pt-8 border-t border-white/5">
           <div className="flex items-center space-x-3 p-4 bg-zinc-900/50 rounded-2xl">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Me`} className="w-10 h-10 rounded-full bg-zinc-800" alt="avatar" />
              <div className="flex flex-col overflow-hidden">
                 <span className="text-[10px] font-black uppercase text-white truncate">Explorateur Muse</span>
                 <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Niveau 12</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
