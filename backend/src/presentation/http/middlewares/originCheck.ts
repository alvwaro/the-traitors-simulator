import { RequestHandler } from 'express';
import { isCrossSiteWrite } from '@traitors/shared';
import { ForbiddenError } from '../../../shared/errors/AppError';

/**
 * Defesa contra CSRF: recusa POST/PATCH/DELETE vindos de páginas de outro site (o cookie de sessão
 * iria junto). Complementa o SameSite=Lax do cookie; o gateway faz a mesma checagem antes.
 */
export function originCheck(allowedOrigins: readonly string[] = []): RequestHandler {
  return (req, _res, next) => {
    const forged = isCrossSiteWrite(
      { method: req.method, host: req.get('host'), origin: req.get('origin'), secFetchSite: req.get('sec-fetch-site') },
      allowedOrigins,
    );
    if (forged) throw new ForbiddenError('Requisição de outro site recusada');
    next();
  };
}
