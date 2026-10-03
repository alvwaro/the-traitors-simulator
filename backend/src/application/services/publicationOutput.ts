import { Publication } from '../../domain/entities';
import { PublicationOutput } from '../dtos/PublicationDTOs';
import { Repositories } from '../ports/IUnitOfWork';

/** Junta às publicações o nome de quem publicou (o resto já está congelado nelas). */
export async function toPublicationOutputs(repos: Repositories, publications: readonly Publication[]): Promise<PublicationOutput[]> {
  const publisherIds = [...new Set(publications.flatMap((p) => (p.publisherId ? [p.publisherId] : [])))];
  const names = await repos.publications.publisherNames(publisherIds);
  return publications.map((p) => {
    const props = p.toJSON();
    return { ...props, publisherName: props.publisherId ? (names.get(props.publisherId) ?? null) : null };
  });
}
