import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CastOutput, UpdateCastInput } from '../../dtos/LibraryDTOs';
import { toCastOutput } from '../../services/castOutput';
import { ensureOwnedCharacters, requireOwnedCast } from '../../services/libraryGuards';

/** characterIds, se informado, substitui todo o elenco do cast (na ordem dada). */
export class UpdateCastUseCase implements IUseCase<UpdateCastInput, CastOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdateCastInput): Promise<CastOutput> {
    return this.uow.run(async (repos) => {
      const cast = await requireOwnedCast(repos, input.ownerId, input.castId);
      if (input.name !== undefined) cast.rename(input.name);
      if (input.description !== undefined) cast.describe(input.description);
      if (input.imageUrl !== undefined) cast.changeImage(input.imageUrl);
      if (input.characterIds !== undefined) {
        cast.setMembers(input.characterIds);
        await ensureOwnedCharacters(repos, input.ownerId, cast.characterIds);
      }
      await repos.casts.update(cast);
      return toCastOutput(repos, cast);
    });
  }
}
