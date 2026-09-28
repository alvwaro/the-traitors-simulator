import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { SaveSeasonAsCastInput } from '../../dtos/SeasonDTOs';
import { CastOutput } from '../../dtos/LibraryDTOs';
import { Cast, Character } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { requireSeason } from '../../services/gameGuards';
import { toCastOutput } from '../../services/castOutput';

/**
 * Salva o elenco da temporada como um cast reutilizável.
 * Jogadores sem personagem na biblioteca viram personagens novos
 * (ou são ligados a um personagem salvo com o mesmo nome).
 */
export class SaveSeasonAsCastUseCase implements IUseCase<SaveSeasonAsCastInput, CastOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: SaveSeasonAsCastInput): Promise<CastOutput> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      const players = await repos.players.findBySeason(season.id);
      if (players.length === 0) throw new DomainError('A temporada não tem jogadores');

      const characterIds: string[] = [];
      for (const player of players) {
        let character = player.characterId ? await repos.characters.findById(player.characterId) : null;
        if (character?.ownerId !== input.ownerId) character = await repos.characters.findByName(input.ownerId, player.name);
        if (!character) {
          character = Character.create({ name: player.name, ownerId: input.ownerId, imageUrl: player.imageUrl, behaviorIds: [...player.behaviorIds] });
          await repos.characters.create(character);
        }
        if (player.characterId !== character.id) {
          player.linkCharacter(character.id);
          await repos.players.update(player);
        }
        characterIds.push(character.id);
      }

      const cast = Cast.create({ name: input.name, ownerId: input.ownerId, description: input.description, characterIds });
      await repos.casts.create(cast);
      return toCastOutput(repos, cast);
    });
  }
}
