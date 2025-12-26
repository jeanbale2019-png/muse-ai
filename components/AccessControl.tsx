
import React, { useState } from 'react';
import { UserAccount, UserRole, SubscriptionTier } from '../types';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AccessControlProps {
  isOpen: boolean;
  onAuthComplete: (user: UserAccount) => void;
}

type AuthStep = 'register' | 'profile-type' | 'plans' | 'contact-enterprise';

const AccessControl: React.FC<AccessControlProps> = ({ isOpen, onAuthComplete }) => {
  const [step, setStep] = useState<AuthStep>('register');
  const [role, setRole] = useState<UserRole>('solo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleFinalize = async (selectedPlan: SubscriptionTier) => {
    if (selectedPlan === 'business') {
      setStep('contact-enterprise');
      return;
    }

    setIsLoading(true);
    const userId = `muse_${Math.random().toString(36).substr(2, 6)}`;
    
    const userData: UserAccount = {
      id: userId,
      username: username || email.split('@')[0],
      role: role,
      tier: selectedPlan,
      interests: [],
      eloquenceLevel: 1,
      exp: 0,
      language: 'fr-FR'
    };

    try {
      if (db) {
        await setDoc(doc(db, "users", userId), {
          ...userData,
          email,
          subscriptionPlan: selectedPlan,
          userRole: role,
          createdAt: new Date().toISOString()
        });
      }
      onAuthComplete(userData);
    } catch (e) {
      console.error("Firebase Save Error:", e);
      onAuthComplete(userData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#000] animate-in fade-in duration-500 overflow-y-auto py-10">
      <div className="w-full max-w-5xl px-6">
        {step === 'register' && (
          <div className="max-w-md mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-4">
               <div className="w-16 h-16 bg-gradient-to-tr from-[#3B82F6] to-[#8B93FF] rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.4)]">
                  <i className="fa-solid fa-m text-white text-2xl"></i>
               </div>
               <h1 className="text-4xl font-serif font-black italic text-white uppercase tracking-tighter">Social <span className="text-indigo-400">Muse</span></h1>
            </div>

            <div className="space-y-6 bg-[#111] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
               <div className="space-y-3">
                  <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" placeholder="Nom d'utilisateur" />
                  <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" placeholder="Email" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" placeholder="Mot de passe" />
               </div>
               <button onClick={() => setStep('profile-type')} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95">Créer mon compte</button>
            </div>
          </div>
        )}

        {step === 'profile-type' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-right-8 duration-700">
             <div className="text-center space-y-4">
                <h2 className="text-4xl font-serif font-black italic text-white uppercase tracking-tighter">Usage de la <span className="text-indigo-400">Muse</span> ?</h2>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[{ id: 'solo', label: 'Solo', icon: 'fa-user-ninja' }, { id: 'coach', label: 'Pro', icon: 'fa-crown' }, { id: 'org', label: 'Org', icon: 'fa-building-columns' }].map(item => (
                  <button key={item.id} onClick={() => setRole(item.id as UserRole)} className={`p-8 rounded-[2.5rem] border text-left flex flex-col space-y-6 transition-all ${role === item.id ? 'bg-indigo-600/10 border-indigo-500' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${role === item.id ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-500'}`}><i className={`fa-solid ${item.icon} text-xl`}></i></div>
                    <h3 className="font-black text-white uppercase text-xs tracking-widest">{item.label}</h3>
                  </button>
                ))}
             </div>
             <button onClick={() => setStep('plans')} className="px-16 py-5 bg-white text-black rounded-2xl font-black uppercase text-[11px] mx-auto block">Choisir mon plan</button>
          </div>
        )}

        {step === 'plans' && (
          <div className="max-w-6xl mx-auto space-y-16 animate-in slide-in-from-bottom-12 duration-700 text-center">
             <h2 className="text-5xl font-serif font-black text-white">Votre puissance <span className="text-indigo-400">augmentée</span></h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <button onClick={() => handleFinalize('free')} className="p-10 rounded-[3rem] bg-[#111] border border-white/5 text-white">Plan Free</button>
                <button onClick={() => handleFinalize('premium')} className="p-10 rounded-[3rem] bg-indigo-600 text-white">Plan Premium</button>
                <button onClick={() => handleFinalize('business')} className="p-10 rounded-[3rem] bg-[#111] border border-white/5 text-white">Plan Business</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessControl;
