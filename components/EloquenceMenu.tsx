
import React from 'react';
import { Tab, SubscriptionTier } from '../types';

interface EloquenceMenuProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  expanded: boolean;
  onToggle: () => void;
  userTier?: SubscriptionTier;
}

const EloquenceMenu: React.FC<EloquenceMenuProps> = ({ activeTab, onTabChange, expanded, onToggle, userTier }) => {
  const baseItems: { id: Tab; icon: string; label: string; desc: string; locked?: boolean }[] = [
    { id: 'writer', icon: 'fa-feather-pointed', label: 'Écrivain', desc: 'Ghostwriting IA' },
    { id: 'studio', icon: 'fa-wand-magic-sparkles', label: 'Studio', desc: 'Visual Forge' },
    { id: 'lab', icon: 'fa-microphone-lines', label: 'Le Lab', desc: 'Solo Coaching' },
    { id: 'live', icon: 'fa-tower-broadcast', label: 'Live Room', desc: 'Audio & Video', locked: userTier === 'free' },
    { id: 'intel', icon: 'fa-brain', label: 'Intelligence', desc: 'Scorecards Hub' },
    { id: 'social', icon: 'fa-share-nodes', label: 'Social', desc: 'Community Feed' },
  ];

  if (userTier === 'business') {
    baseItems.push({ id: 'admin', icon: 'fa-gauge-high', label: 'Admin', desc: 'Gestion Équipe' });
  }

  return (
    <aside className={`fixed left-0 top-0 bottom-0 ${expanded ? 'md:w-64' : 'md:w-20'} w-20 bg-[#0c0c0e] border-r border-white/5 transition-all duration-500 z-50 flex flex-col p-4 md:p-6`}>
      <div className="flex items-center space-x-3 mb-12">
        <div className="w-10 h-10 bg-[#3B82F6] rounded-xl flex items-center justify-center shadow-xl shadow-[#3B82F6]/20 flex-shrink-0">
          <i className="fa-solid fa-m text-white text-sm"></i>
        </div>
        {expanded && (
          <span className="hidden md:inline font-serif font-black text-xl tracking-tighter animate-in fade-in slide-in-from-left-2 duration-500">
            SOCIAL <span className="text-[#3B82F6] italic">MUSE</span>
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-2">
        {baseItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full group flex items-center ${expanded ? 'md:space-x-4 md:p-4 p-4' : 'justify-center p-4'} justify-center rounded-2xl transition-all duration-300 relative ${
                isActive 
                ? 'bg-[#3B82F6] text-white shadow-xl shadow-[#3B82F6]/20' 
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
              } ${item.locked ? 'opacity-40' : ''}`}
            >
              <div className="relative">
                <i className={`fa-solid ${item.icon} text-lg ${expanded ? 'md:w-6' : ''}`}></i>
                {item.locked && !expanded && <i className="fa-solid fa-lock absolute -top-1 -right-1 text-[8px] text-zinc-400"></i>}
              </div>
              {expanded && (
                <div className="hidden md:flex flex-col items-start animate-in fade-in slide-in-from-left-2 duration-500 overflow-hidden">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase tracking-widest truncate">{item.label}</span>
                    {item.locked && <i className="fa-solid fa-lock text-[9px] text-zinc-600"></i>}
                  </div>
                  <span className={`text-[9px] font-medium opacity-50 truncate ${isActive ? 'text-blue-100' : 'text-zinc-600'}`}>
                    {item.desc}
                  </span>
                </div>
              )}
              {(!expanded || window.innerWidth < 768) && isActive && (
                <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full"></div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="pt-6 border-t border-white/5 hidden md:block">
        <button 
          onClick={onToggle}
          className="w-full h-12 flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors"
        >
          <i className={`fa-solid ${expanded ? 'fa-angles-left' : 'fa-angles-right'}`}></i>
        </button>
      </div>
    </aside>
  );
};

export default EloquenceMenu;
