const express = require("express");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ JSON body pour POST
app.use(express.json({ limit: "2mb" }));

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
        // ✅ IMPORTANT: autoriser ton API + Firebase
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://generativelanguage.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.firebaseapp.com",
          "https://firestore.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com"
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
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());

// Force HTTPS en prod (proxy Hostinger)
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https" && process.env.NODE_ENV === "production") {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ✅ Gemini côté serveur (clé dans ENV)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ✅ Endpoint API pour Gemini
app.post("/api/generate", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Missing GEMINI_API_KEY on server" });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return res.json({ text: result.text || "" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

// ✅ servir le build Vite
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Social Muse Server live on port ${PORT}`);
});
