import { RequestHandler } from 'express';

/** Cabeçalhos de segurança básicos para as respostas da API (JSON e imagens do proxy). */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
};
