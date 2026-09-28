import { useCallback } from 'react';
import { useServices } from '../../app/services';
import type { Publication, PublicationKind } from '../../domain/models';
import { useResource } from '../../hooks/useResource';

/** Id da origem (temporada, cast ou personagem) de uma publicação. */
export function sourceIdOf(p: Publication): string | null {
  switch (p.kind) {
    case 'SEASON':
      return p.seasonId;
    case 'CAST':
      return p.castId;
    case 'CHARACTER':
      return p.characterId;
  }
}

/** As publicações de quem está logado, para saber o que já está numa vitrine. */
export function useMyPublications() {
  const { publications } = useServices();
  const mine = useResource(() => publications.list({ mine: true }), []);
  const list = mine.data;

  const find = useCallback(
    (kind: PublicationKind, sourceId: string) => list?.find((p) => p.kind === kind && sourceIdOf(p) === sourceId) ?? null,
    [list],
  );

  return { list: list ?? [], loaded: !!list, error: mine.error, find, reload: mine.reload };
}
