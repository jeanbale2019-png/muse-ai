
export type Tab = 'writer' | 'timelapse' | 'studio' | 'lab' | 'live' | 'intel' | 'social' | 'profile' | 'settings' | 'admin';

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
  credits: number; 
  language: Language;
  avatar?: string;
  lastChallengeDate?: string;
  dailyChallengesUsed?: number;
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
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪', native: 'Deutsch' },
];

export interface StoryboardStep {
  id: number;
  title: string;
  visualPrompt: string;
  narrative: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  imageUrl?: string;
  videoUrl?: string;
  videoObject?: any;
}

export interface SocialPack {
  platform: 'LinkedIn' | 'Instagram' | 'TikTok' | 'YouTube' | 'Facebook';
  copy: string;
  hashtags: string[];
  suggestedTitle: string;
}

export interface BrandKit {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  fontPreference: string;
}

export interface TimelapseProject {
  id: string;
  title: string;
  roomType: string;
  stylePreset: string;
  targetAudience: string;
  language: Language;
  references: string[]; // 0-3 base64 images
  brandKit: BrandKit;
  steps: StoryboardStep[];
  socialPack?: SocialPack[];
  finalRenderUrls?: string[];
  createdAt: number;
}

export type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';

export const AVAILABLE_VOICES: { name: VoiceName; label: string; description: string }[] = [
  { name: 'Aoede', label: 'Aoede', description: 'Soft, ethereal and melodic storytelling' },
  { name: 'Kore', label: 'Kore', description: 'Deep, mature and wisdom-infused' },
  { name: 'Zephyr', label: 'Zephyr', description: 'Warm, balanced and professional' },
];

export interface StoryData {
  openingParagraph: string;
  mood: string;
  sceneAnalysis: string;
  characters: string[];
  worldBuilding: string;
  sensoryDetails: string[];
  plotTwists: string[];
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type IAMode = 'coaching' | 'debate';

export interface ConversationSuggestion {
  text: string;
  type: 'relance' | 'empathy' | 'humor';
}

export interface SessionReport {
  id: string;
  summary: string;
  eloquenceScore: number;
  suggestions: string[];
}

export interface LiveReaction {
  id: string;
  type: 'heart' | 'clap' | 'fire';
  count: number;
}

export const UI_TRANSLATIONS: Record<string, any> = {
  'fr-FR': {
    writer: "Écrivain",
    timelapse: "Timelapse",
    studio: "Studio",
    lab: "Lab",
    intel: "Intelligence",
    social: "Social",
    profile: "Profil",
    settings: "Paramètres",
  },
  'en-US': {
    writer: "Writer",
    timelapse: "Timelapse",
    studio: "Studio",
    lab: "Lab",
    intel: "Intelligence",
    social: "Social",
    profile: "Profile",
    settings: "Settings",
  }
};
