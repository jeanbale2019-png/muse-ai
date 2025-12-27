import express from "express";
import path from "path";
import compression from "compression";
import helmet from "helmet";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional (safe): parse JSON if you later add /api endpoints
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

        // ✅ IMPORTANT: allow Firebase + Google APIs + Gemini + local API
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

// Serve static files from /dist if it exists, otherwise from root
const publicDir = path.join(__dirname, "dist");
app.use(express.static(publicDir));
app.use(express.static(__dirname));

// SPA routing: catch-all
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
