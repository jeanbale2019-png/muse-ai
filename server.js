
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

// Initialisation Gemini SDK
const genAI = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '20mb' })); // Increased limit for images

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
      connectSrc: [
        "'self'", 
        "https://*.googleapis.com", 
        "https://*.firebaseio.com", 
        "https://*.firebaseapp.com", 
        "https://generativelanguage.googleapis.com",
        "https://identitytoolkit.googleapis.com"
      ],
      imgSrc: ["'self'", "data:", "blob:", "https://*.dicebear.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      mediaSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'self'", "https://*.firebaseapp.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// --- API ROUTES (Proxy Gemini) ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', ai_ready: !!genAI });
});

app.post('/api/ai/analyze-image', async (req, res) => {
  if (!genAI) return res.status(503).json({ error: "AI Key missing on server" });
  try {
    const { base64, mimeType, language, genre } = req.body;
    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Analyze this image in the style of ${genre}. Respond in ${language}. Provide a JSON object with: openingParagraph, mood, sceneAnalysis, characters, worldBuilding, sensoryDetails, plotTwists.` }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  if (!genAI) return res.status(503).json({ error: "AI Key missing" });
  try {
    const { message, history, language } = req.body;
    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: { systemInstruction: `Respond in ${language}.` }
    });
    res.json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SERVING FRONTEND ---
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Social Muse running on port ${PORT}`);
});
