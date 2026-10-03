import { SeasonMode } from '../enums';
import { BehaviorEffects } from './Behavior';
import { MissionPool } from './Season';

/** Comportamento guardado pelo conteúdo: quem copia recebe o mesmo efeito mesmo sem ter a tag. */
export interface PublishedBehavior {
  name: string;
  description: string | null;
  effects: BehaviorEffects;
}

export interface PublishedCharacter {
  /** Identifica o personagem dentro da publicação (usado nos relacionamentos). */
  key: string;
  name: string;
  imageUrl: string | null;
  behaviors: PublishedBehavior[];
  /** Temporadas: o personagem de origem na biblioteca de quem publicou (a página do participante, nas oficiais). */
  characterId?: string | null;
}

export interface PublishedRelationship {
  fromKey: string;
  toKey: string;
  trust: number;
  liking: number;
  hatred: number;
  allied: boolean;
}

/** Cópia congelada de um elenco (um cast inteiro, um personagem só ou os participantes de uma temporada). */
export interface PublishedSnapshot {
  characters: PublishedCharacter[];
  relationships: PublishedRelationship[];
}

/**
 * As configurações de uma temporada publicada, do jeito que estavam ao publicar: quem copia a temporada
 * recebe as mesmas. O andamento do jogo não vai junto.
 */
export interface PublishedSeason {
  mode: SeasonMode;
  chaos: number;
  /** A temporada do programa que ela reproduz (missões e reviravoltas). */
  missionPool: MissionPool;
  interactionLimit: number;
  withdrawals: boolean;
  hiddenShieldChance: number;
  currency: string;
  initialPrizePot: number;
  maxPrizePot: number | null;
  drama: boolean;
  showPhrases: boolean;
}
