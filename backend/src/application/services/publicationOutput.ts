import { Publication } from '../../domain/entities';
import { PublicationOutput } from '../dtos/PublicationDTOs';
import { Repositories } from '../ports/IUnitOfWork';

/** Junta às publicações o nome de quem publicou e, nas temporadas, a situação atual (ao vivo). */
export async function toPublicationOutputs(repos: Repositories, publications: readonly Publication[]): Promise<PublicationOutput[]> {
  const publisherIds = [...new Set(publications.flatMap((p) => (p.publisherId ? [p.publisherId] : [])))];
  const names = await repos.publications.publisherNames(publisherIds);
  const seasonIds = publications.flatMap((p) => (p.seasonId ? [p.seasonId] : []));
  const seasons = new Map((await repos.seasons.findByIds(seasonIds)).map((s) => [s.id, s.toJSON()]));

  return publications.map((p) => {
    const props = p.toJSON();
    const season = props.seasonId ? seasons.get(props.seasonId) : undefined;
    return {
      ...props,
      // temporadas mostram o nome atual (pode ter sido renomeada depois de publicar)
      name: season?.name ?? props.name,
      publisherName: props.publisherId ? (names.get(props.publisherId) ?? null) : null,
      season: season
        ? { id: season.id, name: season.name, mode: season.mode, status: season.status, currentDay: season.currentDay, currentPhase: season.currentPhase }
        : null,
    };
  });
}
