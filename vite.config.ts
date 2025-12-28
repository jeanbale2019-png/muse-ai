
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use relative paths for all assets to ensure compatibility with various hosting environments
  base: './',
  define: {
    // Inject the API_KEY from the environment for use in the Gemini SDK
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Ensure sourcemaps are disabled in production for better performance/security
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@google/genai'],
        },
      },
    },
  },
  server: {
    port: 3000,
  }
});
