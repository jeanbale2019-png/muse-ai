import {
  StoryData,
  ConversationSuggestion,
  VoiceName,
  AspectRatio,
  ImageSize,
  Language,
  StoryGenre
} from "../types";

/**
 * IMPORTANT:
 * - No @google/genai in the browser
 * - No process.env in the browser
 * - All AI calls go through your backend (/api/*)
 */

async function postJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({} as any));

  if (!r.ok) {
    // Helpful error for missing backend routes
    if (r.status === 404) {
      throw new Error(`Endpoint not found: ${url}. Make sure your server.cjs/server.js has this route.`);
    }
    throw new Error((data as any)?.error || `Request failed: ${r.status}`);
  }

  return data as T;
}

// --- Audio Utilities (kept on frontend) ---
export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

// --- Content Generation (via backend) ---

export const analyzeImageAndGhostwrite = async (
  base64: string,
  mimeType: string,
  language: Language = "fr-FR",
  genre: StoryGenre = "fantasy"
): Promise<StoryData> => {
  return postJSON<StoryData>("/api/analyze-image", { base64, mimeType, language, genre });
};

export const chatWithGemini = async (
  history: { role: "user" | "model"; text: string }[],
  message: string,
  language: Language
) => {
  // Your backend should implement /api/chat
  const res = await postJSON<{ text: string }>("/api/chat", { history, message, language });
  return res.text || "";
};

export const groundedSearch = async (query: string, language: Language) => {
  // Your backend should implement /api/search
  return postJSON<{ text: string; chunks: any[] }>("/api/search", { query, language });
};

export const getConversationSuggestions = async (
  text: string,
  language: Language
): Promise<ConversationSuggestion[]> => {
  // Your backend should implement /api/suggestions
  return postJSON<ConversationSuggestion[]>("/api/suggestions", { text, language });
};

export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  // Your backend should implement /api/tts
  const res = await postJSON<{ audioBase64: string | null }>("/api/tts", { text, voiceName });
  return res.audioBase64;
};

export const playTTS = async (base64: string) => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
};

export const generateProImage = async (prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize) => {
  // Optional: backend should implement /api/pro-image
  const res = await postJSON<{ dataUrl: string | null }>("/api/pro-image", { prompt, aspectRatio, imageSize });
  return res.dataUrl;
};

export const generateVeoVideo = async (
  prompt: string,
  imageBase64?: string,
  mimeType?: string,
  aspectRatio: "16:9" | "9:16" = "16:9",
  resolution: "720p" | "1080p" = "720p"
) => {
  // Optional: backend should implement /api/veo
  return postJSON<any>("/api/veo", { prompt, imageBase64, mimeType, aspectRatio, resolution });
};

export const extendVeoVideo = async (prompt: string, previousVideo: any) => {
  // Optional: backend should implement /api/veo-extend
  return postJSON<any>("/api/veo-extend", { prompt, previousVideo });
};

export const editImage = async (base64: string, mimeType: string, prompt: string) => {
  // Optional: backend should implement /api/edit-image
  const res = await postJSON<{ dataUrl: string | null }>("/api/edit-image", { base64, mimeType, prompt });
  return res.dataUrl;
};

export const generateLogo = async (brandName: string) => {
  // Optional: backend should implement /api/logo
  const res = await postJSON<{ dataUrl: string | null }>("/api/logo", { brandName });
  return res.dataUrl;
};

// --- Local storage utilities (unchanged) ---
export const saveToGallery = (item: any) => {
  const saved = localStorage.getItem("muse_creations");
  const gallery = saved ? JSON.parse(saved) : [];
  const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
  gallery.unshift(newItem);
  localStorage.setItem("muse_creations", JSON.stringify(gallery.slice(0, 100)));
  return newItem;
};

export const getGallery = () => JSON.parse(localStorage.getItem("muse_creations") || "[]");

// --- Download helpers (unchanged) ---
export function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcmData.length * 2, true);
  for (let i = 0; i < pcmData.length; i++) view.setInt16(44 + i * 2, pcmData[i], true);
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
  } catch (err) {
    triggerDownload(url, filename);
  }
}
