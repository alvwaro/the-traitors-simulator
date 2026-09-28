import { PlayerRole } from '../../domain/enums';

/**
 * Duas formas de adicionar:
 *  - characterId: usa um personagem salvo (name/imageUrl sobrescrevem só nesta temporada);
 *  - name (+ imageUrl): jogador novo; com saveToLibrary também salva na biblioteca.
 */
export interface AddPlayerInput {
  seasonId: string;
  /** Dono (quem está logado); vem da sessão, nunca do corpo da requisição. */
  ownerId: string;
  characterId?: string | null;
  name?: string;
  imageUrl?: string | null;
  role?: PlayerRole;
  saveToLibrary?: boolean;
  /** Tags do jogador novo (com characterId, valem as do personagem). */
  behaviorIds?: string[];
}

export interface UpdatePlayerInput {
  seasonId: string;
  playerId: string;
  name?: string;
  imageUrl?: string | null;
  role?: PlayerRole; // só antes do início
  behaviorIds?: string[];
}

export interface PlayerRefInput {
  seasonId: string;
  playerId: string;
}
