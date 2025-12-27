import React, { useState, useEffect } from "react";
import VisualLab from "./components/VisualLab";
import CreationSuite from "./components/CreationSuite";
import LiveVoiceChat from "./components/LiveVoiceChat";
import LiveRoom from "./components/LiveRoom";
import IntelligenceHub from "./components/IntelligenceHub";
import SocialFeed from "./components/SocialFeed";
import ProfilePage from "./components/ProfilePage";
import EloquenceMenu from "./components/EloquenceMenu";
import MobileNavBar from "./components/MobileNavBar";
import MobileDrawer from "./components/MobileDrawer";
import ChatBot from "./components/ChatBot";
import AccessControl from "./components/AccessControl";
import LanguageSelector from "./components/LanguageSelector";
import { Tab, Language, UserAccount } from "./types";
import { i18n } from "./services/i18nService";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./services/firebase";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("social");
  const [language, setLanguage] = useState<Language>("fr-FR");
  const [isI18nReady, setIsI18nReady] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);

  // SaaS States
  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem("muse_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [isAccessLocked, setIsAccessLocked] = useState(false);

  // Sync Language and i18n
  useEffect(() => {
    const sync = async () => {
      setIsI18nReady(false);
      await i18n.loadLanguage(language);
      setIsI18nReady(true);
    };
    sync();
  }, [language]);

  // Handle language change and persist to Firestore
  const handleLanguageChange = async (newLang: Language) => {
    setLanguage(newLang);

    if (user) {
      try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, { language: newLang });

        const updatedUser = { ...user, language: newLang };
        setUser(updatedUser);
        localStorage.setItem("muse_user", JSON.stringify(updatedUser));
      } catch (e) {
        console.error("Failed to persist language choice", e);
      }
    }
  };

  const handleUpdateUser = (updatedUser: UserAccount) => {
    setUser(updatedUser);
    localStorage.setItem("muse_user", JSON.stringify(updatedUser));
  };

  // REAL-TIME SUBSCRIPTION & PREFERENCES MONITORING
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, "users", user.id);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const newData = snap.data() as UserAccount;

        // Auto-sync language if changed remotely or at login
        if (newData.language && newData.language !== language) {
          setLanguage(newData.language);
        }

        setUser(newData);
        localStorage.setItem("muse_user", JSON.stringify(newData));
      }
    });

    return () => unsub();
  }, [user?.id, language]);

  // LOGIQUE DU TIMER PERSISTANT
  useEffect(() => {
    if (user) return;

    const TRIAL_LIMIT = 120000; // 2 minutes
    const now = Date.now();
    const storedStart = localStorage.getItem("muse_session_start");
    const startTime = storedStart ? parseInt(storedStart) : now;

    if (!storedStart) localStorage.setItem("muse_session_start", now.toString());

    const checkLock = () => {
      if (Date.now() - startTime >= TRIAL_LIMIT) {
        setIsAccessLocked(true);
        return true;
      }
      return false;
    };

    if (checkLock()) return;

    const interval = setInterval(() => {
      if (checkLock()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  const handleTabChange = (tab: Tab) => {
    if (tab !== "profile") setTargetProfileId(null);
    setActiveTab(tab);
    setIsDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isI18nReady) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
          Loading Dictionary...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f8fafc] flex flex-col md:flex-row overflow-x-hidden">
      <AccessControl
        isOpen={isAccessLocked}
        onAuthComplete={(newUser) => {
          setUser(newUser);
          if (newUser.language) setLanguage(newUser.language);
          setIsAccessLocked(false);
          localStorage.setItem("muse_user", JSON.stringify(newUser));
        }}
      />

      {activeTab !== "live" && (
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="fixed top-4 left-6 z-[60] w-12 h-12 glass rounded-2xl flex items-center justify-center border border-white/10 text-white md:hidden"
        >
          <i className="fa-solid fa-bars-staggered text-xl"></i>
        </button>
      )}

      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        language={language}
      />

      {activeTab !== "live" && (
        <div className="hidden landscape:flex md:flex">
          <EloquenceMenu
            activeTab={activeTab}
            onTabChange={handleTabChange}
            expanded={sidebarExpanded}
            onToggle={() => setSidebarExpanded(!sidebarExpanded)}
            userTier={user?.tier}
          />
        </div>
      )}

      <main
        className={`flex-1 transition-all duration-500 pb-24 md:pb-0 landscape:pb-0 ${
          activeTab !== "live" && sidebarExpanded
            ? "md:ml-64"
            : activeTab !== "live"
            ? "md:ml-20"
            : "ml-0"
        }`}
      >
        {activeTab !== "live" && (
          <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 h-16 md:h-20 flex items-center justify-between px-6">
            <div className="flex items-center space-x-3">
              <span className="hidden md:inline font-serif font-black text-xl tracking-tighter">
                SOCIAL <span className="text-[#3B82F6] italic">MUSE</span>
              </span>
              {user && (
                <span
                  className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                    user.tier === "premium"
                      ? "bg-indigo-500 text-white"
                      : user.tier === "business"
                      ? "bg-amber-500 text-black"
                      : "bg-white/10 text-zinc-500"
                  }`}
                >
                  {user.tier}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />

              {!user && (
                <button
                  onClick={() => setIsAccessLocked(true)}
                  className="hidden sm:flex px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-105 active:scale-95 items-center space-x-2 border border-white/10"
                >
                  <span>Get Started</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              )}

              <button
                onClick={() => handleTabChange("profile")}
                className="w-10 h-10 rounded-full border border-indigo-500/30 overflow-hidden ring-2 ring-indigo-500/20 hover:ring-indigo-500/50 transition-all shadow-lg active:scale-90"
              >
                <img
                  src={
                    user?.avatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || "default"}`
                  }
                  className="w-full h-full object-cover"
                  alt="me"
                />
              </button>
            </div>
          </header>
        )}

        <div className={`w-full h-full ${activeTab === "live" ? "" : "max-w-7xl mx-auto p-4 md:p-8"}`}>
          {activeTab === "writer" && <VisualLab language={language} user={user} db={db} />}
          {activeTab === "studio" && <CreationSuite language={language} user={user} />}
          {activeTab === "lab" && <LiveVoiceChat language={language} user={user} db={db} />}
          {activeTab === "live" &&
            (user?.tier === "premium" || user?.tier === "business" ? (
              <LiveRoom language={language} user={user} onBack={() => setActiveTab("social")} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <i className="fa-solid fa-lock text-6xl text-zinc-800"></i>
                <h2 className="text-2xl font-black uppercase">Live Room Verrouillée</h2>
                <button
                  onClick={() => setIsAccessLocked(true)}
                  className="px-8 py-4 bg-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                >
                  Voir les offres
                </button>
              </div>
            ))}

          {activeTab === "intel" && <IntelligenceHub language={language} user={user} />}
          {activeTab === "social" && (
            <SocialFeed
              language={language}
              onProfile={(uid) => {
                setTargetProfileId(uid);
                setActiveTab("profile");
              }}
              user={user}
              onStartLive={() => handleTabChange("live")}
            />
          )}
          {activeTab === "profile" && (
            <ProfilePage
              targetUserId={targetProfileId}
              language={language}
              onBack={() => setActiveTab("social")}
              currentAppUser={user}
              onUserUpdate={handleUpdateUser}
            />
          )}
          {activeTab === "settings" && (
            <div className="py-20 text-center space-y-4">
              <i className="fa-solid fa-gears text-5xl opacity-20"></i>
              <h2 className="text-xl font-black uppercase tracking-widest">{i18n.t("nav_settings")}</h2>
              <div className="max-w-md mx-auto p-8 glass rounded-3xl mt-8">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">
                  Préférence Linguistique
                </label>
                <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="portrait:block landscape:hidden md:hidden">
        <MobileNavBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenChat={() => setIsChatOpen(!isChatOpen)}
        />
      </div>

      <ChatBot language={language} isOpenOverride={isChatOpen} onCloseOverride={() => setIsChatOpen(false)} />
    </div>
  );
};

export default App;
