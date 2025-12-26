import express from "express";
import path from "path";
import compression from "compression";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;

// Needed for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse JSON bodies
app.use(express.json());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://esm.sh", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'", "https://*.googleapis.com", "https://generativelanguage.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://*.dicebear.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
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

// ✅ Gemini client (server-side)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ GEMINI_API_KEY is missing in environment variables.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ✅ API endpoint (server-side)
app.post("/api/generate", async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });

    res.json({ text: result.text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ✅ Serve Vite build output
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));

// ✅ SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server live on port ${PORT}`);
});
