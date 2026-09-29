import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O kernel compartilhado entra pelo código-fonte (não precisa compilar o pacote antes dos testes).
  resolve: { alias: { '@traitors/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Ponto de entrada: só liga as peças (porta, sinais do sistema).
      exclude: ['src/server.ts'],
      // Caminhos relativos à raiz do repositório: o SonarCloud lê o lcov a partir dela.
      reporter: ['text-summary', ['lcov', { projectRoot: '..' }]],
      reportsDirectory: 'coverage',
    },
  },
});
