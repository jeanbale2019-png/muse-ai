
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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

// 2. Sécurité & Middleware
app.use(cors()); // Ajuster l'origine en prod si nécessaire
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Augmenté pour l'upload d'images
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://identitytoolkit.googleapis.com", "wss://*.firebaseio.com"],
        imgSrc: ["'self'", "data:", "https://*.dicebear.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 3. Client Gemini (Server-Side)
let ai = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error("❌ ERREUR CRITIQUE: API_KEY manquante sur le serveur.");
}

// 4. API Endpoints

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', ai_ready: !!ai });
});

// Analyze Image & Ghostwrite
app.post('/api/ai/analyze-image', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "Service IA indisponible (Clé manquante)" });
  try {
    const { base64, mimeType, language, genre } = req.body;
    
    const prompt = `Agis comme un expert en narration visuelle et ghostwriter. 
    Genre: ${genre}. Langue de réponse: ${language}.
    Analyse l'image fournie et retourne un JSON strict (sans markdown autour) contenant :
    - openingParagraph (une ouverture d'histoire captivante)
    - mood (description de l'atmosphère)
    - sceneAnalysis (analyse technique de la scène)
    - characters (liste des archétypes de personnages déduits)
    - worldBuilding (éléments de lore suggérés)
    - sensoryDetails (liste de détails sensoriels: sons, odeurs)
    - plotTwists (liste de rebondissements possibles)`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: mimeType } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    const text = response.text();
    // Nettoyage au cas où le modèle renvoie du markdown ```json ... ```
    const cleanText = text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleanText));
  } catch (error) {
    console.error('Analyze Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chat
app.post('/api/ai/chat', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "IA indisponible" });
  try {
    const { history, message, language } = req.body;
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: `Tu es Muse, une IA d'assistance créative. Réponds toujours en ${language}.` },
      history: history || []
    });
    const result = await chat.sendMessage(message);
    res.json({ text: result.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suggestions (Coaching)
app.post('/api/ai/suggestions', async (req, res) => {
  if (!ai) return res.status(503).json({ error: "IA indisponible" });
  try {
    const { text, language } = req.body;
    const prompt = `Context: "${text}". Suggest 3 conversational responses in ${language}. Return strictly a JSON array of objects: [{ "text": "...", "type": "relance|empathy|humor" }]`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const cleanText = response.text().replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleanText));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// STUBS pour les fonctionnalités avancées (Veo/Imagen/TTS)
// Ces endpoints évitent les erreurs 404 côté front même si la feature n'est pas encore active backend.

app.post('/api/ai/tts', async (req, res) => {
  // TODO: Implémenter avec un modèle TTS réel quand disponible via REST
  res.status(501).json({ error: "TTS backend not yet connected to audio model." });
});

app.post('/api/ai/veo-video', async (req, res) => {
  // TODO: Implémenter Veo
  // Simulation pour éviter le crash front
  setTimeout(() => {
    res.status(200).json({ url: null, message: "Veo simulation: feature disabled in MVP." });
  }, 2000);
});

app.post('/api/ai/pro-image', async (req, res) => {
  // TODO: Implémenter Imagen
  res.status(501).json({ error: "Pro Image gen requires Imagen model access." });
});

app.post('/api/ai/edit-image', (req, res) => res.json({ result: null }));
app.post('/api/ai/logo', (req, res) => res.json({ result: null }));


// 5. Serve Static Files (Production)
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback: Renvoie toujours index.html pour le routing React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
