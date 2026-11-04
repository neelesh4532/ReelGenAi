import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The browser talks to Vite, and Vite forwards /api to your server (no CORS setup needed)
    proxy: { '/api': 'http://localhost:5000' },
  },
});