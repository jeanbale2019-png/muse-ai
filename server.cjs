const express = require("express");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- JSON body ----------
app.use(express.json({ limit: "10mb" })); // images base64 => augmente un peu

// ---------- Security headers + CSP ----------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        // si tu utilises tailwind CDN / esm, etc.
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://esm.sh",
          "https://cdnjs.cloudflare.com",
        ],

        // ✅ IMPORTANT: autoriser Firestore + Auth + Gemini + ton propre backend
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://firestore.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://www.googleapis.com",
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

app.use(compression());

// Force HTTPS in production (Hostinger proxy)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ---------- Gemini (server-side) ----------
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ---------- Helpers ----------
function notImplemented(res, feature) {
  return res.status(501).json({ error: `Feature not implemented: ${feature}` });
}

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: Boolean(apiKey) });
});

// ---------- AI: analyze image -> StoryData ----------
app.post("/api/ai/analyze-image", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { base64, mimeType, language = "fr-FR", genre = "fantasy" } = req.body || {};
    if (!base64 || !mimeType) return res.status(400).json({ error: "Missing base64 or mimeType" });

    // On demande un JSON stable
    const prompt = `Analyze this image in the style of ${genre}. Respond strictly in ${language}.
Return ONLY a valid JSON object with these fields:
openingParagraph (string),
mood (string),
sceneAnalysis (string),
characters (array of strings),
worldBuilding (string),
sensoryDetails (array of strings),
plotTwists (array of strings).`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    // result.text doit être un JSON string
    const jsonText = result.text || "{}";
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      // si jamais Gemini renvoie un texte non JSON
      data = { openingParagraph: "", mood: "", sceneAnalysis: jsonText, characters: [], worldBuilding: "", sensoryDetails: [], plotTwists: [] };
    }

    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// ---------- AI: chat ----------
app.post("/api/ai/chat", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { history = [], message = "", language = "fr-FR" } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    // Simple prompt avec historique compact
    const historyText = Array.isArray(history)
      ? history.map(h => `${h.role === "user" ? "User" : "Model"}: ${h.text}`).join("\n")
      : "";

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          { text: `Respond only in ${language}.\n\nConversation:\n${historyText}\n\nUser: ${message}` },
        ],
      },
    });

    res.json({ text: result.text || "" });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ---------- AI: suggestions ----------
app.post("/api/ai/suggestions", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { text = "", language = "fr-FR" } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing text" });

    const prompt = `Based on context: "${text}", suggest 3 responses in ${language}.
Return ONLY a JSON array of objects like:
[{ "text": "...", "type": "relance|empathy|humor" }]`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json" },
    });

    const jsonText = result.text || "[]";
    let suggestions;
    try {
      suggestions = JSON.parse(jsonText);
    } catch {
      suggestions = [];
    }

    res.json(suggestions);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ---------- AI: TTS (pas prêt => 501 propre) ----------
app.post("/api/ai/tts", async (req, res) => {
  return notImplemented(res, "tts");
});

// ---------- AI: Veo video (pas prêt => 501 propre) ----------
app.post("/api/ai/veo-video", async (req, res) => {
  return notImplemented(res, "veo-video");
});

// ---------- Static / SPA ----------
const publicDir = path.join(__dirname, "dist");
app.use(express.static(publicDir));
app.use(express.static(__dirname));

app.get("*", (req, res) => {
  const indexInDist = path.join(publicDir, "index.html");
  const indexInRoot = path.join(__dirname, "index.html");
  res.sendFile(indexInDist, (err) => {
    if (err) res.sendFile(indexInRoot);
  });
});

app.listen(PORT, () => {
  console.log(`Social Muse Server live on port ${PORT}`);
});
