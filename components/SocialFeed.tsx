
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { handleGeminiError, encode, decode, decodeAudioData } from '../services/geminiService';
import { Language, UserAccount } from '../types';

// Imports NPM Standards (Correction de l'erreur "failed to resolve")
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, serverTimestamp, query, orderBy, limit, doc, addDoc, updateDoc } from 'firebase/firestore';

// Note: La configuration Firebase doit idéalement venir d'un fichier de config centralisé
// ou de variables d'environnement VITE_. Pour ce correctif, nous initialisons localement si besoin.

type RoomTheme = 'eloquence' | 'philosophy' | 'zen' | 'debate';
type PostType = 'photo' | 'video' | 'audio';

interface SocialPost {
  id: string;
  userId: string;
  content: string;
  media: string | null;
  type: PostType;
  timestamp: any;
  likes: number;
}

interface RoomConfig {
  id: RoomTheme;
  title: string;
  description: string;
  icon: string;
  instruction: string;
  voice: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
  color: string;
}

const ROOM_THEMES: RoomConfig[] = [
  {
    id: 'eloquence',
    title: 'The Eloquence Chamber',
    description: 'Master the art of persuasive speaking with gentle guidance.',
    icon: 'fa-microphone-lines',
    voice: 'Zephyr',
    color: 'indigo',
    instruction: "You are an eloquence coach. Provide encouraging feedback on the user's speech."
  },
  {
    id: 'philosophy',
    title: 'Socratic Circle',
    description: 'Deep inquiry into life\'s big questions.',
    icon: 'fa-brain',
    voice: 'Kore',
    color: 'emerald',
    instruction: "You are a thoughtful philosopher. Engage in a Socratic dialogue."
  },
  {
    id: 'debate',
    title: 'The Lion\'s Den',
    description: 'Sharp, fast-paced debate to test your arguments.',
    icon: 'fa-swords',
    voice: 'Fenrir',
    color: 'rose',
    instruction: "You are a sharp debater. Respectfully but firmly challenge the user's logic."
  },
  {
    id: 'zen',
    title: 'The Silent Scribe',
    description: 'A focused space where the AI listens and transcribes.',
    icon: 'fa-scroll',
    voice: 'Puck',
    color: 'amber',
    instruction: "You are a silent scribe. Do not speak. Focus purely on transcribing."
  }
];

interface SocialFeedProps {
  onBack?: () => void;
  onProfile?: (userId: string) => void;
  onStartLive?: () => void;
  language: Language;
  user: UserAccount | null;
}

const SocialFeed: React.FC<SocialFeedProps> = ({ onBack, onProfile, onStartLive, language, user }) => {
  const [view, setView] = useState<'lobby' | 'room' | 'composer'>('lobby');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('offline');
  
  // Composer States
  const [postContent, setPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Firestore Init (Safe check)
  const db = useMemo(() => {
    try {
      // Configuration Firebase publique (safe pour frontend)
      const firebaseConfig = { 
        apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY, // A définir dans .env
        projectId: "muse-mentor-ai" 
      }; 
      const app = initializeApp(firebaseConfig);
      return getFirestore(app);
    } catch (e) {
      console.warn("Firebase initialization skipped or failed in component.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!db) return;
    
    // Exemple de lecture temps réel sécurisée
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SocialPost[];
      setPosts(fetched);
      setConnectionStatus('online');
    }, (err) => {
      console.error("Firestore access denied or error:", err);
      setConnectionStatus('offline');
    });

    return () => unsub();
  }, [db]);

  // Render simplifié pour la stabilité
  return (
    <div className="bg-[#050507] min-h-screen text-white font-sans p-4">
      <header className="flex justify-between items-center mb-8">
        <h1 className="font-serif font-black text-xl">Muse Feed</h1>
        <span className={`text-xs ${connectionStatus === 'online' ? 'text-green-500' : 'text-red-500'}`}>
          ● {connectionStatus}
        </span>
      </header>

      {view === 'lobby' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {ROOM_THEMES.map(room => (
              <button key={room.id} className="glass p-4 rounded-xl text-left hover:bg-white/5 transition-colors">
                <i className={`fa-solid ${room.icon} text-${room.color}-400 mb-2`}></i>
                <h3 className="font-bold text-sm">{room.title}</h3>
              </button>
            ))}
          </div>
          
          <div className="space-y-4">
             <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Recent Activity</h2>
             {posts.length === 0 ? (
               <div className="text-center py-10 text-zinc-600 italic">Connecting to Neural Network...</div>
             ) : (
               posts.map(post => (
                 <div key={post.id} className="glass p-4 rounded-xl border border-white/5">
                   <p className="text-sm font-serif italic mb-2">"{post.content}"</p>
                   <span className="text-[10px] text-zinc-500 uppercase">{post.userId}</span>
                 </div>
               ))
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialFeed;