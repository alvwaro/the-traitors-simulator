import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Actor } from '../../../application/dtos/AuthDTOs';
import { GetSessionUserUseCase } from '../../../application/use-cases/auth/SessionUseCases';
import { PublicUser } from '../../../domain/entities';
import { env } from '../../../shared/config/env';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/AppError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** Quem está logado (null = visitante). */
      user?: PublicUser | null;
      /** Token da sessão lido do cookie (para o logout). */
      sessionToken?: string;
    }
  }
}

export const SESSION_COOKIE = 'traitors_session';

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** Cookie só para o servidor (httpOnly): o JavaScript da página não consegue ler o token. */
export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/', expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/' });
}

/** Identifica quem faz a requisição pelo cookie (visitantes seguem como null). */
export function sessionMiddleware(getSessionUser: GetSessionUserUseCase): RequestHandler {
  return async (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    res.locals.sessionToken = token;
    res.locals.user = token ? await getSessionUser.execute({ token }) : null;
    next();
  };
}

/** Quem está logado; erro 401 para visitantes. */
export function actorOf(res: Response): Actor {
  const user = res.locals.user;
  if (!user) throw new UnauthorizedError();
  return { id: user.id, role: user.role };
}

export const requireUser: RequestHandler = (_req: Request, res: Response, next: NextFunction) => {
  actorOf(res);
  next();
};

/** Só donos do site (ex.: editar comportamentos e frases, que valem para todos). */
export const requireSiteOwner: RequestHandler = (_req: Request, res: Response, next: NextFunction) => {
  if (actorOf(res).role !== 'OWNER') throw new ForbiddenError('Só os donos do site podem fazer isso');
  next();
};
