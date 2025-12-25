
import React from 'react';
import { Tab } from '../types';

interface MobileNavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onOpenChat: () => void;
}

const MobileNavBar: React.FC<MobileNavBarProps> = ({ activeTab, onTabChange, onOpenChat }) => {
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: 'writer', icon: 'fa-feather-pointed', label: 'Écrivain' },
    { id: 'studio', icon: 'fa-wand-magic-sparkles', label: 'Studio' },
    { id: 'lab', icon: 'fa-microphone-lines', label: 'Lab' },
    { id: 'live', icon: 'fa-tower-broadcast', label: 'Live Room' },
    { id: 'intel', icon: 'fa-brain', label: 'Intelligence' },
    { id: 'social', icon: 'fa-share-nodes', label: 'Social' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="bg-[#09090b]/90 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] px-2 py-2 flex items-center justify-between shadow-2xl pointer-events-auto">
        
        <div className="flex-1 flex justify-around">
          {items.map(item => (
            <button 
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-2 transition-all duration-300 relative ${
                activeTab === item.id ? 'text-[#3B82F6] scale-110' : 'text-zinc-500'
              }`}
            >
              <i className={`fa-solid ${item.icon} text-lg mb-1`}></i>
              <span className="text-[7px] font-black uppercase tracking-tighter">{item.label}</span>
              {activeTab === item.id && (
                <div className="absolute -top-1 w-1 h-1 bg-[#3B82F6] rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        <div className="pl-2 border-l border-white/5 ml-2">
          <button 
            onClick={onOpenChat}
            className="flex items-center justify-center w-12 h-12 bg-[#3B82F6] rounded-full shadow-lg shadow-[#3B82F6]/40 transition-transform active:scale-95"
          >
            <i className="fa-solid fa-message text-white text-lg"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileNavBar;
