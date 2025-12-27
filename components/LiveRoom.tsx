import React from 'react';
import { Language, UserAccount } from '../types';

interface LiveRoomProps {
  language: Language;
  user: UserAccount;
  onBack: () => void;
}

const LiveRoom: React.FC<LiveRoomProps> = ({ onBack }) => {
  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] flex flex-col items-center justify-center p-8 text-center space-y-8">
        <h1 className="text-4xl font-serif italic text-white">Live Room <span className="text-indigo-500">2.0</span></h1>
        <p className="text-zinc-500 max-w-lg mx-auto">
            L'architecture temps réel est en cours de sécurisation via notre nouveau backend Node.js.
            Le mode Live reviendra bientôt.
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-white/10 text-white rounded-xl uppercase font-black text-xs tracking-widest hover:bg-white/20 transition-all">
            Retour
        </button>
    </div>
  );
};

export default LiveRoom;