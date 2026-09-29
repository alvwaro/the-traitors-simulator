import { RequestHandler, Response } from 'express';
import { RouteId } from '@traitors/shared';
import { z } from 'zod';
import { IUseCase } from '../../application/contracts/IUseCase';
import { actorOf } from './middlewares/session';

/** Um handler para cada rota do manifesto (o TypeScript acusa rota sem handler). */
export type Handlers<Id extends RouteId = RouteId> = Record<Id, RequestHandler>;

/** Rotas de um grupo do manifesto (ex.: RoutesOf<'seasons'> = 'seasons.create' | 'seasons.get' | ...). */
export type RoutesOf<Prefix extends string> = Extract<RouteId, `${Prefix}.${string}`>;

type Schema = z.ZodType;
/** O que um esquema produz (unknown não muda a interseção quando o esquema não existe). */
type Parsed<S> = S extends Schema ? z.output<S> : unknown;

/** Como quem está logado entra no caso de uso: como dono (ownerId) ou por inteiro (actor, com o papel). */
type Identity = 'ownerId' | 'actor';
type IdentityInput<K> = K extends 'ownerId' ? { ownerId: string } : K extends 'actor' ? { actor: ReturnType<typeof actorOf> } : unknown;

export interface EndpointSpec<P, B, Q, K> {
  params?: P;
  body?: B;
  query?: Q;
  identity?: K;
  /** 200 (padrão), 201 (criou algo) ou 204 (sem corpo). */
  status?: 200 | 201 | 204;
}

type Input<P, B, Q, K> = Parsed<P> & Parsed<B> & Parsed<Q> & IdentityInput<K>;

/** Falha de compilação quando os esquemas não produzem a entrada que o caso de uso espera. */
type MustProduce<Produced, Expected> = [Expected] extends [void]
  ? unknown
  : [Produced] extends [Expected]
    ? unknown
    : { 'os esquemas não produzem a entrada do caso de uso': Expected };

function identityOf(kind: Identity | undefined, res: Response): Record<string, unknown> {
  if (kind === 'ownerId') return { ownerId: actorOf(res).id };
  if (kind === 'actor') return { actor: actorOf(res) };
  return {};
}

/**
 * Adaptador HTTP → caso de uso: valida parâmetros, query e corpo com os esquemas, junta quem está logado
 * (se pedido), executa e responde em JSON. Erros de validação e de regra seguem para o errorHandler.
 */
export function endpoint<I, O, P extends Schema | undefined = undefined, B extends Schema | undefined = undefined, Q extends Schema | undefined = undefined, K extends Identity | undefined = undefined>(
  useCase: IUseCase<I, O>,
  spec: EndpointSpec<P, B, Q, K> & MustProduce<Input<P, B, Q, K>, I>,
): RequestHandler {
  const status = spec.status ?? 200;
  return async (req, res) => {
    const input = {
      ...(spec.params?.parse(req.params) as object),
      ...(spec.query?.parse(req.query) as object),
      ...(spec.body?.parse(req.body ?? {}) as object),
      ...identityOf(spec.identity, res),
    } as I;
    const result = await useCase.execute(input);
    if (status === 204) res.status(204).end();
    else res.status(status).json(result);
  };
}
