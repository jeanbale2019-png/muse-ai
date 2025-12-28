
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://esm.sh", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "https://esm.sh", "https://generativelanguage.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://*.dicebear.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      mediaSrc: ["'self'", "data:", "blob:", "https://*.google.com", "https://generativelanguage.googleapis.com"],
      frameSrc: ["'self'", "https://*.firebaseapp.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

// Force HTTPS in production
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Serve static files from /dist if it exists, otherwise from root
const publicDir = path.join(__dirname, 'dist');
app.use(express.static(publicDir));
app.use(express.static(__dirname));

// SPA routing: catch-all
app.get('*', (req, res) => {
  const indexInDist = path.join(publicDir, 'index.html');
  const indexInRoot = path.join(__dirname, 'index.html');
  
  res.sendFile(indexInDist, (err) => {
    if (err) {
      res.sendFile(indexInRoot);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Social Muse Server live on port ${PORT}`);
});
