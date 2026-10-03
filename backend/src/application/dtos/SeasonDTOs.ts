import { MissionPool, PlayerProps, PrizeTransactionProps, SeasonProps } from '../../domain/entities';
import { PrizeTransactionType, SeasonMode } from '../../domain/enums';

export interface CreateSeasonInput {
  name: string;
  /** Dono (quem está logado); vem da sessão, nunca do corpo da requisição. */
  ownerId: string;
  mode?: SeasonMode;
  /** Loucura, de 0 a 100. */
  chaos?: number;
  missionPool?: MissionPool;
  /** Modo Jogador: conversas por momento. */
  interactionLimit?: number;
  /** A simulação pode tirar alguém do castelo por motivos pessoais. */
  withdrawals?: boolean;
  /** Chance (0 a 100) de os escudos de uma missão ficarem em segredo. */
  hiddenShieldChance?: number;
  /** Modo Jogador: revelar os acontecimentos um de cada vez. */
  drama?: boolean;
  /** Mostrar as falas da biblioteca de frases (desligado: foco nas eliminações). */
  showPhrases?: boolean;
  /** Modo Jogador: o participante que o usuário controla. */
  human?: { name: string; imageUrl?: string | null } | null;
  currency?: string;
  initialPrizePot?: number;
  maxPrizePot?: number | null;
  /** Preenche o elenco com os personagens de um cast salvo. */
  castId?: string | null;
  /** Personagens salvos avulsos (somados ao cast, se houver). */
  characterIds?: string[];
}

export interface UpdateSeasonInput {
  seasonId: string;
  name?: string;
  mode?: SeasonMode;
  chaos?: number;
  missionPool?: MissionPool;
  interactionLimit?: number;
  withdrawals?: boolean;
  hiddenShieldChance?: number;
  drama?: boolean;
  showPhrases?: boolean;
  currency?: string;
  initialPrizePot?: number;
  maxPrizePot?: number | null;
}

export interface SeasonIdInput {
  seasonId: string;
}

export interface SeasonDetailsOutput extends SeasonProps {
  prizePot: number;
  players: PlayerProps[];
}

export interface SaveSeasonAsCastInput {
  seasonId: string;
  /** Dono (quem está logado); vem da sessão, nunca do corpo da requisição. */
  ownerId: string;
  name: string;
  description?: string | null;
}

export interface PrizeAdjustmentInput {
  seasonId: string;
  type: typeof PrizeTransactionType.PENALTY | typeof PrizeTransactionType.ADJUSTMENT;
  /** PENALTY: valor positivo que será descontado. ADJUSTMENT: positivo ou negativo. */
  amount: number;
  description?: string | null;
}

export interface PrizeAdjustmentOutput {
  transaction: PrizeTransactionProps;
  prizePot: number;
}
