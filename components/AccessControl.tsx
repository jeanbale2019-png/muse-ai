

import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, SubscriptionTier } from '../types';
import { initializeApp } from 'https://esm.sh/firebase@10.7.1/app';
import { getFirestore, doc, setDoc } from 'https://esm.sh/firebase@10.7.1/firestore';

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

  // Initialize Firestore
  const db = React.useMemo(() => {
    try {
      const firebaseConfig = { projectId: "muse-mentor-ai" }; 
      const app = initializeApp(firebaseConfig);
      return getFirestore(app);
    } catch (e) {
      return null;
    }
  }, []);

  if (!isOpen) return null;

  const handleFinalize = async (selectedPlan: SubscriptionTier) => {
    if (selectedPlan === 'business') {
      setStep('contact-enterprise');
      return;
    }

    setIsLoading(true);
    const userId = `muse_${Math.random().toString(36).substr(2, 6)}`;
    /* Fix: Add missing language property to UserAccount */
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
        
        {/* Step 1: Registration */}
        {step === 'register' && (
          <div className="max-w-md mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-4">
               <div className="w-16 h-16 bg-gradient-to-tr from-[#3B82F6] to-[#8B93FF] rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.4)]">
                  <i className="fa-solid fa-m text-white text-2xl"></i>
               </div>
               <h1 className="text-4xl font-serif font-black italic text-white uppercase tracking-tighter">Social <span className="text-indigo-400">Muse</span></h1>
               <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em]">Rejoignez l'élite de l'éloquence</p>
            </div>

            <div className="space-y-6 bg-[#111] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
               <div className="space-y-3">
                  <input 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" 
                    placeholder="Nom d'utilisateur" 
                  />
                  <input 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" 
                    placeholder="Email" 
                  />
                  <input 
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" 
                    placeholder="Mot de passe" 
                  />
               </div>

               <div className="grid grid-cols-2 gap-4 pt-2">
                  <button className="flex items-center justify-center space-x-3 py-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                     <i className="fa-brands fa-google text-white"></i>
                     <span className="text-[9px] font-black uppercase tracking-widest text-white">Google</span>
                  </button>
                  <button className="flex items-center justify-center space-x-3 py-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                     <i className="fa-brands fa-apple text-white text-lg"></i>
                     <span className="text-[9px] font-black uppercase tracking-widest text-white">Apple</span>
                  </button>
               </div>

               <button 
                onClick={() => setStep('profile-type')}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95"
               >
                 Créer mon compte
               </button>
            </div>
          </div>
        )}

        {/* Step 2: Profile Selection */}
        {step === 'profile-type' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-right-8 duration-700">
             <div className="text-center space-y-4">
                <h2 className="text-4xl font-serif font-black italic text-white uppercase tracking-tighter">Comment allez-vous utiliser <span className="text-indigo-400">la Muse</span> ?</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Adaptons l'IA à vos ambitions</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'solo', label: 'Citoyen / Particulier', desc: "Pour s'entraîner solo et progresser au quotidien.", icon: 'fa-user-ninja' },
                  { id: 'coach', label: 'Professionnel / Leader', desc: "Pour les présentations stratégiques et le networking.", icon: 'fa-crown' },
                  { id: 'org', label: 'Organisation / École', desc: "Pour gérer des groupes et des académies.", icon: 'fa-building-columns' }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setRole(item.id as UserRole)}
                    className={`p-8 rounded-[2.5rem] border text-left flex flex-col space-y-6 transition-all group active:scale-95 ${role === item.id ? 'bg-indigo-600/10 border-indigo-500 shadow-2xl shadow-indigo-600/10' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${role === item.id ? 'bg-indigo-600 text-white' : 'bg-white/5 text-zinc-500 group-hover:text-white'}`}>
                       <i className={`fa-solid ${item.icon} text-xl`}></i>
                    </div>
                    <div className="space-y-2">
                       <h3 className="font-black text-white uppercase text-xs tracking-widest">{item.label}</h3>
                       <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </button>
                ))}
             </div>

             <div className="flex justify-center pt-8">
                <button 
                  onClick={() => setStep('plans')}
                  className="px-16 py-5 bg-white text-black rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-zinc-200 transition-all active:scale-95"
                >
                  Choisir mon plan
                </button>
             </div>
          </div>
        )}

        {/* Step 3: Pricing Plans */}
        {step === 'plans' && (
          <div className="max-w-6xl mx-auto space-y-16 animate-in slide-in-from-bottom-12 duration-700">
             <div className="text-center space-y-4">
                <h2 className="text-5xl font-serif font-black italic text-white uppercase tracking-tighter">Votre puissance <span className="text-indigo-400">augmentée</span>.</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Sans engagement. Annulation en 1 clic.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                {/* FREEMIUM */}
                <div className="p-10 rounded-[3rem] bg-[#111] border border-white/5 flex flex-col space-y-8 hover:bg-[#151515] transition-all">
                   <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">🎁 FREEMIUM</span>
                      <div className="text-4xl font-black text-white">0€<span className="text-sm font-medium opacity-40">/mois</span></div>
                      <p className="text-xs text-zinc-400 italic">Pour découvrir la Muse.</p>
                   </div>
                   <ul className="flex-1 space-y-4 pt-6 border-t border-white/5">
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                         <i className="fa-solid fa-check text-green-500"></i>
                         <span>1 défi LAB / jour</span>
                      </li>
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                         <i className="fa-solid fa-check text-green-500"></i>
                         <span>Feedback IA simplifié</span>
                      </li>
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                         <i className="fa-solid fa-check text-green-500"></i>
                         <span>Spectateur des Lives</span>
                      </li>
                   </ul>
                   <button onClick={() => handleFinalize('free')} className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">
                      Commencer Gratuitement
                   </button>
                </div>

                {/* PREMIUM - HIGHLIGHTED */}
                <div className="relative p-10 rounded-[3rem] bg-[#0c0c0e] border-[2px] border-transparent premium-border flex flex-col space-y-8 shadow-[0_0_80px_rgba(59,130,246,0.15)] scale-105 z-10 overflow-hidden">
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#3B82F6] to-[#8B93FF] px-6 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white shadow-lg">
                      RECOMMANDÉ
                   </div>
                   <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">⭐ PREMIUM</span>
                      <div className="text-4xl font-black text-white">9.99€<span className="text-sm font-medium opacity-40">/mois</span></div>
                      <p className="text-xs text-zinc-400 italic">Pour les futurs leaders.</p>
                   </div>
                   <ul className="flex-1 space-y-4 pt-6 border-t border-white/5">
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-white">
                         <i className="fa-solid fa-bolt text-indigo-400"></i>
                         <span>Défis LAB illimités</span>
                      </li>
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-white">
                         <i className="fa-solid fa-bolt text-indigo-400"></i>
                         <span>Mode Débat débloqué</span>
                      </li>
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-white">
                         <i className="fa-solid fa-bolt text-indigo-400"></i>
                         <span>Coach IA avancé</span>
                      </li>
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-white">
                         <i className="fa-solid fa-bolt text-indigo-400"></i>
                         <span>Création de Lives</span>
                      </li>
                   </ul>
                   <button onClick={() => handleFinalize('premium')} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-[0_10px_30px_rgba(59,130,246,0.3)] animate-pulse-gentle">
                      Devenir un Leader
                   </button>
                </div>

                {/* ENTERPRISE */}
                <div className="p-10 rounded-[3rem] bg-[#111] border border-white/5 flex flex-col space-y-8 hover:bg-[#151515] transition-all">
                   <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">🏢 ENTREPRISE</span>
                      <div className="text-4xl font-black text-white">49.99€<span className="text-sm font-medium opacity-40">/mois</span></div>
                      <p className="text-xs text-zinc-400 italic">Pour les équipes et académies.</p>
                   </div>
                   <ul className="flex-1 space-y-4 pt-6 border-t border-white/5">
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                         <i className="fa-solid fa-users-gear text-zinc-500"></i>
                         <span>Multi-comptes</span>
                      </li>
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                         <i className="fa-solid fa-users-gear text-zinc-500"></i>
                         <span>Dashboard Admin</span>
                      </li>
                      <li className="flex items-center space-x-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                         <i className="fa-solid fa-users-gear text-zinc-500"></i>
                         <span>Salles de Live privées</span>
                      </li>
                   </ul>
                   <button onClick={() => handleFinalize('business')} className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">
                      Contacter la Vente
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Step 4: Enterprise Contact Form */}
        {step === 'contact-enterprise' && (
          <div className="max-w-xl mx-auto space-y-10 animate-in zoom-in-95 duration-500 text-center">
             <div className="space-y-4">
                <i className="fa-solid fa-envelope-open-text text-6xl text-indigo-400"></i>
                <h2 className="text-4xl font-serif font-black italic text-white uppercase tracking-tighter">Votre Académie sur-mesure</h2>
                <p className="text-zinc-500 text-sm">Laissez-nous vos coordonnées, un expert de la Muse vous contactera sous 24h.</p>
             </div>

             <div className="space-y-4 text-left bg-[#111] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Nom de l'organisation</label>
                      <input className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="École de Commerce..." />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Taille de l'équipe</label>
                      <select className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white">
                         <option>1-10 personnes</option>
                         <option>10-50 personnes</option>
                         <option>50+ personnes</option>
                      </select>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Message (Optionnel)</label>
                   <textarea rows={4} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="Dites-nous en plus sur vos besoins..." />
                </div>
                <div className="flex space-x-4 pt-4">
                   <button onClick={() => setStep('plans')} className="flex-1 py-4 text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-white">Retour</button>
                   <button onClick={() => handleFinalize('business')} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-600/20">Envoyer la demande</button>
                </div>
             </div>
          </div>
        )}

      </div>

      <style>{`
        .premium-border {
            border: 2px solid transparent;
            background: linear-gradient(#0c0c0e, #0c0c0e) padding-box,
                        linear-gradient(to right, #3B82F6, #8B93FF) border-box;
        }
        @keyframes pulse-gentle {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
        }
        .animate-pulse-gentle {
          animation: pulse-gentle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default AccessControl;
