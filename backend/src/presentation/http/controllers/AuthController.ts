import { Request, Response } from 'express';
import { LoginUseCase } from '../../../application/use-cases/auth/LoginUseCase';
import { RegisterUseCase } from '../../../application/use-cases/auth/RegisterUseCase';
import { LogoutUseCase } from '../../../application/use-cases/auth/SessionUseCases';
import { credentialsBody } from '../validators/schemas';
import { clearSessionCookie, setSessionCookie } from '../middlewares/session';

/** Cadastro, login e logout. O token só viaja no cookie httpOnly. */
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly logoutUser: LogoutUseCase,
  ) {}

  register = async (req: Request, res: Response) => {
    const session = await this.registerUser.execute(credentialsBody.parse(req.body));
    setSessionCookie(res, session.token, session.expiresAt);
    res.status(201).json({ user: session.user });
  };

  login = async (req: Request, res: Response) => {
    const session = await this.loginUser.execute(credentialsBody.parse(req.body));
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ user: session.user });
  };

  logout = async (_req: Request, res: Response) => {
    const token = res.locals.sessionToken;
    if (token) await this.logoutUser.execute({ token });
    clearSessionCookie(res);
    res.status(204).end();
  };

  /** Quem está logado (user: null para visitantes). */
  me = (_req: Request, res: Response) => {
    res.json({ user: res.locals.user ?? null });
  };
}
