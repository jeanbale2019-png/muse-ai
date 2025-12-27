import {
  StoryData,
  ConversationSuggestion,
  VoiceName,
  AspectRatio,
  ImageSize,
  Language,
  StoryGenre,
} from "../types";

// ----------------------------------------------------
// API Client Helpers
// ----------------------------------------------------

const apiRequest = async (endpoint: string, body: any) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 501) console.warn(`Feature ${endpoint} not implemented on backend.`);
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as any).error || `Server Error: ${response.status}`);
  }

  return await response.json();
};

// ----------------------------------------------------
// Compatibility / Global helpers (kept for old components)
// ----------------------------------------------------

export const handleGeminiError = (err: any) => {
  console.error("AI Operation Failed:", err);
  return false;
};

/**
 * Since API key is now server-side, we just check if backend is alive.
 */
export const ensureApiKey = async () => {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
};

// ----------------------------------------------------
// Audio / Binary Utils
// ----------------------------------------------------

export function decode(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  // Minimal PCM 16-bit little-endian implementation
  const frameCount = Math.floor(data.byteLength / 2 / numChannels);
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  const view = new DataView(data.buffer);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      const index = (i * numChannels + ch) * 2;
      const int16 = view.getInt16(index, true);
      channelData[i] = int16 / 32768.0;
    }
  }

  return buffer;
}

export function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
  // Simple working WAV writer (PCM 16-bit mono)
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample

  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([view], { type: "audio/wav" });
}

export function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
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
    // fallback direct
    triggerDownload(url, filename);
  }
}

// ----------------------------------------------------
// Local Storage Helpers
// ----------------------------------------------------

export const saveToGallery = (item: any) => {
  try {
    const saved = localStorage.getItem("muse_creations");
    const gallery = saved ? JSON.parse(saved) : [];
    const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
    gallery.unshift(newItem);
    localStorage.setItem("muse_creations", JSON.stringify(gallery.slice(0, 100)));
    return newItem;
  } catch (e) {
    console.warn("Storage quota exceeded");
    return item;
  }
};

export const getGallery = () => {
  try {
    return JSON.parse(localStorage.getItem("muse_creations") || "[]");
  } catch {
    return [];
  }
};

// ----------------------------------------------------
// AI Core Features (via Backend /api/ai/*)
// ----------------------------------------------------

export const analyzeImageAndGhostwrite = async (
  base64: string,
  mimeType: string,
  language: Language = "fr-FR",
  genre: StoryGenre = "fantasy"
): Promise<StoryData> => {
  return await apiRequest("/api/ai/analyze-image", { base64, mimeType, language, genre });
};

export const chatWithGemini = async (
  history: { role: "user" | "model"; text: string }[],
  message: string,
  language: Language
) => {
  const res = await apiRequest("/api/ai/chat", { history, message, language });
  return res.text;
};

export const getConversationSuggestions = async (
  text: string,
  language: Language
): Promise<ConversationSuggestion[]> => {
  return await apiRequest("/api/ai/suggestions", { text, language });
};

// ----------------------------------------------------
// Phase 2/3 endpoints (backend may respond 501)
// ----------------------------------------------------

export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  try {
    const res = await apiRequest("/api/ai/tts", { text, voiceName });
    // Expect: { audioBase64: "...." } OR { audioContent: "...." }
    return res.audioBase64 || res.audioContent || null;
  } catch {
    return null;
  }
};

export const playTTS = async (base64: string) => {
  if (!base64) return;
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
};

export const generateProImage = async (prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize) => {
  try {
    const res = await apiRequest("/api/ai/pro-image", { prompt, aspectRatio, imageSize });
    return res.dataUrl || null; // if backend implements it later
  } catch {
    return null;
  }
};

export const generateVeoVideo = async (
  prompt: string,
  imageBase64?: string,
  mimeType?: string,
  aspectRatio: "16:9" | "9:16" = "16:9",
  resolution: "720p" | "1080p" = "720p"
) => {
  try {
    return await apiRequest("/api/ai/veo-video", { prompt, imageBase64, mimeType, aspectRatio, resolution });
  } catch {
    return { url: null, videoObject: null };
  }
};

export const editImage = async (base64: string, mimeType: string, prompt: string) => {
  try {
    const res = await apiRequest("/api/ai/edit-image", { base64, mimeType, prompt });
    return res.dataUrl || null;
  } catch {
    return null;
  }
};

export const generateLogo = async (brandName: string) => {
  try {
    const res = await apiRequest("/api/ai/logo", { brandName });
    return res.dataUrl || null;
  } catch {
    return null;
  }
};

// ----------------------------------------------------
// Legacy / Compatibility: VisualLab may call getAI().live.connect
// We return a safe mock that throws a clear runtime error.
// ----------------------------------------------------

export const getAI = (): any => {
  return {
    live: {
      connect: async () => {
        throw new Error(
          "Live API (getAI().live.connect) is disabled in production. Use backend endpoints (/api/ai/*) instead."
        );
      },
    },
    models: {
      generateContent: async () => {
        throw new Error("Direct SDK calls are disabled. Use /api/ai/* endpoints instead.");
      },
    },
  };
};
