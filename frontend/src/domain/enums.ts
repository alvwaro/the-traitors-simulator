// O vocabulário do jogo vem do kernel compartilhado: é o mesmo do backend (e do banco).
export {
  EndgameChoice,
  GamePhase,
  MurderOutcome,
  PhrasePhase,
  PhraseTone,
  PlayerRole,
  PlayerStatus,
  PrizeTransactionType,
  RecruitmentOutcome,
  RoundTableKind,
  SeasonMode,
  SeasonStatus,
  SimulationEventKind,
  SUBJECT_ACTIONS,
  TOWER_ACTIONS,
} from '@traitors/shared';
/** O que o jogador pode fazer ao clicar na foto de alguém (modo Jogador). */
export type { HumanAction } from '@traitors/shared';
