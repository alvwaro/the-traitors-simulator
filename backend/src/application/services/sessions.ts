import { User } from '../../domain/entities';
import { SessionOutput } from '../dtos/AuthDTOs';
import { ISessionTokens } from '../ports/ISecurity';
import { Repositories } from '../ports/IUnitOfWork';

/** Quanto tempo uma sessão dura sem novo login. */
export const SESSION_DAYS = 30;

/**
 * Abre uma sessão para o usuário e devolve o token (só o hash vai para o banco).
 * As sessões vencidas são apagadas por um trabalho periódico do worker (ver jobs/maintenance).
 */
export async function openSession(repos: Repositories, tokens: ISessionTokens, user: User): Promise<SessionOutput> {
  const token = tokens.generate();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await repos.sessions.create(tokens.hash(token), user.id, expiresAt);
  return { user: user.toPublic(), token, expiresAt };
}
