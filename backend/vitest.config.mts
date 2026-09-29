import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Os testes usam um banco próprio (o nome do banco do .env com "_test" no fim), recriado a cada execução
 * pelo globalSetup. No CI, DATABASE_URL aponta para o Postgres do job.
 */
if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL (backend/.env): os testes criam um banco "<nome>_test" ao lado dele');
const base = new URL(process.env.DATABASE_URL);
const testUrl = new URL(base);
testUrl.pathname = `${base.pathname.replace(/_test$/, '')}_test`;

export default defineConfig({
  // O kernel compartilhado entra pelo código-fonte (não precisa compilar o pacote antes dos testes).
  resolve: { alias: { '@traitors/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    env: { DATABASE_URL: testUrl.toString(), NODE_ENV: 'test' },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Os testes de API dividem o mesmo banco: um arquivo por vez evita disputa por dados e travas.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/main/server.ts',
        'src/main/worker.ts',
        'src/infrastructure/database/migrate.ts',
        'src/infrastructure/cli/**',
      ],
      // Caminhos relativos à raiz do repositório: o SonarCloud lê o lcov a partir dela.
      reporter: ['text-summary', ['lcov', { projectRoot: '..' }]],
      reportsDirectory: 'coverage',
    },
  },
});
