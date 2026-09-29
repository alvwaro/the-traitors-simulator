import { Server } from 'node:http';
import { Lifecycle } from '../presentation/http/health';

export interface ShutdownOptions {
  lifecycle: Lifecycle;
  /** Espera antes de fechar a porta, para o balanceador ver o 503 da prontidão e tirar esta instância. */
  drainDelayMs: number;
  /** Tempo máximo para as requisições em andamento terminarem; depois disso as conexões são cortadas. */
  timeoutMs: number;
  /** Fecha o que sobrar (pool do banco, fila...). */
  cleanup: () => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Desligamento gracioso: avisa que está saindo, para de aceitar conexões novas, espera as requisições em
 * andamento (até o limite) e só então fecha o banco. Chamadas repetidas (SIGTERM + SIGINT) esperam o mesmo desligamento.
 */
export function gracefulShutdown(server: Server, options: ShutdownOptions): () => Promise<void> {
  let closing: Promise<void> | undefined;
  const close = async () => {
    options.lifecycle.startDraining();
    if (options.drainDelayMs > 0) await wait(options.drainDelayMs);
    const force = setTimeout(() => server.closeAllConnections(), options.timeoutMs);
    force.unref();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });
    clearTimeout(force);
    await options.cleanup();
  };
  return () => {
    closing ??= close();
    return closing;
  };
}
