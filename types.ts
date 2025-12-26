
export type Tab = 'writer' | 'studio' | 'lab' | 'live' | 'intel' | 'social' | 'profile' | 'settings' | 'admin';

export type UserRole = 'solo' | 'coach' | 'org';
export type SubscriptionTier = 'free' | 'premium' | 'business';

export interface UserAccount {
  id: string;
  username: string;
  role: UserRole;
  tier: SubscriptionTier;
  interests: string[];
  eloquenceLevel: number;
  exp: number;
  language: Language; // Préférence persistante
  avatar?: string; // Champ pour la photo de profil
  lastChallengeDate?: string; 
  dailyChallengesUsed?: number;
  address?: string; 
}

export type Language = 
  | 'fr-FR' | 'en-US' | 'es-ES' | 'pt-PT' | 'de-DE' | 'it-IT' 
  | 'ar-SA' | 'zh-CN' | 'ja-JP' | 'ru-RU' | 'hi-IN' | 'tr-TR' 
  | 'nl-NL' | 'pl-PL' | 'ko-KR' 
  | 'ln-CD' | 'sw-KE' | 'wo-SN' | 'yo-NG' | 'am-ET';

export const SUPPORTED_LANGUAGES: { code: Language; label: string; flag: string; native: string }[] = [
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷', native: 'Français' },
  { code: 'en-US', label: 'English', flag: '🇺🇸', native: 'English' },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸', native: 'Español' },
  { code: 'pt-PT', label: 'Português', flag: '🇵🇹', native: 'Português' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪', native: 'Deutsch' },
  { code: 'it-IT', label: 'Italiano', flag: '🇮🇹', native: 'Italiano' },
  { code: 'ar-SA', label: 'Arabic', flag: '🇸🇦', native: 'العربية' },
  { code: 'zh-CN', label: 'Chinese', flag: '🇨🇳', native: '简体中文' },
  { code: 'ja-JP', label: 'Japanese', flag: '🇯🇵', native: '日本語' },
  { code: 'ru-RU', label: 'Russian', flag: '🇷🇺', native: 'Русский' },
  { code: 'hi-IN', label: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
  { code: 'tr-TR', label: 'Turkish', flag: '🇹🇷', native: 'Türkçe' },
  { code: 'nl-NL', label: 'Dutch', flag: '🇳🇱', native: 'Nederlands' },
  { code: 'pl-PL', label: 'Polish', flag: '🇵🇱', native: 'Polski' },
  { code: 'ko-KR', label: 'Korean', flag: '🇰🇷', native: '한국어' },
  { code: 'ln-CD', label: 'Lingala', flag: '🇨🇩', native: 'Lingála' },
  { code: 'sw-KE', label: 'Swahili', flag: '🇰🇪', native: 'Kiswahili' },
  { code: 'wo-SN', label: 'Wolof', flag: '🇸🇳', native: 'Wolof' },
  { code: 'yo-NG', label: 'Yoruba', flag: '🇳🇬', native: 'Yorùbá' },
  { code: 'am-ET', label: 'Amharic', flag: '🇪🇹', native: 'አማርኛ' },
];

export interface StoryData {
  openingParagraph: string;
  mood: string;
  sceneAnalysis: string;
  characters: string[];
  worldBuilding: string;
  sensoryDetails: string[];
  plotTwists: string[];
  // Extended Creative Writing Analysis
  visualAnalysis: {
    lighting: string;
    composition: string;
    colorPalette: string[];
  };
  writingPrompts: {
    action: string;
    dialogue: string;
    internal: string;
  };
}

export type StoryGenre = 'fantasy' | 'scifi' | 'noir' | 'romance' | 'horror' | 'historical';

export type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export const AVAILABLE_VOICES: { name: VoiceName; label: string; description: string }[] = [
  { name: 'Kore', label: 'Kore', description: 'Deep, wisdom-infused narration' },
  { name: 'Zephyr', label: 'Zephyr', description: 'Warm, soothing professional tone' },
  { name: 'Puck', label: 'Puck', description: 'Bright, energetic and witty' },
  { name: 'Charon', label: 'Charon', description: 'Grave and resonant' },
  { name: 'Fenrir', label: 'Fenrir', description: 'Commanding and authoritative' },
];

export interface ConversationSuggestion {
  text: string;
  type: 'relance' | 'empathy' | 'humor';
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type IAMode = 'coaching' | 'debate';

export interface SessionReport {
  id: string;
  duration: number;
  confidence: number;
  clarity: number;
}

export interface LiveReaction {
  type: string;
  timestamp: number;
}

export const UI_TRANSLATIONS: Record<string, any> = {
  'fr-FR': {
    writer: "Écrivain",
    studio: "Studio",
    lab: "Lab",
    intel: "Intelligence",
    social: "Social",
    profile: "Profil",
    settings: "Paramètres",
    omni: "Omni",
  },
  'en-US': {
    writer: "Writer",
    studio: "Studio",
    lab: "Lab",
    intel: "Intelligence",
    social: "Social",
    profile: "Profile",
    settings: "Settings",
    omni: "Omni",
  }
};
