import { StoryData, ConversationSuggestion, VoiceName, AspectRatio, ImageSize, Language, StoryGenre } from "../types";

/** Helper: POST JSON to your backend */
async function postJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Request failed: ${r.status}`);
  return data as T;
}

// ---------- Audio Utilities (unchanged) ----------
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

// ---------- API-backed Gemini features ----------

/**
 * Analyze image + return StoryData JSON.
 * Backend should return: { data: StoryData }
 */
export const analyzeImageAndGhostwrite = async (
  base64: string,
  mimeType: string,
  language: Language = "fr-FR",
  genre: StoryGenre = "fantasy"
): Promise<StoryData> => {
  const res = await postJSON<{ data: StoryData }>("/api/analyze-image", {
    base64,
    mimeType,
    language,
    genre,
  });
  return res.data;
};

/**
 * TTS: backend returns { audioBase64: string }
 */
export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  const res = await postJSON<{ audioBase64?: string }>("/api/tts", { text, voiceName });
  return res.audioBase64 || null;
};

export const playTTS = async (base64: string) => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
};

/**
 * Pro image: backend returns { dataUrl: string } where dataUrl is "data:image/png;base64,..."
 */
export const generateProImage = async (prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize) => {
  const res = await postJSON<{ dataUrl: string | null }>("/api/pro-image", {
    prompt,
    aspectRatio,
    imageSize,
  });
  return res.dataUrl;
};

/**
 * Grounded search: backend returns { text: string, chunks: any[] }
 */
export const groundedSearch = async (query: string, language: Language) => {
  const res = await postJSON<{ text: string; chunks: any[] }>("/api/grounded-search", { query, language });
  return res;
};

/**
 * Chat: backend returns { text: string }
 */
export const chatWithGemini = async (
  history: { role: "user" | "model"; text: string }[],
  message: string,
  language: Language
) => {
  const res = await postJSON<{ text: string }>("/api/chat", { history, message, language });
  return res.text;
};

/**
 * Suggestions: backend returns { suggestions: ConversationSuggestion[] }
 */
export const getConversationSuggestions = async (text: string, language: Language): Promise<ConversationSuggestion[]> => {
  const res = await postJSON<{ suggestions: ConversationSuggestion[] }>("/api/suggestions", { text, language });
  return res.suggestions || [];
};

/**
 * Edit image: backend returns { dataUrl: string | null }
 */
export const editImage = async (base64: string, mimeType: string, prompt: string) => {
  const res = await postJSON<{ dataUrl: string | null }>("/api/edit-image", { base64, mimeType, prompt });
  return res.dataUrl;
};

/**
 * Logo: backend returns { dataUrl: string | null }
 */
export const generateLogo = async (brandName: string) => {
  const res = await postJSON<{ dataUrl: string | null }>("/api/logo", { brandName });
  return res.dataUrl;
};

// ---------- Gallery (unchanged) ----------
export const saveToGallery = (item: any) => {
  const saved = localStorage.getItem("muse_creations");
  const gallery = saved ? JSON.parse(saved) : [];
  const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
  gallery.unshift(newItem);
  localStorage.setItem("muse_creations", JSON.stringify(gallery.slice(0, 100)));
  return newItem;
};

export const getGallery = () => JSON.parse(localStorage.getItem("muse_creations") || "[]");

export function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeString(0, "RIFF"); view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(8, "WAVE"); writeString(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeString(36, "data"); view.setUint32(40, pcmData.length * 2, true);
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
