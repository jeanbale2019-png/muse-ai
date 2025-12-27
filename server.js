
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

// Initialisation AI avec validation
let ai = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error("❌ CRITICAL: GEMINI_API_KEY is missing.");
}

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '5mb' }));

// CSP sécurisée mais compatible Firebase/Google
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com", 
          "https://generativelanguage.googleapis.com", 
          "https://*.firebaseio.com", 
          "https://identitytoolkit.googleapis.com", 
          "wss://*.firebaseio.com",
          "https://*.firebase.com"
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.dicebear.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'self'", "https://*.firebaseapp.com"]
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// --- API ENDPOINTS ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', ai_ready: !!ai });
});

app.post('/api/ai/analyze-image', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "Service indisponible" });
  try {
    const { base64, mimeType, language, genre } = req.body;
    
    // Utilisation de Gemini 2.5 Flash pour la vitesse
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: mimeType || 'image/png' } },
          { text: `Analyse cette image (genre: ${genre}) et réponds en ${language} sous forme de JSON strict avec: openingParagraph, mood, sceneAnalysis, characters, worldBuilding, sensoryDetails, plotTwists.` }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "Service indisponible" });
  try {
    const { message, history, language } = req.body;
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction: `Tu es Muse. Langue: ${language}.` },
      history: history || []
    });
    const result = await chat.sendMessage({ message });
    res.json({ text: result.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- STATIC ASSETS ---
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ App deployed on port ${PORT}`);
});
