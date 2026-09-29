import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { sharedKernel } from './vite.config.ts';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@traitors/shared': sharedKernel } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 30_000,
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      // Caminhos relativos à raiz do repositório: o SonarCloud lê o lcov a partir dela.
      reporter: ['text-summary', ['lcov', { projectRoot: '..' }]],
      reportsDirectory: 'coverage',
    },
  },
});
