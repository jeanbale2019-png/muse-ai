import { StoryData, ConversationSuggestion, VoiceName, AspectRatio, ImageSize, Language, StoryGenre } from "../types";

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

// --- Content Generation (via backend) ---

export const analyzeImageAndGhostwrite = async (
  base64: string,
  mimeType: string,
  language: Language = "fr-FR",
  genre: StoryGenre = "fantasy"
): Promise<StoryData> => {
  return postJSON<StoryData>("/api/analyze-image", { base64, mimeType, language, genre });
};

export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  const res = await postJSON<{ audioBase64: string | null }>("/api/tts", { text, voiceName });
  return res.audioBase64;
};

export const groundedSearch = async (query: string, language: Language) => {
  return postJSON<{ text: string; chunks: any[] }>("/api/search", { query, language });
};

export const chatWithGemini = async (
  history: { role: "user" | "model"; text: string }[],
  message: string,
  language: Language
) => {
  const res = await postJSON<{ text: string }>("/api/chat", { history, message, language });
  return res.text;
};

export const getConversationSuggestions = async (text: string, language: Language): Promise<ConversationSuggestion[]> => {
  return postJSON<ConversationSuggestion[]>("/api/suggestions", { text, language });
};

// (Optionnel) image/logo via backend
export const editImage = async (base64: string, mimeType: string, prompt: string) => {
  const res = await postJSON<{ dataUrl: string | null }>("/api/edit-image", { base64, mimeType, prompt });
  return res.dataUrl;
};

export const generateLogo = async (brandName: string) => {
  const res = await postJSON<{ dataUrl: string | null }>("/api/logo", { brandName });
  return res.dataUrl;
};
