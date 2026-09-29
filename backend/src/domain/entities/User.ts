import { randomUUID } from 'node:crypto';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_PATTERN, UserRole } from '@traitors/shared';
import { DomainError } from '../errors/DomainError';

/** OWNER: dono do site (publica na Área Oficial e modera). FAN: qualquer pessoa cadastrada. */
export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_PATTERN, UserRole } from '@traitors/shared';

export interface UserProps {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

/** O que pode sair do servidor sobre uma conta (nunca o hash da senha). */
export interface PublicUser {
  id: string;
  username: string;
  role: UserRole;
}

export class User {
  constructor(private readonly props: UserProps) {}

  static register(input: { username: string; passwordHash: string }): User {
    const username = input.username.trim();
    if (!USERNAME_PATTERN.test(username)) {
      throw new DomainError('O usuário deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado');
    }
    return new User({ id: randomUUID(), username, passwordHash: input.passwordHash, role: UserRole.FAN, createdAt: new Date() });
  }

  get id(): string { return this.props.id; }
  get username(): string { return this.props.username; }
  get passwordHash(): string { return this.props.passwordHash; }
  get role(): UserRole { return this.props.role; }

  isOwner(): boolean {
    return this.props.role === UserRole.OWNER;
  }

  promoteToOwner(): void {
    this.props.role = UserRole.OWNER;
  }

  toPublic(): PublicUser {
    return { id: this.props.id, username: this.props.username, role: this.props.role };
  }

  toJSON(): UserProps { return { ...this.props }; }
}

/** Regra da senha (validada antes de gerar o hash). */
export function assertValidPassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new DomainError(`A senha deve ter de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres`);
  }
}
