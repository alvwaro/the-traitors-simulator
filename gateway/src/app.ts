import type { IncomingMessage, RequestListener } from 'node:http';
import { API_PREFIX, errorForLog, RATE_LIMITS, RateLimiter, REQUEST_ID_HEADER, requestIdFrom, sanitizeForLog } from '@traitors/shared';
import type { GatewayConfig } from './config';
import { bodyGuard, ipRateLimit, originGuard, routeGuard, routeRateLimit, sessionGate } from './guards';
import { compose, type GatewayContext } from './pipeline';
import { SECURITY_HEADERS, sendError, sendJson } from './respond';
import { strategyFor, UpstreamPool } from './upstream/pool';
import { proxy } from './upstream/proxy';

export interface Gateway {
  handle: RequestListener;
  pool: UpstreamPool;
}

/** Separa caminho e query sem interpretar o endereço (um "//outro.site" continua sendo só um caminho). */
function splitTarget(raw: string | undefined): { path: string; search: string } {
  const target = raw ?? '/';
  const q = target.indexOf('?');
  return q === -1 ? { path: target, search: '' } : { path: target.slice(0, q), search: target.slice(q) };
}

/** IP do visitante: o da conexão ou, atrás de um proxy confiável, o último do X-Forwarded-For (quem ele viu). */
function clientIpOf(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers['x-forwarded-for'];
  const last = typeof forwarded === 'string' ? forwarded.split(',').at(-1)?.trim() : undefined;
  return (trustProxy && last) || req.socket.remoteAddress || 'unknown';
}

/** Id da requisição: o que veio do proxy confiável (se for um UUID) ou um novo. */
function requestIdOf(req: IncomingMessage, trustProxy: boolean): string {
  return requestIdFrom(trustProxy ? req.headers[REQUEST_ID_HEADER] : undefined);
}

/** Falha inesperada na cadeia, em uma linha de JSON: tudo que veio do cliente passa pelo saneamento. */
function logFailure(ctx: GatewayContext, err: unknown): void {
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'falha ao atender a requisição',
      requestId: sanitizeForLog(ctx.requestId),
      method: sanitizeForLog(ctx.req.method),
      path: sanitizeForLog(ctx.path),
      error: errorForLog(err),
    }),
  );
}

/**
 * Monta o gateway: health checks próprios, só /api passa, e cada requisição da API atravessa a cadeia de
 * verificações antes de chegar a uma instância do backend.
 */
export function createGateway(config: GatewayConfig, pool = new UpstreamPool(config.upstreams, strategyFor(config.strategy))): Gateway {
  const groups = { auth: new RateLimiter(RATE_LIMITS.auth), imageProxy: new RateLimiter(RATE_LIMITS.imageProxy) };
  // Ordem: das checagens mais baratas às que leem o corpo; o backend só recebe o que passou por todas.
  const pipeline = compose([
    ipRateLimit(new RateLimiter(config.globalRateLimit)),
    routeGuard(),
    routeRateLimit(groups),
    originGuard(config.allowedOrigins),
    sessionGate,
    bodyGuard(config.bodyLimitBytes),
    proxy(pool, { timeoutMs: config.upstreamTimeoutMs, trustProxy: config.trustProxy }),
  ]);

  const handle: RequestListener = (req, res) => {
    const requestId = requestIdOf(req, config.trustProxy);
    res.setHeaders(new Map([...Object.entries(SECURITY_HEADERS), [REQUEST_ID_HEADER, requestId]]));
    const { path, search } = splitTarget(req.url);

    if (path === '/health' || path === '/health/live') return sendJson(res, 200, { ok: true });
    if (path === '/health/ready') return sendJson(res, pool.hasHealthy ? 200 : 503, { ok: pool.hasHealthy });
    if (path !== API_PREFIX && !path.startsWith(`${API_PREFIX}/`)) return sendError(res, 404, 'NotFound', 'Rota inexistente');

    const ctx: GatewayContext = { req, res, path, search, requestId, clientIp: clientIpOf(req, config.trustProxy) };
    pipeline(ctx).catch((err: unknown) => {
      logFailure(ctx, err);
      sendError(res, 502, 'BadGateway', 'O servidor está indisponível no momento. Tente de novo em instantes.');
    });
  };
  return { handle, pool };
}
