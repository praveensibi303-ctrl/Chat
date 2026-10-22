import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // For GitHub Pages: set base to '/<repo-name>/' via env var, or '/' for custom domain
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5173,
    proxy: mode === 'development'
      ? {
          '/socket.io': { target: 'http://localhost:3001', ws: true },
          '/health': 'http://localhost:3001',
          '/rooms': 'http://localhost:3001',
        }
      : undefined,
  },
}));
