import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Em desenvolvimento, /api é repassado para o backend (sem CORS).
      proxy: { '/api': env.VITE_API_PROXY ?? 'http://localhost:3000' },
    },
  };
});
