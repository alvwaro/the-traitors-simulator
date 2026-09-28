import express, { Express } from 'express';
import { buildContainer } from './container';
import { buildRouter } from '../presentation/http/routes';
import { errorHandler } from '../presentation/http/middlewares/errorHandler';
import { securityHeaders } from '../presentation/http/middlewares/securityHeaders';
import { sessionMiddleware } from '../presentation/http/middlewares/session';
import { env } from '../shared/config/env';

export function buildApp(): Express {
  const app = express();
  // Não revela a tecnologia do servidor no cabeçalho X-Powered-By.
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => { res.json({ ok: true }); });
  const { controllers, guards, getSessionUser } = buildContainer();
  app.use('/api', sessionMiddleware(getSessionUser), buildRouter(controllers, guards));
  app.use(errorHandler);
  return app;
}
