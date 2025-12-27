
import { StoryData, ConversationSuggestion, VoiceName, AspectRatio, ImageSize, Language, StoryGenre } from "../types";
import { GoogleGenAI } from "@google/genai";

// --- API Client Helpers ---

const apiRequest = async (endpoint: string, body: any) => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
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

// --- User Friendly Error Handling ---

export interface UserFriendlyError {
  message: string;
  suggestion: string;
  type: 'error' | 'warning' | 'info' | 'success';
}

/**
 * Maps technical errors (API, Firebase, Network) to user-friendly messages.
 */
export const handleGeminiError = (err: any): UserFriendlyError => {
  const msg = err?.message || err?.code || String(err) || "";
  const code = err?.code || "";

  // 1. Quota & Rate Limits
  if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("too many requests")) {
    return {
      message: "Neural Capacity Reached",
      suggestion: "The Muse is currently overloaded. Please wait about 30 seconds before trying again.",
      type: 'warning'
    };
  }
  
  // 2. Network & Server Stability
  if (msg.includes("503") || msg.includes("504") || msg.includes("Service Unavailable") || msg.includes("Failed to fetch")) {
    return {
      message: "Connection Ripple",
      suggestion: "The connection to the AI gateway was interrupted. Check your internet or try refreshing.",
      type: 'error'
    };
  }

  // 3. Firebase Auth Errors
  if (code.startsWith("auth/")) {
    switch(code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return { message: "Identity Verification Failed", suggestion: "Double-check your credentials or reset your password.", type: 'warning' };
      case 'auth/network-request-failed':
        return { message: "Network Outage", suggestion: "Your device seems to be offline. Please verify your connection.", type: 'error' };
      case 'auth/email-already-in-use':
        return { message: "Identity Conflict", suggestion: "This email is already registered. Try logging in instead.", type: 'info' };
      default:
        return { message: "Authentication Error", suggestion: "Something went wrong with your session. Please sign in again.", type: 'error' };
    }
  }

  // 4. API & Feature Availability
  if (msg.includes("API_KEY") || msg.includes("501") || msg.includes("not found")) {
     return {
      message: "Access Restricted",
      suggestion: "This feature might require a premium upgrade or is currently unavailable in your region.",
      type: 'info'
    };
  }

  // 5. Safety Filters
  if (msg.toLowerCase().includes("safety") || msg.toLowerCase().includes("blocked")) {
    return {
      message: "Vision Refinement Triggered",
      suggestion: "Your request was filtered for safety. Try rephrasing your prompt to be more neutral.",
      type: 'warning'
    };
  }

  // 6. Generic Fallback
  return {
    message: "A Ripple in the Network",
    suggestion: "An unexpected glitch occurred. Try again in a few moments or adjust your input.",
    type: 'error'
  };
};

/**
 * Triggers a global toast notification.
 */
export const notifyUser = (err: any) => {
  const formatted = handleGeminiError(err);
  window.dispatchEvent(new CustomEvent('muse-toast', { detail: formatted }));
};

export const ensureApiKey = async () => {
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

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);

  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
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
    notifyUser(e);
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
    notifyUser({ message: "Storage full. Some creations might not be saved locally." });
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

// --- Stubs / Placeholders ---

export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  try {
    const res = await apiRequest('/api/ai/tts', { text, voiceName });
    return res.audioContent || null;
  } catch (e) { return null; }
};

export const playTTS = async (base64: string) => {
  if (!base64) return;
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const buffer = await decodeAudioData(decode(base64), audioCtx, 24000, 1);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
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
    return await apiRequest('/api/ai/veo-video', { prompt, aspectRatio });
  } catch (e) {
    return { url: null, videoObject: null };
  }
};

export const editImage = async (base64: string, mimeType: string, prompt: string) => {
  return null; 
};

export const generateLogo = async (brandName: string) => {
  return null; 
};

export const getAI = (): GoogleGenAI => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};
