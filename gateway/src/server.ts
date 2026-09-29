import { createServer } from 'node:http';
import { createGateway } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const gateway = createGateway(config);
void gateway.pool.checkAll();
gateway.pool.startHealthChecks(config.healthIntervalMs);

const server = createServer(gateway.handle);
// Conexões mantidas abertas por mais tempo que as do balanceador na frente: ele nunca reaproveita uma fechada.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.listen(config.port, () => {
  const targets = config.upstreams.map((u) => u.origin).join(', ');
  console.log(`The Traitors gateway on port ${config.port} -> ${targets} (${config.strategy})`);
});

/** Desligamento gracioso: para de aceitar conexões e espera as requisições em andamento (até 10 s). */
function shutdown(signal: string): void {
  console.log(`${signal} recebido: terminando as requisições em andamento...`);
  gateway.pool.stopHealthChecks();
  setTimeout(() => server.closeAllConnections(), 10_000).unref();
  server.close(() => process.exit(0));
  server.closeIdleConnections();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
