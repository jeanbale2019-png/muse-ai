
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { StoryData, Language, StoryGenre, VoiceName, ConversationSuggestion, AspectRatio, ImageSize } from "../types";

/**
 * Initialise l'instance AI. 
 * Note: Pour les modèles Pro/Veo, nous créons une nouvelle instance à chaque appel 
 * pour garantir l'utilisation de la clé API la plus récente (issue du dialogue).
 */
export const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

/**
 * Gère les erreurs de l'API Gemini.
 * Si une erreur 404 "Requested entity was not found" survient, 
 * on redemande à l'utilisateur de sélectionner sa clé API.
 */
export const handleGeminiError = async (error: any) => {
  console.error("Gemini API Error:", error);
  const errorMessage = error.message || "";
  
  if (errorMessage.includes("Requested entity was not found") || error.status === 404) {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    }
  }
};

/**
 * Vérifie si une clé API a été sélectionnée (requis pour les modèles Pro et Veo).
 */
export const ensureApiKey = async () => {
  if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
    }
  }
};

// --- UTILITAIRES AUDIO & ENCODAGE ---

export const encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

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

export const pcmToWav = (pcmData: Int16Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length * 2, true);
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
};

export const triggerDownload = (url: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const downloadFromUrl = async (url: string, fileName: string) => {
  const response = await fetch(`${url}&key=${process.env.API_KEY}`); 
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  triggerDownload(downloadUrl, fileName);
  window.URL.revokeObjectURL(downloadUrl);
};

// --- FONCTIONS CORE AI ---

/**
 * Analyse d'image et écriture narrative. 
 * Utilise gemini-3-flash-preview (recommandé pour tâches basiques/moyennes).
 */
export const analyzeImageAndGhostwrite = async (base64: string, mimeType: string, language: Language = 'fr-FR', genre: StoryGenre = 'fantasy'): Promise<StoryData> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Analyze this image in the style of ${genre}. Respond in ${language}. Provide a JSON object with: openingParagraph, mood, sceneAnalysis, characters (array of strings), worldBuilding, sensoryDetails (array of strings), plotTwists (array of strings).` }
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
          },
          required: ["openingParagraph", "mood", "sceneAnalysis", "characters", "worldBuilding", "sensoryDetails", "plotTwists"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

/**
 * Chat classique. Utilise gemini-3-flash-preview.
 */
export const chatWithGemini = async (history: any[], message: string, language: Language) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: { systemInstruction: `Respond in ${language}.` }
    });
    return response.text;
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

/**
 * Suggestions de conversation. Utilise gemini-3-flash-preview.
 */
export const getConversationSuggestions = async (text: string, language: Language): Promise<ConversationSuggestion[]> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze conversation part: "${text}". Provide 3 suggestions in ${language}. JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['relance', 'empathy', 'humor'] }
            },
            required: ["text", "type"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

/**
 * Génération d'image haute qualité. Utilise gemini-3-pro-image-preview.
 * Nécessite une clé API sélectionnée par l'utilisateur.
 */
export const generateProImage = async (prompt: string, aspectRatio: AspectRatio = "1:1", imageSize: ImageSize = "1K"): Promise<string | null> => {
  await ensureApiKey();
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio, imageSize } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

/**
 * Édition d'image. Utilise gemini-2.5-flash-image.
 */
export const editImage = async (base64: string, mimeType: string, prompt: string): Promise<string | null> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: prompt }
        ]
      }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

export const generateLogo = async (brandName: string): Promise<string | null> => {
  return generateProImage(`Minimalist vector logo for ${brandName}, clean lines, professional`, "1:1");
};

/**
 * Génération de vidéo. Utilise veo-3.1-fast-generate-preview.
 * Nécessite une clé API sélectionnée par l'utilisateur.
 */
export const generateVeoVideo = async (prompt: string, imageBase64?: string, mimeType?: string, aspectRatio: "16:9" | "9:16" = "16:9", resolution: "720p" | "1080p" = "720p") => {
  await ensureApiKey();
  const ai = getAI();
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      ...(imageBase64 ? { image: { imageBytes: imageBase64, mimeType: mimeType || 'image/png' } } : {}),
      config: { numberOfVideos: 1, resolution, aspectRatio }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    return { 
      url: operation.response?.generatedVideos?.[0]?.video?.uri,
      videoObject: operation.response?.generatedVideos?.[0]?.video 
    };
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

/**
 * Extension de vidéo. Ajoute 7 secondes à une vidéo existante.
 * Doit utiliser veo-3.1-generate-preview et résolution 720p.
 */
export const extendVeoVideo = async (prompt: string, previousVideo: any) => {
  await ensureApiKey();
  const ai = getAI();
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt,
      video: previousVideo,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: previousVideo.aspectRatio,
      }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    return { 
      url: operation.response?.generatedVideos?.[0]?.video?.uri,
      videoObject: operation.response?.generatedVideos?.[0]?.video 
    };
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

/**
 * Text-to-speech. Utilise gemini-2.5-flash-preview-tts.
 */
export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts", 
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e: any) {
    await handleGeminiError(e);
    throw e;
  }
};

export const playTTS = async (base64: string) => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
};

export const saveToGallery = (item: any) => {
  const saved = localStorage.getItem('muse_creations');
  const gallery = saved ? JSON.parse(saved) : [];
  gallery.unshift({ ...item, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() });
  localStorage.setItem('muse_creations', JSON.stringify(gallery.slice(0, 100)));
};

export const getGallery = () => JSON.parse(localStorage.getItem('muse_creations') || '[]');
