import type { PublicationArea, PublicationKind } from '../../domain/models';

/** Quantos itens de cada seção aparecem na página inicial (o resto fica na página da lista). */
export const HOME_LIMIT = 5;

const AREA_SLUG: Record<PublicationArea, string> = { OFFICIAL: 'oficial', FAN: 'fas' };
const KIND_SLUG: Record<PublicationKind, string> = { SEASON: 'temporadas', CAST: 'casts', CHARACTER: 'personagens' };

export const KINDS: readonly PublicationKind[] = ['SEASON', 'CAST', 'CHARACTER'];

/** Página com a lista completa de uma seção (ex.: /oficial/temporadas). */
export function listPath(area: PublicationArea, kind: PublicationKind): string {
  return `/${AREA_SLUG[area]}/${KIND_SLUG[kind]}`;
}

/** O tipo de publicação a partir do trecho da rota. */
export function kindFromSlug(slug: string | undefined): PublicationKind | undefined {
  return KINDS.find((k) => KIND_SLUG[k] === slug);
}

/**
 * Títulos das seções. Na área oficial ficam as temporadas de verdade de The Traitors,
 * com os participantes reais, montadas pelos donos do site.
 */
export const SECTION: Record<PublicationArea, Record<PublicationKind, { title: string; empty: string }>> = {
  OFFICIAL: {
    SEASON: { title: 'Temporadas oficiais', empty: 'Nenhuma temporada oficial publicada ainda' },
    CAST: { title: 'Elencos oficiais', empty: 'Nenhum elenco oficial publicado ainda' },
    CHARACTER: { title: 'Participantes reais', empty: 'Nenhum participante publicado ainda' },
  },
  FAN: {
    SEASON: { title: 'Temporadas dos fãs', empty: 'Nenhuma temporada publicada ainda' },
    CAST: { title: 'Casts dos fãs', empty: 'Nenhum cast publicado ainda' },
    CHARACTER: { title: 'Personagens dos fãs', empty: 'Nenhum personagem publicado ainda' },
  },
};
