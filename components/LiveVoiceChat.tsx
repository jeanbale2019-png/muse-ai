import React from 'react';
import { Language, UserAccount } from '../types';

interface LiveVoiceChatProps {
  language: Language;
  user: UserAccount | null;
  db: any;
}

const LiveVoiceChat: React.FC<LiveVoiceChatProps> = ({ language }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
      <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5">
         <i className="fa-solid fa-microphone-lines-slash text-4xl text-zinc-600"></i>
      </div>
      <h2 className="text-2xl font-serif font-black italic text-zinc-400">Le Lab est en maintenance</h2>
      <p className="text-xs font-black uppercase tracking-widest text-zinc-600 max-w-md leading-relaxed">
        Nous migrons l'infrastructure vers un traitement sécurisé côté serveur (Node.js). 
        Le flux audio direct via navigateur est désactivé temporairement.
      </p>
    </div>
  );
};

export default LiveVoiceChat;