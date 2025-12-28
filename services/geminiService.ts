// services/geminiService.ts
import {
  StoryData,
  Language,
  StoryGenre,
  VoiceName,
  ConversationSuggestion,
  AspectRatio,
  ImageSize,
} from "../types";

const API_BASE = ""; 
// si un jour tu mets l’API sur un sous-domaine: const API_BASE = "https://api.musecivic.com";

async function api<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error || j?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// --- CORE ---

export const analyzeImageAndGhostwrite = async (
  base64: string,
  mimeType: string,
  language: Language = "fr-FR",
  genre: StoryGenre = "fantasy"
): Promise<StoryData> => {
  return api<StoryData>("/api/ai/analyze-image", { base64, mimeType, language, genre });
};

export const chatWithGemini = async (
  history: any[],
  message: string,
  language: Language
) => {
  const data = await api<{ text: string }>("/api/ai/chat", { history, message, language });
  return data.text;
};

export const getConversationSuggestions = async (
  text: string,
  language: Language
): Promise<ConversationSuggestion[]> => {
  return api<ConversationSuggestion[]>("/api/ai/suggestions", { text, language });
};

// --- IMAGES ---

export const generateProImage = async (
  prompt: string,
  aspectRatio: AspectRatio = "1:1",
  imageSize: ImageSize = "1K"
): Promise<string | null> => {
  const data = await api<{ dataUrl?: string | null }>("/api/ai/generate-image", {
    prompt,
    aspectRatio,
    imageSize,
  });
  return data.dataUrl ?? null;
};

export const editImage = async (
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string | null> => {
  const data = await api<{ dataUrl?: string | null }>("/api/ai/edit-image", {
    base64,
    mimeType,
    prompt,
  });
  return data.dataUrl ?? null;
};

// --- VIDEO (VEO) ---

export const generateVeoVideo = async (
  prompt: string,
  imageBase64?: string,
  mimeType?: string,
  aspectRatio: "16:9" | "9:16" = "16:9",
  resolution: "720p" | "1080p" = "720p"
) => {
  return api<{ url?: string; videoObject?: any }>("/api/ai/video/generate", {
    prompt,
    imageBase64,
    mimeType,
    aspectRatio,
    resolution,
  });
};

export const extendVeoVideo = async (prompt: string, previousVideo: any) => {
  return api<{ url?: string; videoObject?: any }>("/api/ai/video/extend", {
    prompt,
    previousVideo,
  });
};

// --- TTS ---

export const generateTTS = async (
  text: string,
  voiceName: VoiceName
): Promise<string | null> => {
  const data = await api<{ base64?: string | null }>("/api/ai/tts", { text, voiceName });
  return data.base64 ?? null;
};
