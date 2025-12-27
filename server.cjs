const express = require("express");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Parse JSON (increase limit for base64 payloads later)
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
          "https://esm.sh",
          "https://cdnjs.cloudflare.com",
        ],

        // ✅ IMPORTANT: allow Firebase + Gemini + your own /api
        connectSrc: [
          "'self'",
          "https://generativelanguage.googleapis.com",
          "https://*.googleapis.com",
          "https://firestore.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.firebaseapp.com",
        ],

        imgSrc: [
          "'self'",
          "data:",
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
  if (req.headers["x-forwarded-proto"] !== "https" && process.env.NODE_ENV === "production") {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ✅ Gemini server-side client (set GEMINI_API_KEY in Hostinger env vars)
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: Boolean(apiKey) });
});

// ✅ Generic generate endpoint
app.post("/api/generate", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { prompt, model } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const result = await ai.models.generateContent({
      model: model || "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: String(prompt) }] }],
    });

    res.json({ text: result.text || "" });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ✅ Chat endpoint used by frontend geminiService.ts
app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { message, language } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const prompt = `Respond only in ${language || "fr-FR"}.\nUser message:\n${String(message)}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    res.json({ text: result.text || "" });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ✅ Suggestions endpoint used by frontend geminiService.ts
app.post("/api/suggestions", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { text, language } = req.body || {};
    if (!text) return res.status(400).json({ error: "Missing text" });

    const prompt = `Based on context: "${String(text)}", suggest 3 responses in ${language || "fr-FR"}.
Return a JSON array of objects with "text" and "type" (relance, empathy, humor).`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let suggestions = [];
    try {
      suggestions = JSON.parse(result.text || "[]");
    } catch {
      suggestions = [];
    }

    res.json({ suggestions });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ✅ Placeholders for features not implemented yet (avoid app crash)
app.post("/api/analyze-image", (req, res) => res.status(501).json({ error: "analyze-image not implemented on server yet" }));
app.post("/api/tts", (req, res) => res.status(501).json({ error: "tts not implemented on server yet" }));
app.post("/api/edit-image", (req, res) => res.status(501).json({ error: "edit-image not implemented on server yet" }));
app.post("/api/logo", (req, res) => res.status(501).json({ error: "logo not implemented on server yet" }));
app.post("/api/pro-image", (req, res) => res.status(501).json({ error: "pro-image not implemented on server yet" }));
app.post("/api/grounded-search", (req, res) => res.status(501).json({ error: "grounded-search not implemented on server yet" }));
app.post("/api/veo-video", (req, res) => res.status(501).json({ error: "veo-video not implemented on server yet" }));
app.post("/api/veo-extend", (req, res) => res.status(501).json({ error: "veo-extend not implemented on server yet" }));

// ✅ Serve static files from /dist if it exists, otherwise from root
const publicDir = path.join(__dirname, "dist");
app.use(express.static(publicDir));
app.use(express.static(__dirname));

// ✅ SPA routing: catch-all
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
