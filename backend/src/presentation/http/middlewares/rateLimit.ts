import { RequestHandler } from 'express';
import { RateLimiter, RateLimitRule, RateLimitStore } from '@traitors/shared';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Limite por IP (ex.: segurar tentativas de adivinhar senhas). O gateway aplica o mesmo limite antes de a
 * requisição chegar aqui; este é a segunda barreira (e a única quando a API roda sem o gateway).
 * O armazenamento padrão é em memória, por processo; com várias instâncias, injete um compartilhado.
 */
export function rateLimit(rule: RateLimitRule, store?: RateLimitStore): RequestHandler {
  const limiter = new RateLimiter(rule, store);
  return (req, res, next) => {
    const verdict = limiter.check(req.ip ?? 'unknown');
    if (!verdict.allowed) {
      res.set('Retry-After', String(verdict.retryAfterSeconds));
      throw new AppError('Muitas tentativas. Espere alguns minutos e tente de novo.', 429);
    }
    next();
  };
}
