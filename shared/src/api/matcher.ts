import { API_ROUTES, HttpMethod, RouteId, RouteSpec } from './routes';

/** Formato de um UUID (8-4-4-4-12 hexadecimais). O backend confere a versão; aqui só se barra o que nem parece um id. */
const UUID_SHAPE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_SHAPE.test(value);
}

export type RouteMatch =
  | { kind: 'found'; id: RouteId; spec: RouteSpec; params: Record<string, string> }
  | { kind: 'invalid-param'; id: RouteId; spec: RouteSpec; param: string }
  | { kind: 'method-not-allowed'; allowed: HttpMethod[] }
  | { kind: 'not-found' };

interface CompiledRoute {
  id: RouteId;
  spec: RouteSpec;
  segments: string[];
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Casa um caminho com as rotas da API. Cada rota é uma lista de trechos; ":nome" aceita qualquer trecho. */
export class RouteMatcher {
  private readonly routes: CompiledRoute[];

  constructor(routes: Readonly<Record<RouteId, RouteSpec>> = API_ROUTES) {
    this.routes = (Object.entries(routes) as [RouteId, RouteSpec][]).map(([id, spec]) => ({ id, spec, segments: segmentsOf(spec.path) }));
  }

  /** `path` é relativo a /api (sem a query). */
  match(method: string, path: string): RouteMatch {
    let segments: string[];
    try {
      segments = segmentsOf(path).map((segment) => decodeURIComponent(segment));
    } catch {
      return { kind: 'not-found' };
    }
    const candidates = this.routes.flatMap((route) => {
      const params = this.capture(route.segments, segments);
      return params ? [{ route, params }] : [];
    });
    if (candidates.length === 0) return { kind: 'not-found' };

    const hit = candidates.find((c) => c.route.spec.method === method);
    if (!hit) return { kind: 'method-not-allowed', allowed: [...new Set(candidates.map((c) => c.route.spec.method))] };

    const { route, params } = hit;
    const invalid = Object.entries(params).find(([, value]) => !looksLikeUuid(value));
    if (invalid) return { kind: 'invalid-param', id: route.id, spec: route.spec, param: invalid[0] };
    return { kind: 'found', id: route.id, spec: route.spec, params };
  }

  private capture(pattern: readonly string[], actual: readonly string[]): Record<string, string> | null {
    if (pattern.length !== actual.length) return null;
    const params: Record<string, string> = {};
    for (const [i, part] of pattern.entries()) {
      if (part.startsWith(':')) params[part.slice(1)] = actual[i];
      else if (part !== actual[i]) return null;
    }
    return params;
  }
}
