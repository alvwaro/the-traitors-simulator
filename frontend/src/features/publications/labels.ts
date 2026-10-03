import type { Publication, PublicationArea, PublicationCountry, PublicationKind } from '../../domain/models';

/** Página de uma temporada publicada. */
export const publishedSeasonPath = (publicationId: string) => `/publicacoes/${publicationId}`;

export const playersText = (n: number) => (n === 1 ? '1 participante' : `${n} participantes`);

export const areaLabel: Record<PublicationArea, string> = {
  OFFICIAL: 'Temporadas Oficiais',
  FAN: 'Área de Fãs',
};

export const countryLabel: Record<PublicationCountry, string> = {
  US: 'Estados Unidos',
  UK: 'Reino Unido',
};

/** Onde a publicação está: a área e, nas Temporadas Oficiais, o país (ex.: "Temporadas Oficiais · Reino Unido"). */
export function placeLabel(p: Pick<Publication, 'area' | 'country'>): string {
  return p.country ? `${areaLabel[p.area]} · ${countryLabel[p.country]}` : areaLabel[p.area];
}

export const kindLabel: Record<PublicationKind, string> = {
  SEASON: 'temporada',
  CAST: 'cast',
  CHARACTER: 'personagem',
};

/** O que vai junto em cada tipo de publicação. */
export const kindExplanation: Record<PublicationKind, string> = {
  SEASON:
    'Vai uma cópia do elenco e das configurações (missões, prêmio, moeda...) como estão agora; o andamento do jogo não vai. Quem abrir pode copiar a temporada inteira ou só o elenco. Jogar a temporada depois não muda a publicação até você atualizá-la.',
  CAST: 'Vai uma cópia com personagens, fotos, comportamentos e relacionamentos (o ranking não). Editar o cast depois não muda a publicação até você atualizá-la.',
  CHARACTER: 'Vai uma cópia com nome, foto e comportamentos. Editar o personagem depois não muda a publicação até você atualizá-la.',
};
