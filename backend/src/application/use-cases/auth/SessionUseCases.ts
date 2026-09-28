import { IUseCase } from '../../contracts/IUseCase';
import { ISessionTokens } from '../../ports/ISecurity';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { SessionTokenInput, UsernameInput } from '../../dtos/AuthDTOs';
import { PublicUser } from '../../../domain/entities';
import { NotFoundError } from '../../../shared/errors/AppError';

/** Quem é o dono do token do cookie (null se a sessão não existe ou expirou). */
export class GetSessionUserUseCase implements IUseCase<SessionTokenInput, PublicUser | null> {
  constructor(
    private readonly repos: Repositories,
    private readonly tokens: ISessionTokens,
  ) {}

  async execute(input: SessionTokenInput): Promise<PublicUser | null> {
    const user = await this.repos.sessions.findUser(this.tokens.hash(input.token));
    return user?.toPublic() ?? null;
  }
}

/** Encerra a sessão do cookie. */
export class LogoutUseCase implements IUseCase<SessionTokenInput, void> {
  constructor(
    private readonly repos: Repositories,
    private readonly tokens: ISessionTokens,
  ) {}

  async execute(input: SessionTokenInput): Promise<void> {
    await this.repos.sessions.delete(this.tokens.hash(input.token));
  }
}

/**
 * Torna uma conta dona do site (só pela linha de comando, nunca pela API).
 * O que existia antes das contas (sem dono) passa a ser dela.
 */
export class PromoteOwnerUseCase implements IUseCase<UsernameInput, PublicUser> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UsernameInput): Promise<PublicUser> {
    return this.uow.run(async (repos) => {
      const user = await repos.users.findByUsername(input.username);
      if (!user) throw new NotFoundError('Usuário', input.username);
      user.promoteToOwner();
      await repos.users.update(user);
      await repos.access.claimOrphans(user.id);
      return user.toPublic();
    });
  }
}
