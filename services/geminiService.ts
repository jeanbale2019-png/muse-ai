
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { StoryData, ConversationSuggestion, VoiceName, AspectRatio, ImageSize, Language, StoryGenre } from "../types";

/**
 * Creates a fresh instance of the Gemini AI client.
 * Using a function ensures we always use the most up-to-date API key from the environment.
 */
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

/**
 * Checks if an API key has been selected via AI Studio's dialog.
 * Mandatory for high-tier models like Pro Image or Veo Video.
 */
export const ensureApiKey = async () => {
  if (typeof (window as any).aistudio !== 'undefined') {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
      // Per instructions, assume success after triggering the dialog.
      return true;
    }
  }
  return true;
};

/**
 * Global error handler for Gemini API calls.
 * Provides user-friendly messages and handles mandatory key re-selection.
 */
export const handleGeminiError = async (err: any): Promise<string> => {
  const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
  console.error("Gemini API Error Detail:", err);

  // 1. Check for 404/NOT_FOUND (Model access/Key project issue)
  const isNotFound = errorMessage.includes("Requested entity was not found") || 
                     errorMessage.includes("404") || 
                     err?.status === "NOT_FOUND";

  if (isNotFound && typeof (window as any).aistudio !== 'undefined') {
    await (window as any).aistudio.openSelectKey();
    return "Accès au modèle refusé. Veuillez sélectionner une clé API liée à un projet avec facturation activée.";
  }

  // 2. Check for 429 (Rate Limit)
  if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("exhausted") || errorMessage.toLowerCase().includes("too many requests")) {
    return "Limite de requêtes atteinte. Veuillez patienter une minute avant de réessayer.";
  }

  // 3. Check for 401/403 (Auth/Permission)
  if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.toLowerCase().includes("permission denied")) {
    return "Erreur d'authentification. Vérifiez les permissions de votre clé API.";
  }

  // 4. Check for Network Issues
  if (errorMessage.toLowerCase().includes("fetch") || errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("failed to connect")) {
    return "Erreur de connexion réseau. Vérifiez votre accès internet.";
  }

  // 5. Check for Safety Filters
  if (errorMessage.toLowerCase().includes("safety") || errorMessage.toLowerCase().includes("blocked")) {
    return "Contenu bloqué par les filtres de sécurité. Veuillez ajuster votre demande.";
  }

  // Fallback
  return "Une erreur inattendue est survenue lors du traitement par l'IA. Veuillez réessayer.";
};

// --- Audio Utilities ---
export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

// --- Content Generation ---

export const getConversationSuggestions = async (text: string, language: Language): Promise<ConversationSuggestion[]> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User transcript: "${text}". Based on this, provide 3 short conversation suggestions (one 'relance', one 'empathy', one 'humor') in ${language}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["text", "type"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
};

export const chatWithGemini = async (history: {role: 'user' | 'model', text: string}[], message: string, language: Language): Promise<string> => {
  const ai = getAI();
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `You are a helpful assistant named Gemini. You must respond in ${language}.`,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });
    
    const response = await chat.sendMessage({ message });
    return response.text || '';
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
};

export const analyzeImageAndGhostwrite = async (base64: string, mimeType: string, language: Language = 'fr-FR', genre: StoryGenre = 'fantasy'): Promise<StoryData> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Analyze this image for a creative writing session in the style of ${genre}. Respond strictly in ${language}. 
                  Provide a JSON object including visual analysis of the art itself and narrative elements.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            openingParagraph: { type: Type.STRING },
            mood: { type: Type.STRING },
            sceneAnalysis: { type: Type.STRING },
            characters: { type: Type.ARRAY, items: { type: Type.STRING } },
            worldBuilding: { type: Type.STRING },
            sensoryDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
            plotTwists: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualAnalysis: {
              type: Type.OBJECT,
              properties: {
                lighting: { type: Type.STRING },
                composition: { type: Type.STRING },
                colorPalette: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of hex codes or descriptive colors found in the image" }
              },
              required: ["lighting", "composition", "colorPalette"]
            },
            writingPrompts: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                dialogue: { type: Type.STRING },
                internal: { type: Type.STRING }
              },
              required: ["action", "dialogue", "internal"]
            }
          },
          required: ["openingParagraph", "mood", "sceneAnalysis", "characters", "worldBuilding", "sensoryDetails", "plotTwists", "visualAnalysis", "writingPrompts"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
};

export const expandStory = async (currentText: string, context: string, genre: string, language: Language): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context}. Previous Chapter: ${currentText}. Continue this story in the genre of ${genre} for one more evocative paragraph. Language: ${language}.`,
    });
    return response.text || '';
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
};

export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (err) {
    await handleGeminiError(err);
    return null;
  }
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
  await ensureApiKey();
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
  return null;
};

export const generateLogo = async (brandName: string): Promise<string | null> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Create a professional, abstract, and minimalist logo for a brand called "${brandName}". The design should focus on the concept of interconnected ideas using elegant, flowing lines that weave together. It should feel iconic, modern, and suitable for a creative tech leadership platform. High resolution, white background.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
  return null;
};

export const generateVeoVideo = async (prompt: string, imageBase64?: string, mimeType?: string, aspectRatio: "16:9" | "9:16" = "16:9", resolution: "720p" | "1080p" = "720p") => {
  await ensureApiKey();
  const ai = getAI();
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      ...(imageBase64 && { image: { imageBytes: imageBase64, mimeType: mimeType || 'image/png' } }),
      config: { numberOfVideos: 1, resolution, aspectRatio }
    });
    while (!operation.done) {
      await new Promise(r => setTimeout(r, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }
    const result = operation.response?.generatedVideos?.[0];
    if (!result?.video?.uri) throw new Error("Video generation failed.");
    return { url: `${result.video.uri}&key=${process.env.API_KEY}`, videoObject: result.video };
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
};

export const editImage = async (base64: string, mimeType: string, prompt: string) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ inlineData: { data: base64, mimeType } }, { text: prompt }] }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (err) {
    throw new Error(await handleGeminiError(err));
  }
  return null;
};

export const saveToGallery = (item: any) => {
  const saved = localStorage.getItem('muse_creations');
  const gallery = saved ? JSON.parse(saved) : [];
  const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
  gallery.unshift(newItem);
  localStorage.setItem('muse_creations', JSON.stringify(gallery.slice(0, 100)));
  return newItem;
};

export const getGallery = () => JSON.parse(localStorage.getItem('muse_creations') || '[]');

export function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeString(0, 'RIFF'); view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(8, 'WAVE'); writeString(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeString(36, 'data'); view.setUint32(40, pcmData.length * 2, true);
  for (let i = 0; i < pcmData.length; i++) view.setInt16(44 + i * 2, pcmData[i], true);
  return new Blob([view], { type: 'audio/wav' });
}

export function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
