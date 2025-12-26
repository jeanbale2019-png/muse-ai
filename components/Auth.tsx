
import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { UserAccount } from '../types';

interface AuthProps {
  onAuthSuccess: (user: UserAccount) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid = isLogin 
    ? (email && password) 
    : (email && password && name && address);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Connexion
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        
        if (userDoc.exists()) {
          onAuthSuccess(userDoc.data() as UserAccount);
        } else {
          // Cas rare: Auth existe mais pas le profil Firestore
          throw new Error("Profil utilisateur introuvable.");
        }
      } else {
        // Inscription
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const userData: UserAccount = {
          id: userCred.user.uid,
          username: name,
          role: 'solo',
          tier: 'free',
          interests: [],
          eloquenceLevel: 1,
          exp: 0,
          language: 'fr-FR',
          address: address // Ajouté aux types si nécessaire
        };

        await setDoc(doc(db, "users", userCred.user.uid), {
          ...userData,
          email: email,
          createdAt: new Date().toISOString()
        });

        onAuthSuccess(userData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue lors de l'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.4)]">
            <i className="fa-solid fa-m text-white text-3xl"></i>
          </div>
          <h1 className="text-4xl font-serif font-black italic text-white uppercase tracking-tighter">
            SOCIAL <span className="text-indigo-400">MUSE</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
            Elite Communication Network
          </p>
        </div>

        <form onSubmit={handleAuth} className="glass p-8 rounded-[3rem] border border-white/5 space-y-5 bg-black/40">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-bold uppercase tracking-widest text-center">
              {error}
            </div>
          )}

          {!isLogin && (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2">Nom Complet</label>
                <input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-zinc-500 ml-2">Adresse</label>
                <input 
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50 transition-all"
                  placeholder="123 Rue de la Muse, Paris"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-zinc-500 ml-2">Email</label>
            <input 
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50 transition-all"
              placeholder="votre@email.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-zinc-500 ml-2">Mot de passe</label>
            <input 
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={!isFormValid || loading}
            className="w-full py-5 bg-indigo-600 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
          >
            {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : (isLogin ? "Se Connecter" : "S'Enregistrer")}
          </button>

          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors py-2"
          >
            {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
