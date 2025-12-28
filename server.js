import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ La clé doit être sur le serveur (Hostinger/VPS env vars)
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

// Init Gemini SDK (serveur)
const genAI = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Middlewares
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "10mb" }));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdnjs.cloudflare.com",
        ],
        // ⚠️ Important: ton FRONTEND utilise Firebase directement
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://firestore.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://www.googleapis.com",
          // Gemini (si jamais needed, mais normalement c’est côté serveur)
          "https://generativelanguage.googleapis.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.dicebear.com",
          "https://images.unsplash.com",
          "https://*.googleusercontent.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'self'", "https://*.firebaseapp.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Helpers
const requireAI = (res) => {
  if (!genAI) {
    res.status(503).json({ error: "AI Key missing on server (API_KEY not set)" });
    return false;
  }
  return true;
};

const safeJsonParse = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const pickInlineImageDataUrl = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p?.inlineData?.data) return `data:image/png;base64,${p.inlineData.data}`;
  }
  return null;
};

// -------------------- API ROUTES --------------------

app.get("/api/health", (req, res) => {
  res.json({ status: "online", ai_ready: !!genAI });
});

// 1) Analyze image -> Story JSON
app.post("/api/ai/analyze-image", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { base64, mimeType, language = "fr-FR", genre = "fantasy" } = req.body || {};
    if (!base64 || !mimeType) return res.status(400).json({ error: "Missing base64 or mimeType" });

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          {
            text:
              `Analyze this image in the style of ${genre}. Respond in ${language}. ` +
              `Provide a JSON object with: openingParagraph, mood, sceneAnalysis, characters (array), worldBuilding, sensoryDetails (array), plotTwists (array).`,
          },
        ],
      },
      config: { responseMimeType: "application/json" },
    });

    const data = safeJsonParse(response.text || "{}", {});
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error?.message || "analyze-image failed" });
  }
});

// 2) Chat
app.post("/api/ai/chat", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { message, language = "fr-FR" } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: { systemInstruction: `Respond in ${language}.` },
    });

    res.json({ text: response.text || "" });
  } catch (error) {
    res.status(500).json({ error: error?.message || "chat failed" });
  }
});

// 3) Conversation suggestions (JSON)
app.post("/api/ai/suggestions", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { text, language = "fr-FR" } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing text" });

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze conversation part: "${text}". Provide 3 suggestions in ${language}. Return JSON array: [{text,type}] where type is relance|empathy|humor.`,
      config: { responseMimeType: "application/json" },
    });

    res.json(safeJsonParse(response.text || "[]", []));
  } catch (error) {
    res.status(500).json({ error: error?.message || "suggestions failed" });
  }
});

// 4) Generate “pro” image (returns dataUrl)
app.post("/api/ai/generate-image", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { prompt, aspectRatio = "1:1", imageSize = "1K" } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const response = await genAI.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio, imageSize } },
    });

    res.json({ dataUrl: pickInlineImageDataUrl(response) });
  } catch (error) {
    res.status(500).json({ error: error?.message || "generate-image failed" });
  }
});

// 5) Edit image (returns dataUrl)
app.post("/api/ai/edit-image", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { base64, mimeType, prompt } = req.body || {};
    if (!base64 || !mimeType || !prompt) return res.status(400).json({ error: "Missing base64/mimeType/prompt" });

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: prompt },
        ],
      },
    });

    res.json({ dataUrl: pickInlineImageDataUrl(response) });
  } catch (error) {
    res.status(500).json({ error: error?.message || "edit-image failed" });
  }
});

// 6) TTS (returns base64 audio)
app.post("/api/ai/tts", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { text, voiceName } = req.body || {};
    if (!text || !voiceName) return res.status(400).json({ error: "Missing text or voiceName" });

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });

    const base64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    res.json({ base64 });
  } catch (error) {
    res.status(500).json({ error: error?.message || "tts failed" });
  }
});

// 7) Video (Veo) — ⚠️ peut prendre du temps → risque timeout selon proxy
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.post("/api/ai/video/generate", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { prompt, imageBase64, mimeType, aspectRatio = "16:9", resolution = "720p" } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    let operation = await genAI.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt,
      ...(imageBase64 ? { image: { imageBytes: imageBase64, mimeType: mimeType || "image/png" } } : {}),
      config: { numberOfVideos: 1, resolution, aspectRatio },
    });

    // Poll with max ~120s to avoid endless requests
    const maxTries = 12;
    for (let i = 0; i < maxTries && !operation.done; i++) {
      await sleep(10000);
      operation = await genAI.operations.getVideosOperation({ operation });
    }

    const url = operation?.response?.generatedVideos?.[0]?.video?.uri;
    const videoObject = operation?.response?.generatedVideos?.[0]?.video;

    if (!operation.done) {
      // Not finished: return pending (client can retry later)
      return res.status(202).json({ pending: true, url: url || null, videoObject: videoObject || null });
    }

    res.json({ pending: false, url: url || null, videoObject: videoObject || null });
  } catch (error) {
    res.status(500).json({ error: error?.message || "video generate failed" });
  }
});

app.post("/api/ai/video/extend", async (req, res) => {
  if (!requireAI(res)) return;
  try {
    const { prompt, previousVideo } = req.body || {};
    if (!prompt || !previousVideo) return res.status(400).json({ error: "Missing prompt or previousVideo" });

    let operation = await genAI.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt,
      video: previousVideo,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: previousVideo.aspectRatio,
      },
    });

    const maxTries = 12;
    for (let i = 0; i < maxTries && !operation.done; i++) {
      await sleep(10000);
      operation = await genAI.operations.getVideosOperation({ operation });
    }

    const url = operation?.response?.generatedVideos?.[0]?.video?.uri;
    const videoObject = operation?.response?.generatedVideos?.[0]?.video;

    if (!operation.done) {
      return res.status(202).json({ pending: true, url: url || null, videoObject: videoObject || null });
    }

    res.json({ pending: false, url: url || null, videoObject: videoObject || null });
  } catch (error) {
    res.status(500).json({ error: error?.message || "video extend failed" });
  }
});

// -------------------- SERVE FRONTEND --------------------
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Social Muse running on port ${PORT}`);
});
