import { CharacterProps, PublicationArea, PublicationKind, PublicationProps } from '../../domain/entities';
import { GamePhase, SeasonMode, SeasonStatus } from '../../domain/enums';
import { Actor } from './AuthDTOs';
import { CastOutput } from './LibraryDTOs';

export interface PublishInput {
  actor: Actor;
  kind: PublicationKind;
  /** Id da temporada, do cast ou do personagem, conforme o tipo. */
  sourceId: string;
  description?: string | null;
}

export interface ListPublicationsInput {
  area?: PublicationArea;
  kind?: PublicationKind;
  publisherId?: string;
}

export interface PublicationActionInput {
  actor: Actor;
  publicationId: string;
}

export interface CopyPublicationInput extends PublicationActionInput {
  /** Nome do cast criado (padrão: o nome publicado). */
  name?: string;
}

/** Situação atual de uma temporada publicada (lida ao vivo). */
export interface PublishedSeasonSummary {
  id: string;
  name: string;
  mode: SeasonMode;
  status: SeasonStatus;
  currentDay: number | null;
  currentPhase: GamePhase | null;
}

export interface PublicationOutput extends PublicationProps {
  publisherName: string | null;
  season: PublishedSeasonSummary | null;
}

/** Resultado da cópia: um cast (de cast ou temporada) ou um personagem. */
export interface CopyPublicationOutput {
  kind: PublicationKind;
  cast: CastOutput | null;
  character: CharacterProps | null;
}
