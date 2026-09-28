import { Cast, Character, PublishedBehavior, PublishedSnapshot, Season } from '../../domain/entities';
import { Repositories } from '../ports/IUnitOfWork';

/** Comportamentos pelo conteúdo, por id (os apagados somem da cópia). */
async function behaviorsById(repos: Repositories, ids: readonly string[]): Promise<Map<string, PublishedBehavior>> {
  const behaviors = await repos.behaviors.findByIds([...new Set(ids)]);
  return new Map(behaviors.map((b) => [b.id, { name: b.name, description: b.toJSON().description, effects: b.effects }]));
}

function pick(behaviors: Map<string, PublishedBehavior>, ids: readonly string[]): PublishedBehavior[] {
  return ids.flatMap((id) => behaviors.get(id) ?? []);
}

/** Congela o cast: personagens (na ordem), fotos, comportamentos e os relacionamentos entre membros. */
export async function castSnapshot(repos: Repositories, cast: Cast): Promise<PublishedSnapshot> {
  const characters = await repos.characters.findByIds(cast.characterIds);
  const behaviors = await behaviorsById(repos, characters.flatMap((c) => c.behaviorIds));
  const members = new Set(characters.map((c) => c.id));
  const relationships = await repos.casts.findRelationships(cast.id);
  return {
    characters: characters.map((c) => ({ key: c.id, name: c.name, imageUrl: c.imageUrl, behaviors: pick(behaviors, c.behaviorIds) })),
    relationships: relationships
      .filter((r) => members.has(r.fromId) && members.has(r.toId))
      .map((r) => ({ fromKey: r.fromId, toKey: r.toId, trust: r.trust, liking: r.liking, hatred: r.hatred, allied: r.allied })),
  };
}

export async function characterSnapshot(repos: Repositories, character: Character): Promise<PublishedSnapshot> {
  const behaviors = await behaviorsById(repos, character.behaviorIds);
  return {
    characters: [{ key: character.id, name: character.name, imageUrl: character.imageUrl, behaviors: pick(behaviors, character.behaviorIds) }],
    relationships: [],
  };
}

/**
 * Elenco de uma temporada para copiar e jogar: os participantes (menos quem jogava no modo Jogador),
 * sem os relacionamentos, que mudaram ao longo do jogo.
 */
export async function seasonSnapshot(repos: Repositories, season: Season): Promise<PublishedSnapshot> {
  const players = (await repos.players.findBySeason(season.id)).filter((p) => !p.isHuman);
  const behaviors = await behaviorsById(repos, players.flatMap((p) => p.behaviorIds));
  return {
    characters: players.map((p) => ({ key: p.id, name: p.name, imageUrl: p.imageUrl, behaviors: pick(behaviors, p.behaviorIds) })),
    relationships: [],
  };
}
