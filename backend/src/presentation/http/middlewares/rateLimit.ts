import { RequestHandler } from 'express';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Limite simples por IP (em memória): segura tentativas de adivinhar senhas.
 * Com várias instâncias do servidor, cada uma conta as suas.
 */
export function rateLimit(options: { windowMs: number; max: number }): RequestHandler {
  const hits = new Map<string, number[]>();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const recent = (hits.get(key) ?? []).filter((t) => now - t < options.windowMs);
    if (recent.length >= options.max) throw new AppError('Muitas tentativas. Espere alguns minutos e tente de novo.', 429);
    recent.push(now);
    hits.set(key, recent);
    // limpeza ocasional para o mapa não crescer para sempre
    if (hits.size > 10_000) {
      for (const [k, times] of hits) if (times.every((t) => now - t >= options.windowMs)) hits.delete(k);
    }
    next();
  };
}
