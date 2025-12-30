
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getGallery } from '../services/geminiService';
import { initializeApp } from 'https://esm.sh/firebase@10.7.1/app';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, increment, arrayUnion, arrayRemove, getDoc } from 'https://esm.sh/firebase@10.7.1/firestore';
import { UserAccount } from '../types';

interface UserProfile {
  fullName: string;
  bio: string;
  location: string;
  avatar: string;
  interests: string[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

interface ProfilePageProps {
  targetUserId?: string | null;
  onBack: () => void;
  language: string;
  currentAppUser: UserAccount | null;
  onUserUpdate?: (user: UserAccount) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ targetUserId, onBack, language, currentAppUser, onUserUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'creations'>('posts');
  const [savedCreations, setSavedCreations] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = useMemo(() => {
    return currentAppUser?.id || localStorage.getItem('muse_userId') || 'guest';
  }, [currentAppUser]);

  // Decide which profile to display
  const effectiveUserId = targetUserId || currentUserId;
  const isOwnProfile = effectiveUserId === currentUserId;

  // Initialize Firestore
  const db = useMemo(() => {
    try {
      const firebaseConfig = { projectId: "muse-mentor-ai" }; 
      const app = initializeApp(firebaseConfig);
      return getFirestore(app);
    } catch (e) {
      return null;
    }
  }, []);

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(`muse_profile_${effectiveUserId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn("Corrupted local profile");
      }
    }
    
    // Default fallback
    return {
      fullName: isOwnProfile ? (currentAppUser?.username || "Utilisateur Muse") : effectiveUserId,
      bio: isOwnProfile ? "Créateur passionné explorant les frontières de l'IA..." : "Explorateur de l'imaginaire digital.",
      location: "Paris, France",
      avatar: (isOwnProfile && currentAppUser?.avatar) ? currentAppUser.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${effectiveUserId}`,
      interests: ["IA Générative", "Art Numérique", "Narration"],
      followersCount: 0,
      followingCount: 0,
      postsCount: 0
    };
  });

  // Load profile from Cloud & Check Follow status
  useEffect(() => {
    if (!db) return;

    // Profile listener
    const unsubProfile = onSnapshot(doc(db, "users", effectiveUserId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        // Merge with existing fields if partial
        setProfile(prev => ({ ...prev, ...data }));
        localStorage.setItem(`muse_profile_${effectiveUserId}`, JSON.stringify({ ...profile, ...data }));
      } else if (isOwnProfile) {
        // Create initial entry for self if it doesn't exist
        setDoc(doc(db, "users", effectiveUserId), profile, { merge: true });
      }
    });

    // Follow status listener (if viewing someone else)
    let unsubFollow = () => {};
    if (!isOwnProfile) {
      unsubFollow = onSnapshot(doc(db, "follows", currentUserId), (snapshot) => {
        if (snapshot.exists()) {
          const followingList = snapshot.data().following || [];
          setIsFollowing(followingList.includes(effectiveUserId));
        }
      });
    }

    return () => {
      unsubProfile();
      unsubFollow();
    };
  }, [db, effectiveUserId, currentUserId, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile) {
      setSavedCreations(getGallery());
    } else {
      setSavedCreations([]); // Only show creations for self in this version
    }
  }, [activeTab, isOwnProfile]);

  const pastCreations = [
    { id: 1, type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400', title: 'Cyber-Zen', featured: true },
    { id: 2, type: 'video', url: 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?auto=format&fit=crop&q=80&w=400', title: 'Neon Pulse' },
    { id: 3, type: 'image', url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=400', title: 'Ethereal' },
    { id: 4, type: 'image', url: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=400', title: 'Glitch Sky' },
  ];

  const featuredPost = pastCreations.find(p => p.featured) || pastCreations[0];

  const handleSave = async () => {
    setIsLoading(true);
    localStorage.setItem(`muse_profile_${effectiveUserId}`, JSON.stringify(profile));
    
    if (db) {
      try {
        await setDoc(doc(db, "users", effectiveUserId), profile, { merge: true });
        
        // Sync with global user state if it's the current user
        if (isOwnProfile && currentAppUser && onUserUpdate) {
          onUserUpdate({
            ...currentAppUser,
            username: profile.fullName,
            avatar: profile.avatar
          });
        }
      } catch (e) {
        console.error("Firebase Sync Error:", e);
      }
    }
    
    setTimeout(() => {
      setIsLoading(false);
      setIsEditing(false);
    }, 500);
  };

  const handleFollowToggle = async () => {
    if (!db || isOwnProfile) return;
    const nowFollowing = !isFollowing;
    setIsFollowing(nowFollowing); // Optimistic follow state update

    // Optimistic profile counts update
    setProfile(prev => ({
      ...prev,
      followersCount: prev.followersCount + (nowFollowing ? 1 : -1)
    }));

    try {
      // Update current user's 'following' list
      await setDoc(doc(db, "follows", currentUserId), {
        following: nowFollowing ? arrayUnion(effectiveUserId) : arrayRemove(effectiveUserId)
      }, { merge: true });

      // Update following count for current user
      await updateDoc(doc(db, "users", currentUserId), {
        followingCount: increment(nowFollowing ? 1 : -1)
      });

      // Update target user's 'follower' count
      await updateDoc(doc(db, "users", effectiveUserId), {
        followersCount: increment(nowFollowing ? 1 : -1)
      });
    } catch (e) {
      console.error("Follow error:", e);
      setIsFollowing(!nowFollowing); // Rollback follow status
      setProfile(prev => ({
        ...prev,
        followersCount: prev.followersCount + (nowFollowing ? -1 : 1)
      })); // Rollback count
    }
  };

  const handleAvatarClick = () => {
    if (isEditing && isOwnProfile) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setProfile(prev => ({ ...prev, avatar: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-[#f8f9fa] min-h-screen pb-32 font-sans text-zinc-900 selection:bg-indigo-100 animate-in fade-in duration-500">
      {/* Header Premium */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-zinc-200/50 px-5 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-zinc-100 transition-colors flex items-center justify-center text-zinc-800"
          >
            <i className="fa-solid fa-arrow-left text-lg"></i>
          </button>
          <div className="flex flex-col">
            <h1 className="font-serif font-black text-2xl tracking-tighter leading-none uppercase">
              {isOwnProfile ? 'MON ' : 'VOIR '}<span className="text-indigo-600 italic">PROFIL</span>
            </h1>
          </div>
        </div>
        {isOwnProfile && (
          <button className="text-rose-500 font-bold text-[10px] uppercase tracking-widest hover:text-rose-600 transition-colors bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
            Déconnexion
          </button>
        )}
      </header>

      <main className="max-w-xl mx-auto px-5 py-8 space-y-12">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative group">
            <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-500 shadow-2xl transition-all ${isEditing ? 'scale-110 rotate-3' : ''}`}>
              <div 
                className={`w-full h-full rounded-full bg-white border-4 border-white overflow-hidden shadow-inner relative ${isOwnProfile ? 'cursor-pointer' : ''}`}
                onClick={handleAvatarClick}
              >
                <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                {isEditing && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center hover:bg-black/60 transition-colors group">
                    <i className="fa-solid fa-camera text-white text-2xl group-hover:scale-125 transition-transform"></i>
                    <span className="text-[8px] font-black uppercase text-white mt-1">Changer</span>
                  </div>
                )}
              </div>
            </div>
            
            {!isEditing && isOwnProfile && (
              <div 
                onClick={() => setIsEditing(true)}
                className="absolute bottom-1 right-2 w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-[#f8f9fa] shadow-lg cursor-pointer hover:bg-indigo-500 transition-colors"
              >
                <i className="fa-solid fa-pen text-[10px] text-white"></i>
              </div>
            )}
            
            {isEditing && (
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#f8f9fa] shadow-lg animate-bounce">
                <i className="fa-solid fa-check text-[10px] text-white"></i>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          <div className="text-center space-y-4 w-full">
            <div className="space-y-1">
              {isEditing ? (
                 <input 
                  value={profile.fullName} 
                  onChange={e => setProfile({...profile, fullName: e.target.value})}
                  className="text-2xl font-black tracking-tight text-center bg-transparent border-b border-indigo-200 outline-none w-full max-w-xs focus:border-indigo-500"
                  placeholder="Nom complet"
                />
              ) : (
                <h2 className="text-2xl font-black tracking-tight">{profile.fullName}</h2>
              )}
              <div className="flex items-center justify-center space-x-2 text-zinc-500">
                <i className="fa-solid fa-location-dot text-[10px]"></i>
                {isEditing ? (
                  <input 
                    value={profile.location} 
                    onChange={e => setProfile({...profile, location: e.target.value})}
                    className="text-[10px] font-black uppercase tracking-widest bg-transparent border-b border-zinc-200 outline-none w-32 focus:border-indigo-500"
                    placeholder="Ville, Pays"
                  />
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest">{profile.location}</span>
                )}
              </div>
            </div>

            {/* Stats Section - Reactive Counts Display */}
            <div className="flex items-center justify-center space-x-8 py-6 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)] rounded-[2.5rem] border border-zinc-100 backdrop-blur-sm">
              <div className="flex flex-col items-center px-4 transition-all hover:scale-105">
                <span className="text-xl font-black text-zinc-900 tabular-nums">{profile.postsCount}</span>
                <span className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.2em] mt-1">Posts</span>
              </div>
              <div className="w-px h-10 bg-zinc-100"></div>
              <div className="flex flex-col items-center px-4 transition-all hover:scale-105">
                <span className="text-xl font-black text-indigo-600 tabular-nums">{profile.followersCount.toLocaleString()}</span>
                <span className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.2em] mt-1">Abonnés</span>
              </div>
              <div className="w-px h-10 bg-zinc-100"></div>
              <div className="flex flex-col items-center px-4 transition-all hover:scale-105">
                <span className="text-xl font-black text-zinc-900 tabular-nums">{profile.followingCount.toLocaleString()}</span>
                <span className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.2em] mt-1">Suivis</span>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-3 w-full max-w-sm mx-auto">
              {isOwnProfile ? (
                <button 
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  className={`w-full py-4 border rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 shadow-sm ${
                    isEditing ? 'bg-indigo-600 text-white border-transparent' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                  ) : (
                    isEditing ? "Sauvegarder" : "Editer le profil"
                  )}
                </button>
              ) : (
                <button 
                  onClick={handleFollowToggle}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 shadow-xl flex items-center justify-center space-x-2 ${
                    isFollowing 
                      ? 'bg-zinc-100 text-zinc-600 border border-zinc-200' 
                      : 'bg-indigo-600 text-white shadow-indigo-200'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <i className="fa-solid fa-user-check"></i>
                      <span>Suivi</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-user-plus"></i>
                      <span>Suivre</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="space-y-6 pt-4 border-t border-zinc-100">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 ml-1">Manifeste Personnel</label>
            {isEditing ? (
              <textarea 
                value={profile.bio} 
                onChange={e => setProfile({...profile, bio: e.target.value})}
                rows={4}
                className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none shadow-inner"
                placeholder="Exprimez votre vision..."
              />
            ) : (
              <p className="text-sm leading-relaxed text-zinc-700 font-medium bg-white/40 p-5 rounded-2xl border border-zinc-100 italic">
                "{profile.bio}"
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Gallery Tabs */}
        <div className="space-y-8 pt-4 border-t border-zinc-100">
           <div className="flex items-center justify-center space-x-4 p-1 bg-zinc-100 rounded-2xl">
              <button 
                onClick={() => setActiveTab('posts')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'posts' ? 'bg-white shadow-md text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                Public Posts
              </button>
              <button 
                onClick={() => setActiveTab('creations')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'creations' ? 'bg-white shadow-md text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                AI Creations Vault
              </button>
           </div>

           {activeTab === 'posts' ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                 {/* Highlighted Post Section */}
                 <div className="space-y-6">
                    <div className="relative group rounded-[2.5rem] overflow-hidden bg-zinc-900 aspect-[16/9] shadow-2xl border border-zinc-200/50">
                       <img src={featuredPost.url} alt="Featured" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-8 flex flex-col justify-end">
                         <div className="space-y-2">
                           <span className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400 bg-indigo-500/10 backdrop-blur-md px-3 py-1 rounded-full border border-indigo-500/20">Chef-d'œuvre</span>
                           <h3 className="text-2xl font-serif text-white italic">{featuredPost.title}</h3>
                         </div>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   {pastCreations.filter(p => !p.featured).map((post) => (
                     <div key={post.id} className="group relative aspect-square rounded-[2rem] overflow-hidden bg-zinc-100 shadow-lg border border-zinc-200/50 cursor-pointer">
                       <img src={post.url} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
                         <span className="text-white text-[9px] font-black uppercase tracking-[0.2em]">{post.title}</span>
                       </div>
                     </div>
                   ))}
                   {isOwnProfile && (
                    <div className="aspect-square rounded-[2rem] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 hover:border-indigo-300 hover:text-indigo-400 transition-all cursor-pointer bg-white/50">
                       <i className="fa-solid fa-plus text-xl mb-2"></i>
                       <span className="text-[9px] font-black uppercase tracking-widest">Nouveau Post</span>
                    </div>
                   )}
                 </div>
              </div>
           ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                 {isOwnProfile ? (
                   <>
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{(savedCreations || []).length} items in Vault</p>
                    </div>
                    
                    {(!savedCreations || savedCreations.length === 0) ? (
                      <div className="py-20 flex flex-col items-center justify-center text-center opacity-20 space-y-4">
                         <i className="fa-solid fa-box-open text-4xl"></i>
                         <p className="text-[10px] font-black uppercase tracking-widest">Vault is empty</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {(savedCreations || []).map((item) => (
                          <div key={item.id} className="group relative aspect-square rounded-[2rem] overflow-hidden bg-[#0c0c0e] shadow-xl border border-zinc-200/50 cursor-pointer group">
                            {item.type === 'video' ? (
                              <video src={item.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <img src={item.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            )}
                            
                            <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[8px] text-indigo-400 font-black uppercase mb-1">{item.type} • {item.quality}</span>
                               <p className="text-[9px] text-white font-medium line-clamp-2 italic">"{item.prompt?.substring(0, 50)}..."</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                   </>
                 ) : (
                   <div className="py-20 text-center opacity-40">
                      <i className="fa-solid fa-lock text-3xl mb-4"></i>
                      <p className="text-xs font-black uppercase tracking-widest">Le coffre de ce créateur est privé</p>
                   </div>
                 )}
              </div>
           )}
        </div>

        {/* Save Button Overlay for Edit Mode */}
        {isEditing && isOwnProfile && (
          <div className="fixed bottom-32 left-0 right-0 px-6 max-w-xl mx-auto z-[70] animate-in slide-in-from-bottom-8 duration-500">
            <button 
              onClick={handleSave}
              disabled={isLoading}
              className="w-full py-5 bg-zinc-900 text-white rounded-3xl font-black uppercase text-[11px] tracking-[0.3em] shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center border border-white/10"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Valider le profil"
              )}
            </button>
          </div>
        )}
      </main>

      {/* Navigation Footer Glass */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/80 backdrop-blur-2xl border border-zinc-200/50 rounded-full px-10 py-5 flex justify-between items-center shadow-[0_15px_35px_rgba(0,0,0,0.1)] z-50">
        <button onClick={onBack} className="text-zinc-400 text-xl transition-all hover:text-zinc-800 hover:scale-110 active:scale-90"><i className="fa-solid fa-house"></i></button>
        <button className="text-zinc-400 text-xl transition-all hover:text-zinc-800 hover:scale-110 active:scale-90"><i className="fa-solid fa-magnifying-glass"></i></button>
        <button className="text-zinc-400 text-xl transition-all hover:text-zinc-800 hover:scale-110 active:scale-90 relative">
          <i className="fa-solid fa-comment-dots"></i>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
        </button>
        <button className={`text-xl transition-all ${isOwnProfile ? 'text-indigo-600 scale-125' : 'text-zinc-400'}`}><i className="fa-solid fa-user"></i></button>
      </nav>
    </div>
  );
};

export default ProfilePage;
