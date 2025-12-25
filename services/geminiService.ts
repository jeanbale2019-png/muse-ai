
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { StoryData, ConversationSuggestion, VoiceName, AspectRatio, ImageSize, Language, StoryGenre } from "../types";

/**
 * Creates a fresh instance of the Gemini AI client.
 * Using a function ensures we always use the most up-to-date API key.
 */
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

/**
 * Checks if an API key has been selected. Mandatory for high-tier models.
 */
export const ensureApiKey = async () => {
  if (typeof (window as any).aistudio !== 'undefined') {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
      // Proceed assuming the user will select or has selected a valid key
      return true;
    }
  }
  return true;
};

/**
 * Global error handler for Gemini API calls.
 * Specifically handles the 404 "Requested entity was not found" error.
 */
export const handleGeminiError = async (err: any) => {
  const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
  console.error("Gemini API Error:", errorMessage);

  const isNotFound = errorMessage.includes("Requested entity was not found") || 
                     errorMessage.includes("404") || 
                     err?.status === "NOT_FOUND" ||
                     err?.code === 404;

  if (isNotFound && typeof (window as any).aistudio !== 'undefined') {
    console.warn("Model or Key not found. Re-prompting user for API Key selection...");
    await (window as any).aistudio.openSelectKey();
    return true; // Indicates we should retry the original operation
  }
  return false;
};

// --- Audio Encoding/Decoding ---
export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

// --- Content Generation ---

export const analyzeImageAndGhostwrite = async (base64: string, mimeType: string, language: Language = 'fr-FR', genre: StoryGenre = 'fantasy'): Promise<StoryData> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Analyze this image in the style of ${genre}. Respond in the language: ${language}. 
                  Provide a JSON object with: openingParagraph, mood, sceneAnalysis, characters (list), worldBuilding, sensoryDetails (list), plotTwists (list).` }
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
    return JSON.parse(response.text || '{}');
  } catch (err) {
    if (await handleGeminiError(err)) return analyzeImageAndGhostwrite(base64, mimeType, language, genre);
    throw err;
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
    if (await handleGeminiError(err)) return generateProImage(prompt, aspectRatio, imageSize);
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
    if (await handleGeminiError(err)) return generateVeoVideo(prompt, imageBase64, mimeType, aspectRatio, resolution);
    throw err;
  }
};

export const groundedSearch = async (query: string, language: Language) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for current information about: ${query}. Respond in ${language}.`,
      config: { tools: [{ googleSearch: {} }] },
    });
    return {
      text: response.text || '',
      chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (err) {
    await handleGeminiError(err);
    return { text: "Error performing search.", chunks: [] };
  }
};

export const chatWithGemini = async (history: { role: 'user' | 'model'; text: string }[], message: string, language: Language) => {
  const ai = getAI();
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction: `Respond only in ${language}.` },
    });
    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (err) {
    await handleGeminiError(err);
    return "I am currently unavailable.";
  }
};

export const getConversationSuggestions = async (text: string, language: Language): Promise<ConversationSuggestion[]> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on context: "${text}", suggest 3 responses in ${language}. Return JSON array of objects with "text" and "type" (relance, empathy, humor).`,
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
    return JSON.parse(response.text || '[]');
  } catch (err) {
    await handleGeminiError(err);
    return [];
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
    await handleGeminiError(err);
  }
  return null;
};

export const generateLogo = async (brandName: string) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Create a professional minimalist vector logo for "${brandName}".` }] }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (err) {
    await handleGeminiError(err);
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
