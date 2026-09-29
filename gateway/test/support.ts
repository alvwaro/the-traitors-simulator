import { createServer, request, type IncomingHttpHeaders, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createGateway, type Gateway } from '../src/app';
import { loadConfig, type GatewayConfig } from '../src/config';
import { strategyFor, UpstreamPool } from '../src/upstream/pool';

export const ID = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';
export const SESSION = 'traitors_session=abc';

const servers: Server[] = [];

export async function listen(handler: RequestListener): Promise<{ server: Server; port: number; url: URL }> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, port, url: new URL(`http://127.0.0.1:${port}`) };
}

export async function closeAll(): Promise<void> {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
}

export interface SeenRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

/** Instância falsa do backend: guarda o que recebeu e responde com o próprio nome. */
export async function fakeApi(name: string, respond?: RequestListener) {
  const seen: SeenRequest[] = [];
  const instance = await listen((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (req.url === '/health/ready') {
        res.writeHead(200).end();
        return;
      }
      seen.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      if (respond) {
        respond(req, res);
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json', 'x-api': name, 'cache-control': 'private' });
      res.end(JSON.stringify({ from: name }));
    });
  });
  return { ...instance, seen };
}

export interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

/** Requisição crua (dá para mandar Host, Origin e corpos malformados, o que o fetch não deixa). */
export function call(port: number, options: { method?: string; path: string; headers?: Record<string, string | number>; body?: string }): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method: options.method ?? 'GET', path: options.path, headers: options.headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(options.body);
  });
}

/** Gateway de teste na frente das instâncias dadas (sem checagem periódica de saúde). */
export async function startGateway(upstreams: URL[], overrides: Partial<GatewayConfig> = {}): Promise<{ port: number; gateway: Gateway }> {
  const config: GatewayConfig = { ...loadConfig({}), upstreams, healthIntervalMs: 0, ...overrides };
  const gateway = createGateway(config, new UpstreamPool(upstreams, strategyFor(config.strategy)));
  const { port } = await listen(gateway.handle);
  return { port, gateway };
}
