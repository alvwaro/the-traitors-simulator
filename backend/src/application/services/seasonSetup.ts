import { Player, Season } from '../../domain/entities';
import { DomainError } from '../../domain/errors/DomainError';
import { CreateSeasonInput, SeasonDetailsOutput } from '../dtos/SeasonDTOs';
import { Repositories } from '../ports/IUnitOfWork';
import { ensureRelationships } from './simulation';

/** Um participante que entra no elenco, ligado a um personagem da biblioteca de quem cria a temporada. */
export interface CastMember {
  name: string;
  imageUrl: string | null;
  characterId: string;
  behaviorIds: readonly string[];
}

/**
 * Cria a temporada (em preparação) com o elenco. No modo Jogador o usuário entra como mais um participante:
 * sem comportamentos, com relacionamentos. Nas simuladas, os relacionamentos já nascem prontos.
 */
export async function setUpSeason(repos: Repositories, input: Omit<CreateSeasonInput, 'characterIds'>, members: readonly CastMember[]): Promise<SeasonDetailsOutput> {
  const season = Season.create({ ...input, castId: input.castId ?? null });
  await repos.seasons.create(season);

  const players = members.map((m) => Player.create({ seasonId: season.id, ...m }));
  if (season.isPlayerMode()) {
    const name = input.human?.name?.trim();
    if (!name) throw new DomainError('No modo Jogador, informe o seu nome');
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new DomainError('Já existe um personagem com esse nome no elenco');
    players.push(Player.create({ seasonId: season.id, name, imageUrl: input.human?.imageUrl ?? null, isHuman: true }));
  }
  for (const player of players) await repos.players.create(player);
  if (season.isAutomatic()) await ensureRelationships(repos, season.id);

  return { ...season.toJSON(), prizePot: season.initialPrizePot, players: players.map((p) => p.toJSON()) };
}
