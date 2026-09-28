import { User } from '../entities';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  /** Sem diferenciar maiúsculas de minúsculas. */
  findByUsername(username: string): Promise<User | null>;
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
}

/** Sessões de login. Só o hash do token é guardado. */
export interface ISessionRepository {
  create(tokenHash: string, userId: string, expiresAt: Date): Promise<void>;
  /** Dono de uma sessão ainda válida. */
  findUser(tokenHash: string): Promise<User | null>;
  delete(tokenHash: string): Promise<void>;
  deleteExpired(): Promise<void>;
}
