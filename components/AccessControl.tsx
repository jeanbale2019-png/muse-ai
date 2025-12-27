
import React, { useState } from 'react';
import { UserAccount, UserRole, SubscriptionTier } from '../types';
import { notifyUser } from '../services/geminiService';
import { loginUser, registerUser } from '../services/authService';

interface AccessControlProps {
  isOpen: boolean;
  onAuthComplete: (user: UserAccount) => void;
}

type AuthStep = 'register' | 'profile-type' | 'plans' | 'contact-enterprise';

const AccessControl: React.FC<AccessControlProps> = ({ isOpen, onAuthComplete }) => {
  const [step, setStep] = useState<AuthStep>('register');
  const [role, setRole] = useState<UserRole>('solo');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleAuth = async () => {
    if (!username || !email || !password) {
      notifyUser({ message: "Information Incomplete", suggestion: "Please fill in all fields to proceed with your authentication." });
      return;
    }
    
    setIsLoading(true);
    try {
      // For demo purposes, we allow entering directly or trying real auth
      const user = await registerUser(email, password, username, role, 'free');
      onAuthComplete(user);
    } catch (err: any) {
      // If user exists, try login
      if (err.code === 'auth/email-already-in-use') {
        try {
          const user = await loginUser(email, password);
          onAuthComplete(user);
        } catch (loginErr) {
          notifyUser(loginErr);
        }
      } else {
        notifyUser(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const skipToDemo = () => {
    onAuthComplete({ 
      id: 'demo_' + Math.random().toString(36).substr(2, 5), 
      username: username || 'Muse Guest', 
      role: 'solo', 
      tier: 'free', 
      interests: [], 
      eloquenceLevel: 1, 
      exp: 0, 
      language: 'fr-FR' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#000]/90 backdrop-blur-xl animate-in fade-in duration-500 p-6">
        <div className="max-w-md w-full p-10 bg-[#0c0c0e] rounded-[3rem] border border-white/10 text-center shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-xl shadow-indigo-600/20">
               <i className="fa-solid fa-shield-halved text-white text-2xl"></i>
            </div>
            
            <h1 className="text-3xl font-serif text-white mb-2 italic">Access <span className="text-indigo-500">Gateway</span></h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-10">Neural Authentication Protocol</p>
            
            <div className="space-y-4">
              <input 
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-800 text-sm" 
                  placeholder="Username" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
              />
              <input 
                  type="email"
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-800 text-sm" 
                  placeholder="Neural Mail (Email)" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
              />
              <input 
                  type="password"
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-800 text-sm" 
                  placeholder="Passkey" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
              />
            </div>

            <div className="mt-10 space-y-4">
              <button 
                  onClick={handleAuth}
                  disabled={isLoading}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center space-x-3"
              >
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>Initialize Session</span>}
              </button>
              
              <button 
                  onClick={skipToDemo}
                  className="w-full py-4 bg-white/5 text-zinc-500 hover:text-white rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all"
              >
                  Enter as Guest Observer
              </button>
            </div>
            
            <p className="mt-8 text-[9px] font-bold text-zinc-700 uppercase tracking-widest leading-relaxed">
              By entering, you agree to the <br/> Neural Usage Protocols & Privacy Shields.
            </p>
        </div>
    </div>
  );
};

export default AccessControl;
