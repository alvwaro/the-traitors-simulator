import { IUseCase } from '../../contracts/IUseCase';
import { IPasswordHasher, ISessionTokens } from '../../ports/ISecurity';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CredentialsInput, SessionOutput } from '../../dtos/AuthDTOs';
import { assertValidPassword, User } from '../../../domain/entities';
import { ConflictError } from '../../../shared/errors/AppError';
import { openSession } from '../../services/sessions';

/** Cria a conta (sempre como fã) e já entra nela. */
export class RegisterUseCase implements IUseCase<CredentialsInput, SessionOutput> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ISessionTokens,
  ) {}

  async execute(input: CredentialsInput): Promise<SessionOutput> {
    assertValidPassword(input.password);
    const passwordHash = await this.hasher.hash(input.password);
    return this.uow.run(async (repos) => {
      const user = User.register({ username: input.username, passwordHash });
      if (await repos.users.findByUsername(user.username)) throw new ConflictError('Esse nome de usuário já está em uso');
      await repos.users.create(user);
      return openSession(repos, this.tokens, user);
    });
  }
}
