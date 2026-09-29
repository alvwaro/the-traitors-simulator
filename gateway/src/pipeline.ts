import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RouteId, RouteSpec } from '@traitors/shared';

/** Tudo que as etapas do gateway sabem sobre a requisição em andamento. */
export interface GatewayContext {
  req: IncomingMessage;
  res: ServerResponse;
  /** Caminho pedido (sem a query), exatamente como veio. */
  path: string;
  /** Query com o "?" (ou vazia). */
  search: string;
  requestId: string;
  clientIp: string;
  /** Rota do manifesto (preenchida pela etapa que valida a rota). */
  route?: { id: RouteId; spec: RouteSpec };
  /** Corpo já lido e conferido (requisições que mudam dados). */
  body?: Buffer;
}

export type Next = () => Promise<void>;

/**
 * Uma etapa da cadeia (Chain of Responsibility): responde e encerra a requisição (ex.: 401, 429)
 * ou passa adiante chamando `next`. A última etapa repassa ao backend.
 */
export type Middleware = (ctx: GatewayContext, next: Next) => Promise<void> | void;

/** Encadeia as etapas na ordem dada (cada uma decide se a próxima roda). */
export function compose(middlewares: readonly Middleware[]): (ctx: GatewayContext) => Promise<void> {
  return (ctx) => {
    const run = async (index: number): Promise<void> => {
      const middleware = middlewares[index];
      if (middleware) await middleware(ctx, () => run(index + 1));
    };
    return run(0);
  };
}
