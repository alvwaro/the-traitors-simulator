import type { PublicationKind } from '../../domain/models';

/** Quantos itens de cada seção aparecem na Área de Fãs (o resto fica na página da lista). */
export const HOME_LIMIT = 5;

const KIND_SLUG: Record<PublicationKind, string> = { SEASON: 'temporadas', CAST: 'casts', CHARACTER: 'personagens' };

export const KINDS: readonly PublicationKind[] = ['SEASON', 'CAST', 'CHARACTER'];

/** Página com a lista completa de uma seção da Área de Fãs (ex.: /fas/temporadas). */
export function listPath(kind: PublicationKind): string {
  return `/fas/${KIND_SLUG[kind]}`;
}

/** O tipo de publicação a partir do trecho da rota. */
export function kindFromSlug(slug: string | undefined): PublicationKind | undefined {
  return KINDS.find((k) => KIND_SLUG[k] === slug);
}

/** Títulos das seções da Área de Fãs. */
export const SECTION: Record<PublicationKind, { title: string; empty: string }> = {
  SEASON: { title: 'Temporadas dos fãs', empty: 'Nenhuma temporada publicada ainda' },
  CAST: { title: 'Casts dos fãs', empty: 'Nenhum cast publicado ainda' },
  CHARACTER: { title: 'Personagens dos fãs', empty: 'Nenhum personagem publicado ainda' },
};
