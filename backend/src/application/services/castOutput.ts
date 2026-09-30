import { Cast } from '../../domain/entities';
import { CastOutput } from '../dtos/LibraryDTOs';
import { Repositories } from '../ports/IUnitOfWork';

export async function toCastOutput(repos: Repositories, cast: Cast): Promise<CastOutput> {
  const characters = await repos.characters.findByIds(cast.characterIds);
  // Cada personagem aparece com a foto escolhida para este cast.
  return { ...cast.toJSON(), characters: characters.map((c) => ({ ...c.toJSON(), imageUrl: cast.imageOf(c) })) };
}
