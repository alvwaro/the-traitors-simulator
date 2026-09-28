import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CastOutput, CreateCastInput } from '../../dtos/LibraryDTOs';
import { Cast } from '../../../domain/entities';
import { toCastOutput } from '../../services/castOutput';
import { ensureOwnedCharacters } from '../../services/libraryGuards';

export class CreateCastUseCase implements IUseCase<CreateCastInput, CastOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CreateCastInput): Promise<CastOutput> {
    return this.uow.run(async (repos) => {
      const cast = Cast.create(input);
      await ensureOwnedCharacters(repos, input.ownerId, cast.characterIds);
      await repos.casts.create(cast);
      return toCastOutput(repos, cast);
    });
  }
}
