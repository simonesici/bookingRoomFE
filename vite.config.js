import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configurazione Vite:
// - avvia il server di sviluppo su http://localhost:5173
// - inoltra automaticamente le chiamate /api al backend Spring Boot su http://localhost:8080
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
