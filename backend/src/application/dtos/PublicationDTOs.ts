import { CharacterProps, PublicationArea, PublicationCountry, PublicationKind, PublicationProps } from '../../domain/entities';
import { Actor } from './AuthDTOs';
import { CastOutput } from './LibraryDTOs';

export interface PublishInput {
  actor: Actor;
  kind: PublicationKind;
  /** Id da temporada, do cast ou do personagem, conforme o tipo. */
  sourceId: string;
  description?: string | null;
  /** Donos escolhem entre as Temporadas Oficiais e a Área de Fãs (padrão para temporadas: oficial). */
  area?: PublicationArea;
  /** Temporada oficial: EUA ou Reino Unido (padrão: pelas missões da temporada). */
  country?: PublicationCountry;
}

export interface ListPublicationsInput {
  area?: PublicationArea;
  kind?: PublicationKind;
  publisherId?: string;
}

export interface PublicationIdInput {
  publicationId: string;
}

export interface PublicationActionInput extends PublicationIdInput {
  actor: Actor;
}

export interface CopyPublicationInput extends PublicationActionInput {
  /** Nome do cast criado (padrão: o nome publicado). */
  name?: string;
}

export interface CopySeasonInput extends PublicationActionInput {
  /** Nome da temporada criada (padrão: o nome publicado). */
  name?: string;
  /** Modo Jogador: o participante que a pessoa vai controlar. */
  human?: { name: string } | null;
}

export interface PublicationOutput extends PublicationProps {
  publisherName: string | null;
}

/** Resultado da cópia: um cast (de cast ou temporada) ou um personagem. */
export interface CopyPublicationOutput {
  kind: PublicationKind;
  cast: CastOutput | null;
  character: CharacterProps | null;
}
