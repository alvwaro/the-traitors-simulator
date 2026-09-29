import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Caminhos relativos à raiz do repositório: o SonarCloud lê o lcov a partir dela.
      reporter: ['text-summary', ['lcov', { projectRoot: '..' }]],
      reportsDirectory: 'coverage',
    },
  },
});
