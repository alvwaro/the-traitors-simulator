import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CreateSeasonInput, SeasonDetailsOutput } from '../../dtos/SeasonDTOs';
import { Player, Season } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { ensureRelationships } from '../../services/simulation';
import { ensureOwnedCharacters, requireOwnedCast } from '../../services/libraryGuards';

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

      const season = Season.create({ ...input, castId: input.castId ?? null });
      await repos.seasons.create(season);

      const players = characters.map((c) =>
        Player.create({ seasonId: season.id, name: c.name, imageUrl: cast ? cast.imageOf(c) : c.imageUrl, characterId: c.id, behaviorIds: c.behaviorIds }),
      );
      if (season.isPlayerMode()) {
        // O usuário entra no castelo como mais um participante: sem comportamentos, com relacionamentos.
        const name = input.human?.name?.trim();
        if (!name) throw new DomainError('No modo Jogador, informe o seu nome');
        if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new DomainError('Já existe um personagem com esse nome no elenco');
        players.push(Player.create({ seasonId: season.id, name, imageUrl: input.human?.imageUrl ?? null, isHuman: true }));
      }
      for (const player of players) await repos.players.create(player);
      if (season.isAutomatic()) await ensureRelationships(repos, season.id);

      return { ...season.toJSON(), prizePot: season.initialPrizePot, players: players.map((p) => p.toJSON()) };
    });
  }
}
