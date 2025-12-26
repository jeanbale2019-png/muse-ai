
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getGallery } from '../services/geminiService';
import { UserAccount } from '../types';

// Central Firebase imports
import { db } from '../services/firebase';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  increment, 
  arrayUnion, 
  arrayRemove,
  getDoc
} from 'firebase/firestore';

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

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(`muse_profile_${effectiveUserId}`);
    if (saved) return JSON.parse(saved);
    
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
      setSavedCreations([]); // Only show creations for self in this version for privacy
    }
  }, [activeTab, isOwnProfile]);

  const pastCreations = [
    { id: 1, type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400', title: 'Cyber-Zen', featured: true },
    { id: 2, type: 'video', url: 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?auto=format&fit=crop&q=80&w=400', title: 'Neon Pulse' },
    { id: 3, type: 'image', url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=400', title: 'Ethereal' },
    { id: 4, type: 'image', url: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=400', title: 'Glitch Sky' },
  ];

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
      // Update current user's 'following' list in 'follows' collection
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
      // Rollback on failure
      setIsFollowing(!nowFollowing);
      setProfile(prev => ({
        ...prev,
        followersCount: prev.followersCount + (nowFollowing ? -1 : 1)
      }));
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

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div className="text-center space-y-4 w-full">
            <div className="space-y-1">
              {isEditing ? (
                 <input 
                  value={profile.fullName} 
                  onChange={e => setProfile({...profile, fullName: e.target.value})}
                  className="text-2xl font-black tracking-tight text-center bg-transparent border-b border-indigo-200 outline-none w-full max-w-xs focus:border-indigo-500"
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
                  />
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest">{profile.location}</span>
                )}
              </div>
            </div>

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

        <div className="space-y-6 pt-4 border-t border-zinc-100">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 ml-1">Manifeste Personnel</label>
            {isEditing ? (
              <textarea 
                value={profile.bio} 
                onChange={e => setProfile({...profile, bio: e.target.value})}
                rows={4}
                className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-sm focus:outline-none shadow-inner"
                placeholder="Décrivez votre vision..."
              />
            ) : (
              <p className="text-sm leading-relaxed text-zinc-700 font-medium bg-white/40 p-5 rounded-2xl border border-zinc-100 italic">
                "{profile.bio}"
              </p>
            )}
          </div>
        </div>

        <div className="space-y-8 pt-4 border-t border-zinc-100">
           <div className="flex items-center justify-center space-x-4 p-1 bg-zinc-100 rounded-2xl">
              <button onClick={() => setActiveTab('posts')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'posts' ? 'bg-white shadow-md text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}>Posts</button>
              <button onClick={() => setActiveTab('creations')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'creations' ? 'bg-white shadow-md text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}>Vault</button>
           </div>

           {activeTab === 'posts' ? (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500">
                   {pastCreations.map((post) => (
                     <div key={post.id} className="group relative aspect-square rounded-[2rem] overflow-hidden shadow-lg border border-zinc-200/50 cursor-pointer">
                       <img src={post.url} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                       <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     </div>
                   ))}
                   {isOwnProfile && (
                    <div className="aspect-square rounded-[2rem] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 hover:border-indigo-300 hover:text-indigo-400 transition-all cursor-pointer">
                       <i className="fa-solid fa-plus text-xl mb-2"></i>
                       <span className="text-[8px] font-black uppercase">Nouveau Post</span>
                    </div>
                   )}
              </div>
           ) : (
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                 {isOwnProfile ? (
                    <div className="grid grid-cols-2 gap-4">
                        {savedCreations.length > 0 ? savedCreations.map((item) => (
                          <div key={item.id} className="group relative aspect-square rounded-[2rem] overflow-hidden bg-[#0c0c0e] shadow-xl border border-zinc-200/50 cursor-pointer">
                            <img src={item.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Creation" />
                            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[7px] font-black uppercase text-indigo-400">{item.type}</div>
                          </div>
                        )) : (
                          <div className="col-span-2 py-20 text-center opacity-20">
                            <i className="fa-solid fa-box-open text-4xl mb-4"></i>
                            <p className="text-[10px] font-black uppercase tracking-widest">Le coffre est vide</p>
                          </div>
                        )}
                    </div>
                 ) : (
                   <div className="py-20 text-center opacity-40">
                      <i className="fa-solid fa-lock text-3xl mb-4"></i>
                      <p className="text-xs font-black uppercase tracking-widest">Le coffre de ce créateur est privé</p>
                   </div>
                 )}
              </div>
           )}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
