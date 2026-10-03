import { Behavior, Cast, Character, PublishedBehavior, PublishedCharacter, PublishedSnapshot } from '../../domain/entities';
import { Repositories } from '../ports/IUnitOfWork';
import { CastMember } from './seasonSetup';

const CAST_NAME_MAX = 120;

type BehaviorResolver = (b: PublishedBehavior) => Promise<string>;

/** Id do comportamento com esse nome (são globais); cria com os mesmos efeitos se não existir. */
async function behaviorResolver(repos: Repositories): Promise<BehaviorResolver> {
  const byName = new Map((await repos.behaviors.findAll()).map((b) => [b.name.toLowerCase(), b.id]));
  return async (b) => {
    const key = b.name.toLowerCase();
    const found = byName.get(key);
    if (found) return found;
    const created = Behavior.create({ name: b.name, description: b.description, effects: b.effects });
    await repos.behaviors.create(created);
    byName.set(key, created.id);
    return created.id;
  };
}

/** Personagem com o mesmo nome na biblioteca da pessoa é reaproveitado; senão é criado. */
async function importCharacter(repos: Repositories, ownerId: string, c: PublishedCharacter, behaviorId: BehaviorResolver): Promise<Character> {
  const existing = await repos.characters.findByName(ownerId, c.name);
  if (existing) return existing;
  const behaviorIds: string[] = [];
  for (const b of c.behaviors) behaviorIds.push(await behaviorId(b));
  const character = Character.create({ name: c.name, ownerId, imageUrl: c.imageUrl, behaviorIds });
  await repos.characters.create(character);
  return character;
}

/** Traz os personagens da cópia para a biblioteca da pessoa; devolve o personagem de cada chave. */
export async function importCharacters(repos: Repositories, ownerId: string, snapshot: PublishedSnapshot): Promise<Map<string, Character>> {
  const behaviorId = await behaviorResolver(repos);
  const byKey = new Map<string, Character>();
  for (const c of snapshot.characters) byKey.set(c.key, await importCharacter(repos, ownerId, c, behaviorId));
  return byKey;
}

/**
 * O elenco de uma temporada publicada pronto para entrar numa temporada nova: cada participante como foi
 * publicado (nome, foto e comportamentos), ligado ao personagem que ele vira na biblioteca da pessoa.
 */
export async function importMembers(repos: Repositories, ownerId: string, snapshot: PublishedSnapshot): Promise<CastMember[]> {
  const behaviorId = await behaviorResolver(repos);
  const members: CastMember[] = [];
  for (const c of snapshot.characters) {
    const character = await importCharacter(repos, ownerId, c, behaviorId);
    const behaviorIds: string[] = [];
    for (const b of c.behaviors) behaviorIds.push(await behaviorId(b));
    members.push({ name: c.name, imageUrl: c.imageUrl, characterId: character.id, behaviorIds });
  }
  return members;
}

/** O nome do cast é único na biblioteca da pessoa: acrescenta (2), (3)... se já existir. */
async function freeCastName(repos: Repositories, ownerId: string, wanted: string): Promise<string> {
  const taken = new Set((await repos.casts.findAll(ownerId)).map((c) => c.name.toLowerCase()));
  const base = wanted.trim();
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, CAST_NAME_MAX - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Cria na biblioteca da pessoa um cast com o elenco e os relacionamentos da cópia. */
export async function importCast(
  repos: Repositories,
  ownerId: string,
  snapshot: PublishedSnapshot,
  details: { name: string; description: string | null; imageUrl: string | null },
): Promise<Cast> {
  const byKey = await importCharacters(repos, ownerId, snapshot);
  const cast = Cast.create({
    name: await freeCastName(repos, ownerId, details.name),
    ownerId,
    description: details.description,
    imageUrl: details.imageUrl,
    characterIds: snapshot.characters.map((c) => byKey.get(c.key)!.id),
  });
  await repos.casts.create(cast);

  for (const r of snapshot.relationships) {
    const fromId = byKey.get(r.fromKey)?.id;
    const toId = byKey.get(r.toKey)?.id;
    if (!fromId || !toId || fromId === toId) continue;
    await repos.casts.saveRelationship(cast.id, { fromId, toId, trust: r.trust, liking: r.liking, hatred: r.hatred, allied: r.allied });
  }
  return cast;
}
