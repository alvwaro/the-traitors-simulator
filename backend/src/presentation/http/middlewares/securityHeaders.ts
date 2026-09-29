import { RequestHandler } from 'express';
import { env } from '../../../shared/config/env';

/**
 * Cabeçalhos de segurança das respostas da API (JSON e imagens do proxy):
 * nada de adivinhar o tipo, abrir em moldura, vazar a página de origem, executar como página ou ficar em cache
 * compartilhado (as respostas têm dados da conta). Por HTTPS, o navegador também passa a exigir HTTPS (HSTS).
 */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cache-Control': 'no-store',
  });
  if (env.cookieSecure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};
