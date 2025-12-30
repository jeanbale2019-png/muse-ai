
import React, { useState } from 'react';
import { UserAccount, UserRole, SubscriptionTier } from '../types';
import { loginUser, registerUser, loginWithGoogle } from '../services/authService';

interface AccessControlProps {
  isOpen: boolean;
  onAuthComplete: (user: UserAccount) => void;
}

type AuthStep = 'auth' | 'profile-type' | 'plans' | 'contact-enterprise';

const AccessControl: React.FC<AccessControlProps> = ({ isOpen, onAuthComplete }) => {
  const [step, setStep] = useState<AuthStep>('auth');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [role, setRole] = useState<UserRole>('solo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLoginMode) {
        const user = await loginUser(email, password);
        onAuthComplete(user);
      } else {
        // Registration leads to plan selection
        setStep('profile-type');
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de l'authentification.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await loginWithGoogle();
      onAuthComplete(user);
    } catch (err: any) {
      setError(err.message || "Connexion Google échouée.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeRegistration = async (selectedPlan: SubscriptionTier) => {
    if (selectedPlan === 'business') {
      setStep('contact-enterprise');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await registerUser(email, password, username || email.split('@')[0], role, selectedPlan);
      onAuthComplete(user);
    } catch (err: any) {
      setError(err.message || "Échec de la création du compte.");
      setStep('auth'); // Go back if it fails
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#000] animate-in fade-in duration-500 overflow-y-auto py-10">
      <div className="w-full max-w-5xl px-6">
        
        {step === 'auth' && (
          <div className="max-w-md mx-auto space-y-10 animate-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-4">
               <div className="w-16 h-16 bg-gradient-to-tr from-[#3B82F6] to-[#8B93FF] rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.4)]">
                  <i className="fa-solid fa-m text-white text-2xl"></i>
               </div>
               <h1 className="text-4xl font-serif font-black italic text-white uppercase tracking-tighter">Social <span className="text-indigo-400">Muse</span></h1>
               <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em]">
                 {isLoginMode ? "Bon retour parmi nous" : "Rejoignez l'élite de l'éloquence"}
               </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6 bg-[#111] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
               {error && (
                 <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[10px] font-bold uppercase text-center animate-in shake">
                   {error}
                 </div>
               )}

               <div className="space-y-3">
                  {!isLoginMode && (
                    <input 
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" 
                      placeholder="Nom d'utilisateur" 
                    />
                  )}
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" 
                    placeholder="Email" 
                  />
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-all" 
                    placeholder="Mot de passe" 
                  />
               </div>

               <div className="grid grid-cols-2 gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center space-x-3 py-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                     <i className="fa-brands fa-google text-white"></i>
                     <span className="text-[9px] font-black uppercase tracking-widest text-white">Google</span>
                  </button>
                  <button type="button" className="flex items-center justify-center space-x-3 py-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                     <i className="fa-brands fa-apple text-white text-lg"></i>
                     <span className="text-[9px] font-black uppercase tracking-widest text-white">Apple</span>
                  </button>
               </div>

               <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center justify-center"
               >
                 {isLoading ? (
                   <i className="fa-solid fa-spinner animate-spin text-lg"></i>
                 ) : (
                   isLoginMode ? "Se connecter" : "S'inscrire"
                 )}
               </button>

               <div className="text-center">
                 <button 
                   type="button"
                   onClick={() => setIsLoginMode(!isLoginMode)}
                   className="text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
                 >
                   {isLoginMode ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
                 </button>
               </div>
            </form>
          </div>
        )}

        {step === 'profile-type' && (
          <div className="max-w-4xl mx-auto py-20 text-center space-y-12 animate-in fade-in">
             <h2 className="text-3xl font-serif italic text-white uppercase tracking-tighter">Quel est votre <span className="text-indigo-400">Parcours</span> ?</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'solo', label: 'Créateur Solo', desc: 'Pour les visionnaires indépendants', icon: 'fa-user-ninja' },
                  { id: 'coach', label: 'Coach / Leader', desc: 'Pour ceux qui guident les autres', icon: 'fa-crown' },
                  { id: 'org', label: 'Organisation', desc: 'Pour les équipes et entreprises', icon: 'fa-building' }
                ].map(p => (
                  <button 
                    key={p.id}
                    onClick={() => { setRole(p.id as UserRole); setStep('plans'); }}
                    className="p-8 bg-[#111] border border-white/5 rounded-[2.5rem] space-y-4 hover:border-indigo-500/50 transition-all text-left group"
                  >
                     <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                        <i className={`fa-solid ${p.icon} text-zinc-500 group-hover:text-white`}></i>
                     </div>
                     <h3 className="text-lg font-bold text-white uppercase">{p.label}</h3>
                     <p className="text-[10px] text-zinc-500 uppercase font-black">{p.desc}</p>
                  </button>
                ))}
             </div>
          </div>
        )}

        {step === 'plans' && (
           <div className="max-w-4xl mx-auto py-20 text-center space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-serif italic text-white uppercase tracking-tighter">Choisir votre <span className="text-indigo-400">Plan de Vol</span></h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <button 
                   onClick={() => handleFinalizeRegistration('free')}
                   className="p-10 bg-[#111] border border-white/5 rounded-[3rem] text-left space-y-4 hover:border-indigo-500/30 transition-all relative overflow-hidden group"
                 >
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em]">Plan Standard</span>
                       <span className="text-xl font-bold text-white italic">0€ <small className="text-[10px] uppercase font-black opacity-30">/ mois</small></span>
                    </div>
                    <h3 className="text-2xl font-serif italic text-white">Solo Forge</h3>
                    <p className="text-xs text-zinc-600 leading-relaxed">Parfait pour l'entraînement quotidien et les créations occasionnelles. 100 crédits mensuels.</p>
                 </button>

                 <button 
                   onClick={() => handleFinalizeRegistration('premium')}
                   className="p-10 bg-indigo-600 border border-transparent rounded-[3rem] text-left space-y-4 hover:bg-indigo-500 transition-all relative overflow-hidden shadow-2xl shadow-indigo-600/20"
                 >
                    <div className="absolute top-4 right-6 px-2 py-0.5 bg-white text-indigo-600 text-[8px] font-black uppercase rounded-md">Recommandé</div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-white/50 tracking-[0.3em]">Plan Élite</span>
                       <span className="text-xl font-bold text-white italic">29€ <small className="text-[10px] uppercase font-black opacity-50">/ mois</small></span>
                    </div>
                    <h3 className="text-2xl font-serif italic text-white">Neural Premium</h3>
                    <p className="text-xs text-indigo-100 leading-relaxed">Accès complet à Veo 3.1, Mode Débat illimité et Lab professionnel. 1000 crédits mensuels.</p>
                 </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default AccessControl;
