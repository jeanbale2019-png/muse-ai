
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// 1. Configuration Environnement
dotenv.config();

// Recréer __dirname pour ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

// 2. Initialisation Client Gemini
let ai = null;
if (API_KEY) {
  // Fixed: Correctly initializing GoogleGenAI with a named parameter as required.
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.warn("⚠️  ATTENTION: API_KEY manquante. Les routes IA retourneront des erreurs 503.");
}

// 3. Middlewares de Sécurité & Performance
app.use(cors()); // En production, spécifiez l'origine: { origin: 'https://votre-domaine.com' }
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Augmenté pour l'analyse d'images Base64

// Configuration CSP permissive pour Firebase, Google Fonts et Scripts inline
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
          "wss://*.firebaseio.com"
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.dicebear.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
        frameSrc: ["'self'"]
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 4. Routes API (Doivent être définies AVANT les fichiers statiques)

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', mode: 'production', ai_ready: !!ai });
});

// Analyze Image & Ghostwrite
app.post('/api/ai/analyze-image', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "Service IA indisponible (Clé API manquante)" });
  try {
    const { base64, mimeType, language, genre } = req.body;
    
    // Model Selection for image analysis (Gemini 2.5 Flash used for multi-modal tasks)
    const model = 'gemini-2.5-flash';

    const prompt = `Agis comme un expert en narration visuelle et ghostwriter. 
    Genre: ${genre || 'fantasy'}. Langue de réponse: ${language || 'fr-FR'}.
    Analyse l'image fournie et retourne un JSON strict (sans markdown autour) contenant :
    - openingParagraph (une ouverture d'histoire captivante)
    - mood (description de l'atmosphère)
    - sceneAnalysis (analyse technique de la scène)
    - characters (liste des archétypes de personnages déduits)
    - worldBuilding (éléments de lore suggérés)
    - sensoryDetails (liste de détails sensoriels: sons, odeurs)
    - plotTwists (liste de rebondissements possibles)`;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: mimeType || 'image/png' } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    // Extraction et nettoyage du JSON
    const text = response.text;
    const cleanText = text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleanText));

  } catch (error) {
    console.error('Analyze Error:', error);
    res.status(500).json({ error: error.message || "Erreur lors de l'analyse" });
  }
});

// Chat
app.post('/api/ai/chat', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "IA indisponible" });
  try {
    const { history, message, language } = req.body;
    
    // Initializing chat with updated model name for text tasks.
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction: `Tu es Muse, une IA d'assistance créative. Réponds toujours en ${language || 'fr-FR'}.` },
      history: history ? history.map(h => ({ role: h.role, parts: [{ text: h.text }] })) : []
    });

    // Fixed: chat.sendMessage must use the named parameter 'message' as per guidelines.
    const result = await chat.sendMessage({ message: message });
    res.json({ text: result.text });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Suggestions
app.post('/api/ai/suggestions', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "IA indisponible" });
  try {
    const { text, language } = req.body;
    const prompt = `Context: "${text}". Suggest 3 conversational responses in ${language || 'fr-FR'}. Return strictly a JSON array of objects: [{ "text": "...", "type": "relance|empathy|humor" }]`;
    
    // Updated to recommended model for text tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    
    const cleanText = response.text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleanText));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stubs pour fonctionnalités futures (éviter 404)
app.post('/api/ai/tts', (req, res) => res.status(501).json({ error: "TTS coming soon" }));
app.post('/api/ai/veo-video', (req, res) => res.json({ url: null, message: "Video generation disabled in this environment" }));
app.post('/api/ai/pro-image', (req, res) => res.status(501).json({ error: "Imagen coming soon" }));
app.post('/api/ai/edit-image', (req, res) => res.json({ result: null }));
app.post('/api/ai/logo', (req, res) => res.json({ result: null }));

// 5. Servir les fichiers statiques (Frontend)
// Express sert le dossier 'dist' généré par 'vite build'
app.use(express.static(path.join(__dirname, 'dist')));

// 6. Fallback SPA (Single Page Application)
// Toutes les requêtes non-API (*) sont redirigées vers index.html
// pour que le routeur React (s'il y en a un) gère l'URL.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 7. Démarrage
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`);
  console.log(`🤖 AI Status: ${ai ? 'Connected' : 'Disconnected (No API Key)'}`);
});
