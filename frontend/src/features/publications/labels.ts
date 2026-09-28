import type { PublicationArea, PublicationKind } from '../../domain/models';

export const areaLabel: Record<PublicationArea, string> = {
  OFFICIAL: 'Castelo · Área Oficial',
  FAN: 'Área de Fãs',
};

export const kindLabel: Record<PublicationKind, string> = {
  SEASON: 'temporada',
  CAST: 'cast',
  CHARACTER: 'personagem',
};

/** O que vai junto em cada tipo de publicação. */
export const kindExplanation: Record<PublicationKind, string> = {
  SEASON: 'Qualquer pessoa poderá assistir à temporada (sem alterar nada) e copiar o elenco para jogar a própria versão. Ela continua sendo sua e segue atualizando conforme você joga.',
  CAST: 'Vai uma cópia com personagens, fotos, comportamentos e relacionamentos (o ranking não). Editar o cast depois não muda a publicação até você atualizá-la.',
  CHARACTER: 'Vai uma cópia com nome, foto e comportamentos. Editar o personagem depois não muda a publicação até você atualizá-la.',
};
