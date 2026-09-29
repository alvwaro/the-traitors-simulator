import { LoginUseCase } from '../../../application/use-cases/auth/LoginUseCase';
import { RegisterUseCase } from '../../../application/use-cases/auth/RegisterUseCase';
import { LogoutUseCase } from '../../../application/use-cases/auth/SessionUseCases';
import { Handlers, RoutesOf } from '../endpoint';
import { clearSessionCookie, setSessionCookie } from '../middlewares/session';
import { credentialsBody } from '../validators/schemas';

export interface AuthUseCases {
  register: RegisterUseCase;
  login: LoginUseCase;
  logout: LogoutUseCase;
}

/** Cadastro, login e logout. O token só viaja no cookie httpOnly (nunca no corpo). */
export function authController(a: AuthUseCases): Handlers<RoutesOf<'auth'>> {
  return {
    'auth.register': async (req, res) => {
      const session = await a.register.execute(credentialsBody.parse(req.body ?? {}));
      setSessionCookie(res, session.token, session.expiresAt);
      res.status(201).json({ user: session.user });
    },
    'auth.login': async (req, res) => {
      const session = await a.login.execute(credentialsBody.parse(req.body ?? {}));
      setSessionCookie(res, session.token, session.expiresAt);
      res.json({ user: session.user });
    },
    'auth.logout': async (_req, res) => {
      const token = res.locals.sessionToken;
      if (token) await a.logout.execute({ token });
      clearSessionCookie(res);
      res.status(204).end();
    },
    // Quem está logado (user: null para visitantes).
    'auth.me': (_req, res) => {
      res.json({ user: res.locals.user ?? null });
    },
  };
}
