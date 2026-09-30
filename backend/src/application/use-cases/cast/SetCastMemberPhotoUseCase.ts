import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CastMemberPhotoInput, CastOutput } from '../../dtos/LibraryDTOs';
import { toCastOutput } from '../../services/castOutput';
import { requireCast } from '../../services/libraryGuards';

/** Escolhe a foto de um personagem só neste cast (null volta à foto principal). */
export class SetCastMemberPhotoUseCase implements IUseCase<CastMemberPhotoInput, CastOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CastMemberPhotoInput): Promise<CastOutput> {
    return this.uow.run(async (repos) => {
      const cast = await requireCast(repos, input.castId);
      cast.setMemberImage(input.characterId, input.imageUrl);
      await repos.casts.update(cast);
      return toCastOutput(repos, cast);
    });
  }
}
