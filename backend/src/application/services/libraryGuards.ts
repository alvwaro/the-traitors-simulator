import { Behavior, Cast, Character, Phrase, Publication } from '../../domain/entities';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { Repositories } from '../ports/IUnitOfWork';

export async function requireCharacter(repos: Repositories, id: string): Promise<Character> {
  const character = await repos.characters.findById(id);
  if (!character) throw new NotFoundError('Personagem', id);
  return character;
}

export async function requireCast(repos: Repositories, id: string): Promise<Cast> {
  const cast = await repos.casts.findById(id);
  if (!cast) throw new NotFoundError('Cast', id);
  return cast;
}

/** Os personagens existem e são da pessoa (ninguém monta elenco com personagens alheios). */
export async function ensureOwnedCharacters(repos: Repositories, ownerId: string, ids: readonly string[]): Promise<Character[]> {
  const found = await repos.characters.findByIds(ids);
  const missing = ids.find((id) => !found.some((c) => c.id === id && c.ownerId === ownerId));
  if (missing) throw new NotFoundError('Personagem', missing);
  return found;
}

/** O cast existe e é da pessoa. */
export async function requireOwnedCast(repos: Repositories, ownerId: string, id: string): Promise<Cast> {
  const cast = await requireCast(repos, id);
  if (cast.ownerId !== ownerId) throw new NotFoundError('Cast', id);
  return cast;
}

export function assertOwner(ownerId: string | null, userId: string): void {
  if (ownerId !== userId) throw new ForbiddenError('Isso pertence a outra pessoa');
}

export async function requirePhrase(repos: Repositories, id: string): Promise<Phrase> {
  const phrase = await repos.phrases.findById(id);
  if (!phrase) throw new NotFoundError('Frase', id);
  return phrase;
}

export async function requireBehavior(repos: Repositories, id: string): Promise<Behavior> {
  const behavior = await repos.behaviors.findById(id);
  if (!behavior) throw new NotFoundError('Comportamento', id);
  return behavior;
}

export async function ensureBehaviorsExist(repos: Repositories, ids: readonly string[]): Promise<void> {
  const found = await repos.behaviors.findByIds(ids);
  const missing = ids.find((id) => !found.some((b) => b.id === id));
  if (missing) throw new NotFoundError('Comportamento', missing);
}

export async function requirePublication(repos: Repositories, id: string): Promise<Publication> {
  const publication = await repos.publications.findById(id);
  if (!publication) throw new NotFoundError('Publicação', id);
  return publication;
}
