import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { gracefulShutdown } from '../../src/main/shutdown';
import { Lifecycle } from '../../src/presentation/http/health';

/** Faz um GET e devolve o corpo (ou o erro de conexão). */
function get(port: number, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpRequest({ port, path, host: '127.0.0.1' }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
    })
      .on('error', reject)
      .end();
  });
}

describe('desligamento gracioso', () => {
  it('termina a requisição em andamento, avisa o balanceador e só então fecha o banco', async () => {
    let finish: (() => void) | undefined;
    const server = createServer((_req, res) => {
      finish = () => res.end('pronto');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    const lifecycle = new Lifecycle();
    const cleanup = vi.fn(async () => undefined);
    const shutdown = gracefulShutdown(server, { lifecycle, drainDelayMs: 10, timeoutMs: 5_000, cleanup });

    const inFlight = get(port, '/lenta');
    await vi.waitFor(() => expect(finish).toBeDefined());
    const closing = shutdown();
    expect(lifecycle.isDraining).toBe(true);
    expect(shutdown()).toBe(closing);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cleanup).not.toHaveBeenCalled();
    finish?.();
    await expect(inFlight).resolves.toBe('pronto');
    await closing;
    expect(cleanup).toHaveBeenCalledTimes(1);
    await expect(get(port, '/nova')).rejects.toThrow();
  });

  it('corta as conexões que passam do tempo limite', async () => {
    const server = createServer(() => undefined);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const stuck = get(port, '/presa').catch((err: Error) => err.message);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await gracefulShutdown(server, { lifecycle: new Lifecycle(), drainDelayMs: 0, timeoutMs: 50, cleanup: async () => undefined })();
    expect(await stuck).toMatch(/socket hang up|ECONNRESET/);
  });
});
