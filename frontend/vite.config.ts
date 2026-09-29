import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';

/** O kernel compartilhado (enums, regras, rotas) entra pelo código-fonte, como parte do app. */
export const sharedKernel = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: { alias: { '@traitors/shared': sharedKernel } },
    server: {
      port: 5173,
      // Em desenvolvimento, /api é repassado para o backend (ou para o gateway) sem CORS.
      // O Host do navegador segue junto (como no nginx): a proteção contra CSRF compara a origem com ele.
      proxy: { '/api': { target: env.VITE_API_PROXY ?? 'http://localhost:3000', changeOrigin: false } },
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), fileURLToPath(new URL('../shared', import.meta.url))] },
    },
  };
});
