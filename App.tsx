
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { UserAccount, Tab, Language } from './types';
import Auth from './components/Auth';
import VisualLab from './components/VisualLab';
import CreationSuite from './components/CreationSuite';
import LiveVoiceChat from './components/LiveVoiceChat';
import LiveRoom from './components/LiveRoom';
import IntelligenceHub from './components/IntelligenceHub';
import SocialFeed from './components/SocialFeed';
import ProfilePage from './components/ProfilePage';
import EloquenceMenu from './components/EloquenceMenu';
import MobileNavBar from './components/MobileNavBar';
import ChatBot from './components/ChatBot';
import LanguageSelector from './components/LanguageSelector';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('social');
  const [language, setLanguage] = useState<Language>('fr-FR');
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserAccount);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setTargetProfileId(null);
  };

  const handleUpdateUser = (updatedUser: UserAccount) => {
    setUser(updatedUser);
  };

  const navigateToProfile = (uid: string) => {
    setTargetProfileId(uid);
    setActiveTab('profile');
  };

  const handleTabChange = (tab: Tab) => {
    if (tab !== 'profile') setTargetProfileId(null);
    setActiveTab(tab);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={(userData) => setUser(userData)} />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f8fafc] flex flex-col md:flex-row overflow-x-hidden">
      <div className="hidden landscape:flex md:flex">
        <EloquenceMenu 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          userTier={user.tier}
        />
      </div>

      <main className={`flex-1 transition-all duration-500 pb-24 md:pb-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
        <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 h-16 md:h-20 flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <span className="font-serif font-black text-xl tracking-tighter cursor-pointer" onClick={() => handleTabChange('social')}>SOCIAL <span className="text-indigo-500 italic">MUSE</span></span>
            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[7px] font-black uppercase tracking-widest">{user.tier}</span>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSelector currentLanguage={language} onLanguageChange={setLanguage} />
            <button onClick={handleLogout} className="text-[8px] font-black uppercase tracking-widest text-zinc-500 hover:text-rose-500">Déconnexion</button>
            <button onClick={() => navigateToProfile(user.id)} className="w-10 h-10 rounded-full border border-indigo-500/30 overflow-hidden ring-2 ring-indigo-500/10 hover:ring-indigo-500/50 transition-all">
              <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-full h-full object-cover" alt="me" />
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {activeTab === 'writer' && <VisualLab language={language} user={user} db={db} />}
          {activeTab === 'studio' && <CreationSuite language={language} user={user} />}
          {activeTab === 'lab' && <LiveVoiceChat language={language} user={user} db={db} />}
          {activeTab === 'live' && <LiveRoom language={language} user={user} onBack={() => handleTabChange('social')} />}
          {activeTab === 'intel' && <IntelligenceHub language={language} user={user} />}
          {activeTab === 'social' && <SocialFeed language={language} user={user} onProfile={navigateToProfile} />}
          {activeTab === 'profile' && (
            <ProfilePage 
              targetUserId={targetProfileId} 
              onBack={() => handleTabChange('social')} 
              language={language} 
              currentAppUser={user} 
              onUserUpdate={handleUpdateUser}
            />
          )}
        </div>
      </main>

      <div className="md:hidden">
        <MobileNavBar activeTab={activeTab} onTabChange={handleTabChange} onOpenChat={() => {}} />
      </div>
      <ChatBot language={language} />
    </div>
  );
};

export default App;
