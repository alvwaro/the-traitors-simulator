import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { AddPlayerInput } from '../../dtos/PlayerDTOs';
import { Character, Player, PlayerProps } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { requireSeason } from '../../services/gameGuards';
import { ensureBehaviorsExist, ensureOwnedCharacters } from '../../services/libraryGuards';
import { ensureRelationships } from '../../services/simulation';

export class AddPlayerUseCase implements IUseCase<AddPlayerInput, PlayerProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: AddPlayerInput): Promise<PlayerProps> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      if (!season.isInSetup()) throw new DomainError('Jogadores só podem ser adicionados antes do início da temporada');

      const character = await this.resolveCharacter(repos, input);
      const player = Player.create({
        seasonId: season.id,
        name: input.name ?? character?.name ?? '',
        imageUrl: input.imageUrl !== undefined ? input.imageUrl : character?.imageUrl,
        role: input.role,
        characterId: character?.id ?? null,
        behaviorIds: character ? character.behaviorIds : input.behaviorIds,
      });
      await ensureBehaviorsExist(repos, player.behaviorIds);
      await repos.players.create(player);
      if (season.isAutomatic()) await ensureRelationships(repos, season.id);
      return player.toJSON();
    });
  }

  private async resolveCharacter(repos: Repositories, input: AddPlayerInput): Promise<Character | null> {
    if (input.characterId) {
      const [character] = await ensureOwnedCharacters(repos, input.ownerId, [input.characterId]);
      return character;
    }
    if (!input.name?.trim()) throw new DomainError('Informe o nome do jogador ou um personagem salvo');
    if (!input.saveToLibrary) return null;

    // Reaproveita o personagem salvo com o mesmo nome, se existir.
    const existing = await repos.characters.findByName(input.ownerId, input.name);
    if (existing) return existing;
    const character = Character.create({ name: input.name, ownerId: input.ownerId, imageUrl: input.imageUrl, behaviorIds: input.behaviorIds });
    await repos.characters.create(character);
    return character;
  }
}
