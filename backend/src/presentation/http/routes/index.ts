import { RequestHandler, Router } from 'express';
import { API_ROUTES, RATE_LIMITS, RateLimitGroup, ResourceGuard, RouteAccess, RouteId, RouteSpec } from '@traitors/shared';
import { Handlers } from '../endpoint';
import { AccessGuards } from '../middlewares/access';
import { rateLimit } from '../middlewares/rateLimit';
import { requireSiteOwner, requireUser } from '../middlewares/session';

const ACCESS: Record<RouteAccess, RequestHandler[]> = {
  public: [],
  user: [requireUser],
  owner: [requireSiteOwner],
};

/** Middlewares de cada rota, na ordem: limite de tentativas → quem pode chamar → dono do recurso. */
function middlewaresFor(spec: RouteSpec, guards: Record<ResourceGuard, RequestHandler>, limits: Record<RateLimitGroup, RequestHandler>): RequestHandler[] {
  return [
    ...(spec.rateLimit ? [limits[spec.rateLimit]] : []),
    ...ACCESS[spec.access],
    ...(spec.guard ? [guards[spec.guard]] : []),
  ];
}

/**
 * Rotas da API montadas a partir do manifesto compartilhado (o mesmo que o gateway usa para barrar
 * requisições inválidas antes de chegarem aqui). Cada rota do manifesto precisa de um handler.
 */
export function buildRouter(handlers: Handlers, access: AccessGuards): Router {
  const router = Router();
  const guards: Record<ResourceGuard, RequestHandler> = {
    seasonRead: access.season('read'),
    seasonWrite: access.season('write'),
    cast: access.cast(),
    character: access.character(),
  };
  const limits: Record<RateLimitGroup, RequestHandler> = {
    auth: rateLimit(RATE_LIMITS.auth),
    imageProxy: rateLimit(RATE_LIMITS.imageProxy),
  };
  for (const [id, spec] of Object.entries(API_ROUTES) as [RouteId, RouteSpec][]) {
    const method = spec.method.toLowerCase() as Lowercase<RouteSpec['method']>;
    router[method](spec.path, ...middlewaresFor(spec, guards, limits), handlers[id]);
  }
  return router;
}
