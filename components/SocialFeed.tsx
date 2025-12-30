
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modality, LiveServerMessage } from "@google/genai";
import { handleGeminiError, getAI, encode, decode, decodeAudioData } from '../services/geminiService';
import { Language, SessionReport, LiveReaction, UserAccount, VoiceName } from '../types';

// Firebase imports - Using esm.sh for consistent versioning
import { initializeApp } from 'https://esm.sh/firebase@10.7.1/app';
import { getFirestore, collection, onSnapshot, serverTimestamp, query, orderBy, limit, doc, setDoc, addDoc, getDoc, deleteDoc, updateDoc, increment } from 'https://esm.sh/firebase@10.7.1/firestore';

type RoomTheme = 'eloquence' | 'philosophy' | 'zen' | 'debate' | 'mythic';
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
  voice: VoiceName;
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
    id: 'mythic',
    title: 'The Mythic Archive',
    description: 'A dreamlike space for poetic narration and folklore.',
    icon: 'fa-wand-sparkles',
    voice: 'Aoede',
    color: 'fuchsia',
    instruction: "You are a poetic storyteller. Speak in ethereal, melodic metaphors."
  },
  {
    id: 'debate',
    title: 'The Lion\'s Den',
    description: 'Sharp, fast-paced debate to test your arguments.',
    icon: 'fa-swords',
    voice: 'Fenrir',
    color: 'rose',
    instruction: "You are a sharp debater. Respectfully but firmly challenge the user's logic."
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
  const [activeRoom, setActiveRoom] = useState<RoomConfig | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('offline');
  
  // Composer States
  const [activePostTab, setActivePostTab] = useState<PostType>('photo');
  const [postContent, setPostContent] = useState('');
  const [postMedia, setPostMedia] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feed States
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('muse_liked_posts');
      if (!saved) return new Set();
      const parsed = JSON.parse(saved);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      return new Set();
    }
  });

  // AI States
  const [aiStatus, setAiStatus] = useState('En attente');
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [volume, setVolume] = useState(0);

  // Refs for audio handling
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentUserId = useMemo(() => {
    const savedId = localStorage.getItem('muse_userId');
    if (savedId) return savedId;
    const newId = `User_${Math.random().toString(36).substr(2, 4)}`;
    localStorage.setItem('muse_userId', newId);
    return newId;
  }, []);

  // Safe Firestore Access
  const db = useMemo(() => {
    try {
      const firebaseConfig = { projectId: "muse-mentor-ai" }; 
      const app = initializeApp(firebaseConfig);
      return getFirestore(app);
    } catch (e) {
      console.warn("Firebase initialization failed. Operating in local-only mode.");
      return null;
    }
  }, []);

  useEffect(() => {
    let local: SocialPost[] = [];
    try {
      const saved = localStorage.getItem('muse_local_posts');
      if (saved) {
        const parsed = JSON.parse(saved);
        local = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn("Local posts load failed");
    }
    setPosts(local);

    if (!db) {
      setConnectionStatus('offline');
      return;
    }

    try {
      const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(20));
      const unsub = onSnapshot(q, {
        next: (snapshot) => {
          const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SocialPost[];
          setPosts(prev => {
            const map = new Map();
            [...fetchedPosts, ...local].forEach(p => map.set(p.id, p));
            return Array.from(map.values()).sort((a, b) => {
               const timeA = typeof a.timestamp === 'number' ? a.timestamp : a.timestamp?.toMillis?.() || 0;
               const timeB = typeof b.timestamp === 'number' ? b.timestamp : b.timestamp?.toMillis?.() || 0;
               return timeB - timeA;
            });
          });
          setConnectionStatus('online');
        },
        error: (err) => {
          if (err.code === 'permission-denied') {
            console.debug("Cloud database restricted (permission-denied). Social feed is in local-first mode.");
          } else {
            console.warn("Firestore error:", err.message);
          }
          setConnectionStatus('offline');
        }
      });
      return () => unsub();
    } catch (e) {
      setConnectionStatus('offline');
    }
  }, [db]);

  const handleCreatePost = async () => {
    if (!postContent.trim() && !postMedia) return;
    setIsPosting(true);
    
    try {
      if (editingPostId) {
        // Handle Edit
        const updatedPostData = {
          content: postContent,
          media: postMedia,
          type: activePostTab,
        };

        // Update Local State
        setPosts(prev => prev.map(p => p.id === editingPostId ? { ...p, ...updatedPostData } : p));

        // Update LocalStorage
        let local: any[] = [];
        try {
          const saved = localStorage.getItem('muse_local_posts');
          if (saved) local = JSON.parse(saved);
        } catch(e) {}
        const updatedLocal = (Array.isArray(local) ? local : []).map((p: any) => p.id === editingPostId ? { ...p, ...updatedPostData } : p);
        localStorage.setItem('muse_local_posts', JSON.stringify(updatedLocal));

        // Update Cloud if online
        if (db && connectionStatus === 'online' && !editingPostId.startsWith('local_')) {
          try {
            const postRef = doc(db, "posts", editingPostId);
            await updateDoc(postRef, updatedPostData);
          } catch (e) {
            console.debug("Cloud update failed.");
          }
        }
      } else {
        // Handle New Post
        const newPost: SocialPost = {
          id: `local_${Date.now()}`,
          userId: currentUserId,
          content: postContent,
          media: postMedia,
          type: activePostTab,
          timestamp: Date.now(),
          likes: 0
        };

        let local: any[] = [];
        try {
          const saved = localStorage.getItem('muse_local_posts');
          if (saved) local = JSON.parse(saved);
        } catch(e) {}
        const safeLocal = Array.isArray(local) ? local : [];
        localStorage.setItem('muse_local_posts', JSON.stringify([newPost, ...safeLocal].slice(0, 50)));
        setPosts(prev => [newPost, ...prev]);

        if (db && connectionStatus === 'online') {
          try {
            await addDoc(collection(db, "posts"), { ...newPost, timestamp: serverTimestamp() });
          } catch (e) {
            console.debug("Cloud save failed (local persistent only).");
          }
        }
      }
      
      setPostContent('');
      setPostMedia(null);
      setEditingPostId(null);
      setView('lobby');
    } catch (err) {
      console.error(err);
    } finally {
      setIsPosting(false);
    }
  };

  const startEdit = (post: SocialPost) => {
    setEditingPostId(post.id);
    setPostContent(post.content);
    setPostMedia(post.media);
    setActivePostTab(post.type);
    setView('composer');
  };

  const handleLike = (postId: string) => {
    const isLiked = likedPosts.has(postId);
    const newLiked = new Set(likedPosts);
    isLiked ? newLiked.delete(postId) : newLiked.add(postId);
    setLikedPosts(newLiked);
    localStorage.setItem('muse_liked_posts', JSON.stringify([...newLiked]));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p));
  };

  const startRoom = async (room: RoomConfig) => {
    setActiveRoom(room);
    setView('room');
    setAiStatus('Connecting...');
    setTranscripts([]);

    try {
      const ai = getAI();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setAiStatus('Listening');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const sum = inputData.reduce((a, b) => a + Math.abs(b), 0);
              setVolume(sum / inputData.length * 1000);

              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputCtx.state !== 'closed') {
              setAiStatus('Speaking');
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setAiStatus('Listening');
              };
            }
            if (message.serverContent?.inputTranscription) {
              setTranscripts(prev => [...prev.slice(-5), `You: ${message.serverContent?.inputTranscription?.text}`]);
            }
            if (message.serverContent?.outputTranscription) {
              setTranscripts(prev => [...prev.slice(-5), `Muse: ${message.serverContent?.outputTranscription?.text}`]);
            }
          },
          onerror: (e) => {
            handleGeminiError(e);
            setAiStatus('Error');
          },
          onclose: () => {
            endSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: room.voice } } },
          systemInstruction: `${room.instruction} Respond in ${language}.`,
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      handleGeminiError(err);
      setView('lobby');
    }
  };

  const endSession = () => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => s.close());
      sessionPromiseRef.current = null;
    }
    
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(() => {});
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(() => {});
    }
    outputAudioContextRef.current = null;

    setView('lobby');
  };

  return (
    <div className="bg-[#050507] min-h-screen text-white font-sans overflow-hidden relative">
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-6 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center space-x-4">
          <button 
            onClick={view === 'lobby' ? onBack : () => {setView('lobby'); setEditingPostId(null); setPostContent(''); setPostMedia(null);}} 
            className="group flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-white/5 border border-white/10 transition-all active:scale-95"
            title="Return to Studio"
          >
            <i className="fa-solid fa-chevron-left text-zinc-500 group-hover:text-indigo-400"></i>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white hidden sm:inline">
              {view === 'lobby' ? 'Back to Studio' : 'Cancel'}
            </span>
          </button>
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
          <h1 className="font-serif font-black text-xl tracking-tighter uppercase leading-none">
            Muse <span className="text-indigo-500 italic">Feed</span>
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          {/* Start Live Quick Action */}
          <button 
            onClick={onStartLive}
            className="group flex items-center space-x-2 px-4 py-2 bg-rose-600/10 border border-rose-500/20 rounded-xl text-rose-500 hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-lg shadow-rose-600/5"
            title="Start your own Live Session"
            aria-label="Start a live session"
          >
            <div className="relative">
              <i className="fa-solid fa-video text-xs group-hover:scale-110 transition-transform"></i>
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Go Live</span>
          </button>

          <div className="hidden md:flex flex-col items-end">
             <div className={`px-2 py-0.5 rounded-md border border-white/10 text-[7px] font-black uppercase tracking-widest flex items-center space-x-1 ${connectionStatus === 'online' ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-500/10'}`}>
                <div className={`w-1 h-1 rounded-full ${connectionStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                <span>{connectionStatus}</span>
             </div>
             <span className="text-[6px] text-zinc-600 uppercase font-black mt-0.5">Real-time Node</span>
          </div>
          <button 
            onClick={() => onProfile?.(currentUserId)} 
            className="w-10 h-10 rounded-full border border-indigo-500/30 overflow-hidden ring-2 ring-indigo-500/20 hover:ring-indigo-500/50 transition-all shadow-lg active:scale-90"
          >
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`} className="w-full h-full" alt="me" />
          </button>
        </div>
      </header>

      {view === 'lobby' && (
        <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-12 h-[calc(100vh-80px)] overflow-y-auto no-scrollbar">
          {/* Studios Row */}
          <section className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Live Studios</h2>
              <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">Gemini 2.5 Native</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ROOM_THEMES.map(room => (
                <button key={room.id} onClick={() => startRoom(room)} className="glass p-5 rounded-[2rem] border border-white/5 bg-black/40 hover:border-indigo-500/30 transition-all text-center space-y-3 group hover:-translate-y-1 shadow-xl">
                  <div className={`w-12 h-12 mx-auto bg-${room.color}-500/10 rounded-2xl flex items-center justify-center border border-${room.color}-500/20 group-hover:scale-110 transition-transform shadow-inner`}>
                    <i className={`fa-solid ${room.icon} text-xl text-${room.color}-400`}></i>
                  </div>
                  <h3 className="text-xs font-serif italic">{room.title}</h3>
                </button>
              ))}
            </div>
          </section>

          {/* Social Stream */}
          <section className="space-y-8 pb-32">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 px-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Community Stream</h2>
              <button onClick={() => setView('composer')} className="text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors flex items-center space-x-2 bg-indigo-500/5 px-4 py-2 rounded-full border border-indigo-500/10">
                <i className="fa-solid fa-plus"></i>
                <span>New Vision</span>
              </button>
            </div>

            <div className="space-y-6">
              {posts.length === 0 ? (
                <div className="py-24 text-center space-y-4 opacity-20 grayscale">
                   <i className="fa-solid fa-satellite-dish text-5xl"></i>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em]">Signal is low. Start the broadcast.</p>
                </div>
              ) : (
                posts.map(post => (
                  <article key={post.id} className="glass rounded-[2.5rem] overflow-hidden border border-white/5 bg-black/40 hover:border-indigo-500/10 transition-all flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                    {post.media && (
                      <div className="w-full md:w-[300px] aspect-video md:aspect-square relative overflow-hidden bg-zinc-900 flex-shrink-0">
                        <img src={post.media} className="w-full h-full object-cover" alt="Post media" />
                      </div>
                    )}
                    <div className="p-6 md:p-8 flex-1 space-y-4 flex flex-col relative">
                      {/* Author & Edit Action */}
                      <div className="flex justify-between items-start">
                        <button 
                          onClick={() => onProfile?.(post.userId)}
                          className="flex items-center space-x-3 self-start hover:bg-white/10 p-2 -ml-2 rounded-2xl transition-all group/author active:scale-95"
                        >
                          <div className="relative">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.userId}`} className="w-10 h-10 rounded-full bg-zinc-800 ring-2 ring-white/5 group-hover/author:ring-indigo-500/50 transition-all duration-300 shadow-lg" alt="avatar" />
                            <div className="absolute inset-0 rounded-full bg-indigo-500/0 group-hover/author:bg-indigo-500/10 transition-colors duration-300"></div>
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-tighter group-hover/author:text-indigo-300 transition-colors group-hover/author:underline decoration-indigo-500/30 underline-offset-4">
                              {post.userId}
                            </span>
                            <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
                                {new Date(typeof post.timestamp === 'number' ? post.timestamp : post.timestamp?.toMillis?.() || Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                        </button>

                        {post.userId === currentUserId && (
                          <button 
                            onClick={() => startEdit(post)}
                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all active:scale-90"
                            title="Edit Post"
                          >
                            <i className="fa-solid fa-pen-to-square text-sm"></i>
                          </button>
                        )}
                      </div>

                      <p className="text-sm md:text-base font-serif italic text-zinc-300 leading-relaxed flex-1">"{post.content}"</p>
                      
                      <div className="flex items-center space-x-6 pt-4 border-t border-white/5">
                        <button onClick={() => handleLike(post.id)} className={`flex items-center space-x-2 transition-all ${likedPosts.has(post.id) ? 'text-rose-500 scale-110' : 'text-zinc-500 hover:text-white'}`}>
                          <i className={`fa-${likedPosts.has(post.id) ? 'solid' : 'regular'} fa-heart`}></i>
                          <span className="text-[10px] font-black">{post.likes}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Floating Action Button */}
          <button onClick={() => {setEditingPostId(null); setPostContent(''); setPostMedia(null); setView('composer');}} className="fixed bottom-10 right-10 w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40 hover:scale-110 hover:bg-indigo-500 active:scale-95 transition-all z-[60] border border-white/20">
            <i className="fa-solid fa-plus text-2xl"></i>
          </button>
        </main>
      )}

      {view === 'composer' && (
        <main className="max-w-2xl mx-auto p-4 md:p-8 animate-in slide-in-from-bottom-8 duration-500 pt-12">
          <div className="glass p-6 md:p-12 rounded-[3rem] border border-white/10 space-y-8 bg-black/40 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-6">
              <h2 className="text-2xl font-serif italic">{editingPostId ? 'Edit' : 'New'} <span className="text-indigo-400">Creation</span></h2>
              <div className="flex p-1 bg-white/5 rounded-xl">
                {(['photo', 'video', 'audio'] as PostType[]).map(tab => (
                  <button key={tab} onClick={() => setActivePostTab(tab)} className={`px-4 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${activePostTab === tab ? 'bg-white text-black' : 'text-zinc-500'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <textarea 
              value={postContent} 
              onChange={e => setPostContent(e.target.value)}
              className="w-full bg-transparent text-xl md:text-2xl font-serif italic outline-none resize-none min-h-[100px] placeholder:text-zinc-800"
              placeholder="What's on your mind?..."
            />

            {/* Dedicated Photo Upload Area */}
            {activePostTab === 'photo' && (
              <div className="space-y-4">
                {postMedia ? (
                  <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
                    <img src={postMedia} className="w-full h-full object-cover" alt="upload" />
                    <button 
                      onClick={() => setPostMedia(null)} 
                      className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-video rounded-[2.5rem] border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center cursor-pointer group space-y-4"
                  >
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 group-hover:scale-110 transition-transform">
                      <i className="fa-solid fa-cloud-arrow-up text-2xl text-zinc-500 group-hover:text-indigo-400"></i>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">Click to upload photo</p>
                      <p className="text-[8px] text-zinc-600 uppercase tracking-tighter mt-1">High resolution supported</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-white/5">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activePostTab === 'photo' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-500 hover:text-white bg-white/5'}`}
                  title="Attach File"
                >
                  <i className="fa-solid fa-paperclip"></i>
                </button>
                <div className="hidden sm:flex flex-col">
                  <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest">Attachment</span>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase">{postMedia ? 'File Ready' : 'None Selected'}</span>
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      setPostMedia(reader.result as string);
                      setActivePostTab('photo'); // Auto-switch to photo tab on upload
                    };
                    reader.readAsDataURL(file);
                  }
                }} 
              />
              
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => {setView('lobby'); setEditingPostId(null); setPostContent(''); setPostMedia(null);}} 
                  className="px-6 py-4 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreatePost} 
                  disabled={isPosting || (!postContent.trim() && !postMedia)} 
                  className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
                >
                  {isPosting ? 'Broadcasting...' : editingPostId ? 'Update Vision' : 'Share Vision'}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {view === 'room' && (
        <main className="flex h-[calc(100vh-80px)] animate-in fade-in duration-700">
          <div className="flex-1 relative flex flex-col items-center justify-center p-12">
            <div className="text-center space-y-4">
              <div className="w-48 h-48 mx-auto relative">
                <div className={`absolute inset-0 rounded-full border-2 border-indigo-500/20 ${aiStatus === 'Speaking' ? 'animate-[ping_2s_infinite]' : 'animate-pulse'}`}></div>
                <div className="w-full h-full rounded-full glass flex items-center justify-center border border-white/10">
                  <i className={`fa-solid ${activeRoom?.icon} text-4xl text-indigo-400`}></i>
                </div>
              </div>
              <h2 className="text-2xl font-serif italic">{aiStatus}...</h2>
              <div className="h-8 flex items-end justify-center space-x-1">
                {[...Array(16)].map((_, i) => (
                  <div key={i} className="w-1 bg-indigo-500/40 rounded-full transition-all" style={{ height: `${2 + (volume * Math.random())}px` }}></div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-10 text-center">
              <p className="text-2xl font-serif italic text-zinc-300 leading-relaxed">
                {transcripts[transcripts.length - 1]?.split(': ')[1] || "Awaiting signal..."}
              </p>
            </div>

            <div className="absolute bottom-10 right-10 flex space-x-4">
              <button onClick={endSession} className="px-10 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-rose-500 transition-all">
                Terminate Session
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default SocialFeed;
