import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CreateSeasonInput, SeasonDetailsOutput } from '../../dtos/SeasonDTOs';
import { ensureOwnedCharacters, requireOwnedCast } from '../../services/libraryGuards';
import { setUpSeason } from '../../services/seasonSetup';

/** Cria a temporada; opcionalmente já monta o elenco a partir de um cast/personagens salvos. */
export class CreateSeasonUseCase implements IUseCase<CreateSeasonInput, SeasonDetailsOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CreateSeasonInput): Promise<SeasonDetailsOutput> {
    return this.uow.run(async (repos) => {
      const characterIds: string[] = [];
      const cast = input.castId ? await requireOwnedCast(repos, input.ownerId, input.castId) : null;
      if (cast) characterIds.push(...cast.characterIds);
      characterIds.push(...(input.characterIds ?? []));

      const uniqueIds = [...new Set(characterIds)];
      const characters = await ensureOwnedCharacters(repos, input.ownerId, uniqueIds);
      const members = characters.map((c) => ({ name: c.name, imageUrl: cast ? cast.imageOf(c) : c.imageUrl, characterId: c.id, behaviorIds: c.behaviorIds }));
      return setUpSeason(repos, input, members);
    });
  }
}
