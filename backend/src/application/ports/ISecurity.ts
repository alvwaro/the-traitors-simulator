/** Hash de senha (implementação com sal e função lenta, na infraestrutura). */
export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

/** Tokens de sessão: o valor vai para o cookie, só o hash é guardado no banco. */
export interface ISessionTokens {
  generate(): string;
  hash(token: string): string;
}
