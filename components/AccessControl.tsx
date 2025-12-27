import React, { useState } from 'react';
import { UserAccount, UserRole, SubscriptionTier } from '../types';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

interface AccessControlProps {
  isOpen: boolean;
  onAuthComplete: (user: UserAccount) => void;
}

type AuthStep = 'register' | 'profile-type' | 'plans' | 'contact-enterprise';

const AccessControl: React.FC<AccessControlProps> = ({ isOpen, onAuthComplete }) => {
  const [step, setStep] = useState<AuthStep>('register');
  const [role, setRole] = useState<UserRole>('solo');
  const [username, setUsername] = useState('');
  
  // ... (Logic remains, just ensure imports above are clean)

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#000] animate-in fade-in duration-500">
        <div className="max-w-md w-full p-8 bg-[#111] rounded-[2rem] border border-white/10 text-center">
            <h1 className="text-2xl font-serif text-white mb-6">Access Control</h1>
            <input 
                className="w-full bg-black border border-white/20 p-4 rounded-xl text-white mb-4" 
                placeholder="Username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
            />
            <button 
                onClick={() => onAuthComplete({ id: 'demo', username: username || 'User', role: 'solo', tier: 'free', interests: [], eloquenceLevel: 1, exp: 0, language: 'fr-FR' })}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase"
            >
                Enter Demo
            </button>
        </div>
    </div>
  );
};

export default AccessControl;