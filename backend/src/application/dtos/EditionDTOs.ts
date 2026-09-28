import { MissionPool } from '../../domain/entities';

export interface GameEventOutput {
  name: string;
  description: string;
}

export interface EditionMissionOutput {
  key: string;
  origin: string;
  name: string;
  description: string;
  /** Valor máximo, na moeda da versão (dólar nos EUA, libra no Reino Unido). */
  prizeAvailable: number;
  /** Missão comum, a do Vidente ou a do último dia. */
  kind: 'REGULAR' | 'SEER' | 'FINALE';
}

export interface EditionOutput {
  pool: MissionPool;
  country: 'US' | 'UK' | 'MIX';
  season: number | null;
  label: string;
  summary: string;
  currency: 'USD' | 'GBP';
  twists: GameEventOutput[];
  missions: EditionMissionOutput[];
}

export interface EditionsOutput {
  /** Acontecimentos de qualquer temporada simulada. */
  commonEvents: GameEventOutput[];
  editions: EditionOutput[];
}
