import express, { Express } from 'express';
import { pool } from '../infrastructure/database/connection';
import { pingDatabase } from '../infrastructure/database/healthCheck';
import { healthRouter, Lifecycle } from '../presentation/http/health';
import { errorHandler } from '../presentation/http/middlewares/errorHandler';
import { originCheck } from '../presentation/http/middlewares/originCheck';
import { requestId } from '../presentation/http/middlewares/requestId';
import { securityHeaders } from '../presentation/http/middlewares/securityHeaders';
import { sessionMiddleware } from '../presentation/http/middlewares/session';
import { buildRouter } from '../presentation/http/routes';
import { env } from '../shared/config/env';
import { buildContainer, ContainerOverrides } from './container';

/** Tamanho máximo do corpo JSON (as maiores requisições, como a mesa redonda com votos, ficam bem abaixo). */
const BODY_LIMIT = '1mb';

export function buildApp(overrides: ContainerOverrides = {}, lifecycle = new Lifecycle()): Express {
  const app = express();
  // Não revela a tecnologia do servidor no cabeçalho X-Powered-By.
  app.disable('x-powered-by');
  // Atrás do gateway/balanceador: o IP do visitante vem do X-Forwarded-For (um salto de proxy confiável).
  if (env.trustProxy) app.set('trust proxy', 1);
  app.use(requestId);
  app.use(securityHeaders);
  app.use(healthRouter(lifecycle, () => pingDatabase(pool)));
  app.use(express.json({ limit: BODY_LIMIT }));

  const { handlers, guards, getSessionUser } = buildContainer(overrides);
  app.use('/api', originCheck(env.allowedOrigins), sessionMiddleware(getSessionUser), buildRouter(handlers, guards));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NotFound', message: 'Rota inexistente' });
  });
  app.use(errorHandler);
  return app;
}
