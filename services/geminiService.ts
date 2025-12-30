
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { 
  StoryData, 
  Language, 
  StoryboardStep, 
  SocialPack, 
  TimelapseProject, 
  AspectRatio, 
  ImageSize, 
  VoiceName, 
  ConversationSuggestion 
} from "../types";

export const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

/**
 * Global Error Handler
 */
export const handleGeminiError = async (error: any) => {
  console.error("Gemini API Error Detail:", error);
  
  // Handle Quota Exceeded (429) or Requested Entity Not Found (404)
  const isQuotaExceeded = error.status === 429 || error.message?.includes("quota") || error.message?.includes("429");
  const isNotFound = error.status === 404 || error.message?.includes("Requested entity was not found");

  if (isQuotaExceeded || isNotFound) {
    if (window.aistudio?.openSelectKey) {
      console.warn("Quota exceeded or key invalid. Opening selection dialog.");
      await window.aistudio.openSelectKey();
    }
    return "Quota reached. Please select a paid API key or wait a few minutes before retrying.";
  }
  
  return error.message || "An unexpected error occurred.";
};

/**
 * Utility for exponential backoff retries
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.status >= 500)) {
      console.warn(`Retrying after error ${error.status}. Retries left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const ensureApiKey = async () => {
  if (window.aistudio?.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) await window.aistudio.openSelectKey();
  }
};

// --- TIMELAPSE SaaS SERVICE ---

export const orchestrateStoryboard = async (
  project: Partial<TimelapseProject>
): Promise<StoryboardStep[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      You are a professional Creative Director for an architectural visualization firm.
      Design a highly strategic 12-step storyboard for a construction/design timelapse project.
      
      Project Context:
      - Title: ${project.title}
      - Style Theme: ${project.stylePreset}
      - Environment: ${project.roomType}
      - Target Audience: ${project.targetAudience}
      - Language: ${project.language}

      Return JSON as an array of objects: { id, title, visualPrompt, narrative }.
    `;

    // Use gemini-3-pro-preview for complex reasoning tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              title: { type: Type.STRING },
              visualPrompt: { type: Type.STRING },
              narrative: { type: Type.STRING },
            },
            required: ["id", "title", "visualPrompt", "narrative"]
          }
        }
      }
    });

    // Handle potential undefined text response gracefully.
    return JSON.parse(response.text || "[]").map((s: any) => ({
      ...s,
      status: 'pending'
    }));
  });
};

export const generateSocialPack = async (project: TimelapseProject): Promise<SocialPack[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      Analyze this project: ${project.title}. 
      Narrative flow: ${project.steps.map(s => s.narrative).join(' -> ')}.
      Target: ${project.targetAudience}.
      Language: ${project.language}.

      Create 5 specialized social media metadata packs (suggestedTitle, copy, hashtags) for: LinkedIn, Instagram, TikTok, YouTube, and Facebook.
    `;

    // Use gemini-3-pro-preview for complex reasoning tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING },
              copy: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedTitle: { type: Type.STRING }
            },
            required: ["platform", "copy", "hashtags", "suggestedTitle"]
          }
        }
      }
    });
    // Handle potential undefined text response gracefully.
    return JSON.parse(response.text || "[]");
  });
};

// --- CORE ASSET GENERATION ---

export const generateProImage = async (prompt: string, aspectRatio: AspectRatio, imageSize: ImageSize): Promise<string | null> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio, imageSize }
      }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  });
};

export const generateStepImage = async (prompt: string, style: string): Promise<string | null> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Photorealistic high-end architectural shot, ${style} style: ${prompt}` }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  });
};

export const generateVeoVideo = async (
  prompt: string, 
  imageBase64?: string, 
  mimeType: string = 'image/jpeg', 
  aspectRatio: "16:9" | "9:16" = "16:9", 
  resolution: "720p" | "1080p" = "720p",
  signal?: AbortSignal
) => {
  await ensureApiKey();
  const ai = getAI();

  const operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Slow cinematic timelapse movement: ${prompt}`,
    ...(imageBase64 ? { image: { imageBytes: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''), mimeType } } : {}),
    config: { numberOfVideos: 1, resolution, aspectRatio }
  });

  let op = operation;
  while (!op.done) {
    if (signal?.aborted) throw new Error("Cancelled by user");
    await new Promise(resolve => setTimeout(resolve, 10000));
    op = await ai.operations.getVideosOperation({operation: op});
  }

  const videoUri = op.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) return null;

  const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`, { signal });
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), videoObject: op.response?.generatedVideos?.[0]?.video };
};

export const extendVeoVideo = async (prompt: string, previousVideo: any, signal?: AbortSignal) => {
  await ensureApiKey();
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-preview',
    prompt: prompt,
    video: previousVideo,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: previousVideo.aspectRatio || '16:9'
    }
  });

  while (!operation.done) {
    if (signal?.aborted) throw new Error("Cancelled by user");
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) return null;
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`, { signal });
  const blob = await response.blob();
  return { 
    url: URL.createObjectURL(blob), 
    videoObject: operation.response?.generatedVideos?.[0]?.video 
  };
};

export const generateLogo = async (prompt: string): Promise<string | null> => {
  return generateStepImage(`Minimalist Logo design: ${prompt}`, "modern");
};

export const analyzeImageAndGhostwrite = async (base64: string, mimeType: string, language: Language): Promise<StoryData> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Analyze this image and write a compelling opening paragraph for a story based on it. Respond in ${language}. Return JSON with properties: openingParagraph, mood, sceneAnalysis, characters, worldBuilding, sensoryDetails, plotTwists.` }
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
            plotTwists: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["openingParagraph", "mood", "sceneAnalysis", "characters", "worldBuilding", "sensoryDetails", "plotTwists"]
        }
      }
    });
    // Handle potential undefined text response gracefully.
    return JSON.parse(response.text || "{}");
  });
};

export const getConversationSuggestions = async (text: string, language: Language): Promise<ConversationSuggestion[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze conversation: "${text}". Language: ${language}. Provide 3 suggestions in JSON array: { text: string, type: "relance" | "empathy" | "humor" }.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["relance", "empathy", "humor"] }
            },
            required: ["text", "type"]
          }
        }
      }
    });
    // Handle potential undefined text response gracefully.
    return JSON.parse(response.text || "[]");
  });
};

export const chatWithGemini = async (history: {role: 'user' | 'model', text: string}[], message: string, language: Language): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const contents = history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] } as any);

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: { systemInstruction: `You are a helpful assistant. Respond in ${language}.` }
    });
    return response.text || '';
  });
};

// --- UTILS ---

export const triggerDownload = (url: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const downloadFromUrl = async (url: string, fileName: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  triggerDownload(blobUrl, fileName);
  URL.revokeObjectURL(blobUrl);
};

export const compressAndResizeImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = (img.height * 1024) / img.width;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
  });
};

export const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

export const encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const pcmToWav = (pcmData: Int16Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
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
  for (let i = 0; i < pcmData.length; i++) view.setInt16(44 + i * 2, pcmData[i], true);
  return new Blob([buffer], { type: 'audio/wav' });
};

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

export const playTTS = async (base64: string) => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
};

export const generateTTS = async (text: string, voiceName: VoiceName): Promise<string | null> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts", 
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  });
};

export const getGallery = () => {
  const saved = localStorage.getItem('muse_creations');
  return saved ? JSON.parse(saved) : [];
};

export const saveToGallery = (item: any) => {
  const gallery = getGallery();
  gallery.push(item);
  localStorage.setItem('muse_creations', JSON.stringify(gallery));
};
