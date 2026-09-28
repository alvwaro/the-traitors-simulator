import { PublicUser } from '../../domain/entities';

export interface CredentialsInput {
  username: string;
  password: string;
}

/** Sessão criada: o token vai para o cookie (nunca no corpo da resposta). */
export interface SessionOutput {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

export interface SessionTokenInput {
  token: string;
}

export interface UsernameInput {
  username: string;
}

/** Quem está fazendo a requisição (vem da sessão, nunca do corpo). */
export interface Actor {
  id: string;
  role: PublicUser['role'];
}
