import { IUseCase } from '../../contracts/IUseCase';
import { IPasswordHasher, ISessionTokens } from '../../ports/ISecurity';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CredentialsInput, SessionOutput } from '../../dtos/AuthDTOs';
import { UnauthorizedError } from '../../../shared/errors/AppError';
import { openSession } from '../../services/sessions';

/** Hash de uma senha qualquer: usuário inexistente leva o mesmo tempo que senha errada. */
const DECOY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

/** Confere usuário e senha; a mesma mensagem para os dois erros (não revela quem existe). */
export class LoginUseCase implements IUseCase<CredentialsInput, SessionOutput> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ISessionTokens,
  ) {}

  execute(input: CredentialsInput): Promise<SessionOutput> {
    return this.uow.run(async (repos) => {
      const user = await repos.users.findByUsername(input.username);
      const valid = await this.hasher.verify(input.password, user?.passwordHash ?? DECOY_HASH);
      if (!user || !valid) throw new UnauthorizedError('Usuário ou senha incorretos');
      return openSession(repos, this.tokens, user);
    });
  }
}
