import { request, type IncomingHttpHeaders, type OutgoingHttpHeaders } from 'node:http';
import { request as secureRequest } from 'node:https';
import type { GatewayContext, Middleware } from '../pipeline';
import { sendError } from '../respond';
import type { Upstream, UpstreamPool } from './pool';

/** Cabeçalhos que valem só para uma conexão (RFC 9110): não atravessam o proxy. */
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

/** Falhas em que a requisição comprovadamente não chegou ao backend (dá para tentar outra instância, qualquer método). */
const NOT_DELIVERED = new Set(['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN']);

/** Métodos que podem ser repetidos sem efeito colateral. */
const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS']);

const UNAVAILABLE = 'O servidor está indisponível no momento. Tente de novo em instantes.';

export interface ProxyOptions {
  timeoutMs: number;
  trustProxy: boolean;
}

/** A conexão com a instância falhou; `delivered` diz se a requisição pode ter chegado a ela. */
class UpstreamFailure extends Error {
  constructor(readonly delivered: boolean) {
    super('Falha na conexão com o backend');
  }
}

class UpstreamTimeout extends Error {}

function withoutHopByHop(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
  const listed = new Set(
    String(headers.connection ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  const out: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !HOP_BY_HOP.has(name) && !listed.has(name)) out[name] = value;
  }
  return out;
}

function protocolOf(ctx: GatewayContext, trustProxy: boolean): string {
  const forwarded = ctx.req.headers['x-forwarded-proto'];
  if (trustProxy && typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return 'encrypted' in ctx.req.socket && ctx.req.socket.encrypted ? 'https' : 'http';
}

/** Repassa a requisição a uma instância e transmite a resposta (sem esperar ela terminar, como no streaming). */
function forward(ctx: GatewayContext, upstream: Upstream, options: ProxyOptions): Promise<void> {
  const target = new URL(`${ctx.path}${ctx.search}`, upstream.url);
  const send = target.protocol === 'https:' ? secureRequest : request;
  const headers: OutgoingHttpHeaders = {
    ...withoutHopByHop(ctx.req.headers),
    'x-request-id': ctx.requestId,
    // O backend confia em um salto de proxy: vê como IP do visitante o que o gateway apurou.
    'x-forwarded-for': ctx.clientIp,
    'x-forwarded-proto': protocolOf(ctx, options.trustProxy),
    'x-forwarded-host': ctx.req.headers.host ?? '',
  };
  if (ctx.body?.length) headers['content-length'] = ctx.body.length;
  else delete headers['content-length'];

  upstream.active++;
  return new Promise<void>((resolve, reject) => {
    const upstreamReq = send(target, { method: ctx.req.method, headers, timeout: options.timeoutMs }, (upstreamRes) => {
      ctx.res.writeHead(upstreamRes.statusCode ?? 502, withoutHopByHop(upstreamRes.headers));
      upstreamRes.pipe(ctx.res);
      upstreamRes.on('end', () => resolve());
      upstreamRes.on('error', () => {
        ctx.res.destroy();
        resolve();
      });
      // Quem pediu desistiu: libera a instância.
      ctx.res.on('close', () => {
        if (!ctx.res.writableFinished) upstreamRes.destroy();
      });
    });
    upstreamReq.on('timeout', () => upstreamReq.destroy(new UpstreamTimeout()));
    upstreamReq.on('error', (err: NodeJS.ErrnoException) => {
      if (err instanceof UpstreamTimeout) reject(err);
      else reject(new UpstreamFailure(!NOT_DELIVERED.has(err.code ?? '')));
    });
    upstreamReq.end(ctx.body?.length ? ctx.body : undefined);
  }).finally(() => {
    upstream.active--;
  });
}

/**
 * Última etapa: escolhe a instância pelo balanceamento e repassa. Se a conexão falhar, a instância sai da roda
 * e a requisição vai para outra — quando ela não chegou ao backend ou quando repetir não tem efeito (leituras).
 */
export function proxy(pool: UpstreamPool, options: ProxyOptions): Middleware {
  return async (ctx) => {
    const tried = new Set<Upstream>();
    for (let upstream = pool.pick(tried); upstream; upstream = pool.pick(tried)) {
      tried.add(upstream);
      try {
        await forward(ctx, upstream, options);
        return;
      } catch (err) {
        // A resposta já tinha começado a sair: não dá para trocar de instância nem responder um erro limpo.
        if (ctx.res.headersSent) {
          ctx.res.destroy();
          return;
        }
        if (err instanceof UpstreamTimeout) return sendError(ctx.res, 504, 'GatewayTimeout', 'O servidor demorou demais para responder. Tente de novo.');
        pool.markDown(upstream);
        const retryable = !(err as UpstreamFailure).delivered || IDEMPOTENT.has(ctx.req.method ?? 'GET');
        if (!retryable) return sendError(ctx.res, 502, 'BadGateway', UNAVAILABLE);
      }
    }
    sendError(ctx.res, 503, 'ServiceUnavailable', UNAVAILABLE);
  };
}
