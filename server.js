
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Sécurité : Configuration des en-têtes HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://esm.sh", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "https://esm.sh"],
      imgSrc: ["'self'", "data:", "https://*.dicebear.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      mediaSrc: ["'self'", "data:", "blob:", "https://*.google.com"],
      frameSrc: ["'self'", "https://*.firebaseapp.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Optimisation : Compression Gzip
app.use(compression());

// Forcer le HTTPS sur Hostinger
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Servir les fichiers statiques du répertoire racine
app.use(express.static(path.join(__dirname)));

// Fallback pour le routage SPA (React)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Social Muse Server is running on port ${PORT}`);
});
