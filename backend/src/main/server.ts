import { env } from '../shared/config/env';
import { pool } from '../infrastructure/database/connection';
import { checkDatabase } from '../infrastructure/database/healthCheck';
import { Lifecycle } from '../presentation/http/health';
import { buildApp } from './app';
import { gracefulShutdown } from './shutdown';

const lifecycle = new Lifecycle();
const server = buildApp({}, lifecycle).listen(env.port, () => {
  console.log(`The Traitors API running on http://localhost:${env.port}`);
  void checkDatabase(pool);
});
// Conexões mantidas abertas por mais tempo que as do balanceador: ele nunca reaproveita uma que o servidor fechou.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const shutdown = gracefulShutdown(server, {
  lifecycle,
  drainDelayMs: Number(process.env.SHUTDOWN_DRAIN_MS ?? 0),
  timeoutMs: env.shutdownTimeoutMs,
  cleanup: () => pool.end(),
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`${signal} recebido: terminando as requisições em andamento...`);
    shutdown().then(
      () => process.exit(0),
      (err: unknown) => {
        console.error(err);
        process.exit(1);
      },
    );
  });
}
