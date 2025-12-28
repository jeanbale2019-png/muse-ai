import React, { useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { UserAccount } from '../types';

interface ProfilePageProps {
  targetUserId?: string | null;
  onBack: () => void;
  language: string;
  currentAppUser: UserAccount | null;
  onUserUpdate?: (user: UserAccount) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ targetUserId, onBack, currentAppUser }) => {
  
  const currentUserId = useMemo(() => {
    return currentAppUser?.id || 'guest';
  }, [currentAppUser]);

  return (
    <div className="bg-[#09090b] min-h-screen font-sans text-white">
      <header className="p-4 flex items-center space-x-4 border-b border-white/5">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5">
            <i className="fa-solid fa-arrow-left text-sm"></i>
        </button>
        <h1 className="font-serif font-black text-xl uppercase">PROFIL</h1>
      </header>
      <main className="max-w-xl mx-auto px-5 py-12 text-center space-y-6">
         <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full mx-auto shadow-xl"></div>
         <div>
            <h2 className="text-2xl font-black">{currentAppUser?.username || "Explorateur"}</h2>
            <p className="text-zinc-500 text-sm uppercase tracking-widest mt-1">{currentAppUser?.role || 'Solo'}</p>
         </div>
         <div className="glass p-6 rounded-2xl border border-white/5">
            <p className="text-zinc-400 italic">Statistiques en cours de chargement depuis Firestore...</p>
         </div>
      </main>
    </div>
  );
};

export default ProfilePage;