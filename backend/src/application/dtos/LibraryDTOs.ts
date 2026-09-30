import { BehaviorEffects, CastProps, CharacterPhoto, CharacterPhotoInput, CharacterProps, ParticipantProfileInput } from '../../domain/entities';
import { PhrasePhase, PhraseTone } from '../../domain/enums';
import { CharacterStats } from '../../domain/repositories';
import { RelationshipProps } from '../../domain/simulation/RelationshipMatrix';

export interface CreateCharacterInput {
  name: string;
  /** Dono (quem está logado); vem da sessão, nunca do corpo da requisição. */
  ownerId: string;
  imageUrl?: string | null;
  behaviorIds?: string[];
  photos?: CharacterPhotoInput[];
  /** Cast em que o personagem já nasce (sem cast, fica em "Personagens sem cast"). */
  castId?: string | null;
}

export interface UpdateCharacterInput {
  characterId: string;
  name?: string;
  imageUrl?: string | null;
  behaviorIds?: string[];
  photos?: CharacterPhotoInput[];
  profile?: ParticipantProfileInput | null;
}

export interface WikiImportInput {
  characterId: string;
  url: string;
}

export interface CastMemberPhotoInput {
  castId: string;
  characterId: string;
  imageUrl: string | null;
}

export interface ParticipantInput {
  characterId: string;
  /** Quem está vendo: a página abre para quem criou o personagem e, se ele for de um dono do site, para todos. */
  ownerId: string;
}

/** Página de informações do participante. */
export interface ParticipantOutput {
  id: string;
  name: string;
  imageUrl: string | null;
  photos: CharacterPhoto[];
  profile: ParticipantProfileInput | null;
  /** Quem vê pode editar (é quem criou o personagem). */
  canEdit: boolean;
}

export interface CharacterIdInput {
  characterId: string;
}

export interface ListCharactersInput {
  search?: string;
  /** Dono (quem está logado); vem da sessão, nunca do corpo da requisição. */
  ownerId: string;
}

/** Listas da Minha Área. */
export interface OwnerInput {
  ownerId: string;
}

export interface CreateCastInput {
  name: string;
  /** Dono (quem está logado); vem da sessão, nunca do corpo da requisição. */
  ownerId: string;
  description?: string | null;
  imageUrl?: string | null;
  characterIds: string[];
}

export interface UpdateCastInput {
  castId: string;
  /** Dono (quem está logado); vem da sessão, nunca do corpo da requisição. */
  ownerId: string;
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  characterIds?: string[];
}

export interface CastIdInput {
  castId: string;
}

export interface CastOutput extends CastProps {
  characters: CharacterProps[];
}

export interface CreatePhraseInput {
  phase: PhrasePhase;
  tone?: PhraseTone;
  behaviorId?: string | null;
  text: string;
}

export interface UpdatePhraseInput {
  phraseId: string;
  phase?: PhrasePhase;
  tone?: PhraseTone;
  behaviorId?: string | null;
  text?: string;
}

export interface PhraseIdInput {
  phraseId: string;
}

export interface ListPhrasesInput {
  phase?: PhrasePhase;
}

export interface CreateBehaviorInput {
  name: string;
  description?: string | null;
  effects?: BehaviorEffects;
}

export interface UpdateBehaviorInput {
  behaviorId: string;
  name?: string;
  description?: string | null;
  effects?: BehaviorEffects;
}

export interface BehaviorIdInput {
  behaviorId: string;
}

export interface CastRelationshipsOutput {
  /** fromId/toId são ids de personagem. */
  relationships: RelationshipProps[];
}

export interface UpdateCastRelationshipInput {
  castId: string;
  fromId: string;
  toId: string;
  trust?: number;
  liking?: number;
  hatred?: number;
  allied?: boolean;
  /** Apaga o par: volta a ser sorteado nas temporadas. */
  clear?: boolean;
}

export interface CastRankingRow {
  position: number;
  character: CharacterProps;
  stats: CharacterStats;
  score: number;
}

export interface CastRankingOutput {
  rows: CastRankingRow[];
}
