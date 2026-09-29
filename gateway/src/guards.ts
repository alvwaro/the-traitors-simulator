import type { IncomingMessage } from 'node:http';
import {
  API_PREFIX,
  isCrossSiteWrite,
  RateLimiter,
  type RateLimitGroup,
  type RateLimitVerdict,
  RouteMatcher,
  SESSION_COOKIE,
} from '@traitors/shared';
import type { GatewayContext, Middleware } from './pipeline';
import { sendError } from './respond';

/**
 * Verificações feitas no gateway, antes de a requisição chegar ao backend. São as baratas e genéricas
 * (formato, tamanho, origem, frequência); o backend continua conferindo tudo de novo e as regras do jogo.
 */

/** Só passa o que existe no manifesto: rota desconhecida (404), método errado (405) e id malformado (400) param aqui. */
export function routeGuard(matcher = new RouteMatcher()): Middleware {
  return (ctx, next) => {
    const method = ctx.req.method === 'HEAD' ? 'GET' : (ctx.req.method ?? 'GET');
    const match = matcher.match(method, ctx.path.slice(API_PREFIX.length));
    switch (match.kind) {
      case 'not-found':
        return sendError(ctx.res, 404, 'NotFound', 'Rota inexistente');
      case 'method-not-allowed':
        return sendError(ctx.res, 405, 'MethodNotAllowed', 'Método não permitido nesta rota', { Allow: match.allowed.join(', ') });
      case 'invalid-param':
        return sendError(ctx.res, 400, 'ValidationError', `Identificador inválido: ${match.param}`);
      default:
        ctx.route = { id: match.id, spec: match.spec };
        return next();
    }
  };
}

function hasCookie(header: string | undefined, name: string): boolean {
  return (header ?? '').split(';').some((part) => {
    const [key, value] = part.trim().split('=');
    return key === name && !!value;
  });
}

/** Rota de quem está logado sem o cookie da sessão: 401 aqui mesmo (quem valida a sessão de verdade é o backend). */
export const sessionGate: Middleware = (ctx, next) => {
  if (ctx.route?.spec.access !== 'public' && !hasCookie(ctx.req.headers.cookie, SESSION_COOKIE)) {
    return sendError(ctx.res, 401, 'UnauthorizedError', 'Entre na sua conta para continuar');
  }
  return next();
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Defesa contra CSRF: POST/PATCH/DELETE vindos de páginas de outro site são recusados. */
export function originGuard(allowedOrigins: readonly string[]): Middleware {
  return (ctx, next) => {
    const { headers, method } = ctx.req;
    const forged = isCrossSiteWrite(
      { method: method ?? 'GET', host: headers.host, origin: headers.origin, secFetchSite: single(headers['sec-fetch-site']) },
      allowedOrigins,
    );
    if (forged) return sendError(ctx.res, 403, 'ForbiddenError', 'Requisição de outro site recusada');
    return next();
  };
}

function tooMany(ctx: GatewayContext, verdict: RateLimitVerdict): void {
  sendError(ctx.res, 429, 'TooManyRequests', 'Muitas tentativas. Espere alguns minutos e tente de novo.', {
    'Retry-After': String(verdict.retryAfterSeconds),
  });
}

/** Limite geral por IP (vale até para rotas inexistentes: quem varre a API também é barrado). */
export function ipRateLimit(limiter: RateLimiter): Middleware {
  return (ctx, next) => {
    const verdict = limiter.check(ctx.clientIp);
    return verdict.allowed ? next() : tooMany(ctx, verdict);
  };
}

/** Limite do grupo da rota no manifesto (login e cadastro, proxy de imagens). */
export function routeRateLimit(groups: Readonly<Record<RateLimitGroup, RateLimiter>>): Middleware {
  return (ctx, next) => {
    const group = ctx.route?.spec.rateLimit;
    if (!group) return next();
    const verdict = groups[group].check(ctx.clientIp);
    return verdict.allowed ? next() : tooMany(ctx, verdict);
  };
}

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Lê o corpo até o limite; passou do limite, descarta o resto e devolve null. */
function readBody(req: IncomingMessage, limitBytes: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        req.off('data', onData);
        req.resume();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    };
    req.on('data', onData);
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isJson(contentType: string | undefined): boolean {
  return (contentType ?? '').split(';')[0].trim().toLowerCase() === 'application/json';
}

/** Corpo das requisições que mudam dados: tamanho máximo (413), só JSON (415) e JSON bem formado (400). */
export function bodyGuard(limitBytes: number): Middleware {
  return async (ctx, next) => {
    const { req, res } = ctx;
    if (!METHODS_WITH_BODY.has(req.method ?? '')) return next();
    const tooLarge = () => sendError(res, 413, 'PayloadTooLarge', 'Corpo da requisição grande demais', { Connection: 'close' });
    if (Number(req.headers['content-length'] ?? 0) > limitBytes) {
      req.resume();
      return tooLarge();
    }
    const body = await readBody(req, limitBytes);
    if (body === null) return tooLarge();
    if (body.length > 0) {
      if (!isJson(req.headers['content-type'])) return sendError(res, 415, 'UnsupportedMediaType', 'Envie o corpo em JSON');
      try {
        JSON.parse(body.toString('utf8'));
      } catch {
        return sendError(res, 400, 'BadRequest', 'Corpo da requisição inválido');
      }
    }
    ctx.body = body;
    return next();
  };
}
