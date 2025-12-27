
import { StoryData, ConversationSuggestion, VoiceName, AspectRatio, ImageSize, Language, StoryGenre } from "../types";

// --- API Client Helpers ---

const apiRequest = async (endpoint: string, body: any) => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    // Gestion spécifique des erreurs HTTP
    if (!response.ok) {
      if (response.status === 501) console.warn(`Feature ${endpoint} not implemented on backend.`);
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Call Failed (${endpoint}):`, error);
    throw error;
  }
};

// --- Utilities (Client Side) ---

export const handleGeminiError = (err: any) => {
  console.error("AI Operation Failed:", err);
  // Ici vous pouvez déclencher un Toast/Notification global si vous avez un contexte
  return false;
};

export const ensureApiKey = async () => {
  // Côté frontend BFF, la clé est sur le serveur. 
  // On peut faire un ping health check pour vérifier que le backend est prêt.
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch (e) {
    return false;
  }
};

// --- Audio / Binary Utils ---

export function decode(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const buffer = ctx.createBuffer(numChannels, data.length / numChannels, sampleRate);
  // Implémentation simplifiée pour PCM 16bit mono/stereo
  const channelData = buffer.getChannelData(0);
  const dataView = new DataView(data.buffer);
  for (let i = 0; i < channelData.length; i++) {
    // Supposant 16-bit PCM little endian
    const int16 = dataView.getInt16(i * 2, true); 
    channelData[i] = int16 / 32768.0;
  }
  return buffer;
}

export function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
  // Stub simple pour éviter les erreurs de build
  // Une vraie implémentation WAV nécessite un header RIFF complet
  return new Blob([pcmData], { type: 'audio/wav' });
}

export function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadFromUrl(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    console.error("Download failed", e);
  }
}

// --- Local Storage Helpers ---

export const saveToGallery = (item: any) => {
  try {
    const saved = localStorage.getItem('muse_creations');
    const gallery = saved ? JSON.parse(saved) : [];
    const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
    gallery.unshift(newItem);
    localStorage.setItem('muse_creations', JSON.stringify(gallery.slice(0, 100)));
    return newItem;
  } catch (e) {
    console.warn("Storage quota exceeded");
    return item;
  }
};

export const getGallery = () => {
  try {
    return JSON.parse(localStorage.getItem('muse_creations') || '[]');
  } catch { return []; }
};

// --- AI Core Features (via Backend) ---

export const analyzeImageAndGhostwrite = async (
  base64: string, 
  mimeType: string, 
  language: Language = 'fr-FR', 
  genre: StoryGenre = 'fantasy'
): Promise<StoryData> => {
  return await apiRequest('/api/ai/analyze-image', { base64, mimeType, language, genre });
};

export const chatWithGemini = async (
  history: { role: 'user' | 'model'; text: string }[], 
  message: string, 
  language: Language
) => {
  const res = await apiRequest('/api/ai/chat', { history, message, language });
  return res.text;
};

export const getConversationSuggestions = async (text: string, language: Language): Promise<ConversationSuggestion[]> => {
  return await apiRequest('/api/ai/suggestions', { text, language });
};

// --- Stubs / Placeholders for Phase 2/3 Features ---
// Ces fonctions existent pour que TypeScript compile, mais elles appellent le backend
// qui peut renvoyer 501 (Not Implemented) proprement.

export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  try {
    const res = await apiRequest('/api/ai/tts', { text, voiceName });
    return res.audioContent || null;
  } catch (e) { return null; }
};

export const playTTS = async (base64: string) => {
  if (!base64) return;
  // TODO: Implémenter le lecteur audio buffer simple
  console.log("Audio playback requested (stub)");
};

export const generateProImage = async (prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize) => {
  console.warn("Pro Image generation (Imagen) via backend is pending implementation.");
  return null;
};

export const generateVeoVideo = async (
  prompt: string, 
  imageBase64?: string, 
  mimeType?: string, 
  aspectRatio?: string, 
  resolution?: string
) => {
  try {
    // On tente d'appeler le backend, qui renverra probablement un mock
    return await apiRequest('/api/ai/veo-video', { prompt, aspectRatio });
  } catch (e) {
    return { url: null, videoObject: null };
  }
};

export const editImage = async (base64: string, mimeType: string, prompt: string) => {
  return null; // Mock
};

export const generateLogo = async (brandName: string) => {
  return null; // Mock
};

// --- Legacy / Compatibility ---

// CRITICAL: Le composant VisualLab utilise getAI().live.connect.
// Puisque nous sommes en BFF, nous ne pouvons pas exposer l'objet `ai` directement connecté.
// Pour que le build passe, on retourne un mock qui throw une erreur explicite à l'exécution,
// ou on gère ça proprement.
export const getAI = (): any => {
  return {
    live: {
      connect: async (options: any) => {
        throw new Error("Live API requires Client-Side WebSocket. Currently migrated to REST API security. Feature temporarily disabled.");
      }
    },
    models: {
      generateContent: async (options: any) => { throw new Error("Use analyzeImageAndGhostwrite instead of direct SDK call."); }
    }
  };
};
