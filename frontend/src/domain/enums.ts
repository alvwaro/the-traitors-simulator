// Espelham os enums do backend.

export const SeasonStatus = {
  SETUP: 'SETUP',
  IN_PROGRESS: 'IN_PROGRESS',
  ENDGAME: 'ENDGAME',
  FINISHED: 'FINISHED',
} as const;
export type SeasonStatus = (typeof SeasonStatus)[keyof typeof SeasonStatus];

export const GamePhase = {
  ARRIVAL: 'ARRIVAL',
  TRAITOR_SELECTION: 'TRAITOR_SELECTION',
  BREAKFAST: 'BREAKFAST',
  MISSION: 'MISSION',
  ROUND_TABLE: 'ROUND_TABLE',
  TRAITORS_MEETING: 'TRAITORS_MEETING',
  ENDGAME_ROUND_TABLE: 'ENDGAME_ROUND_TABLE',
  FINALE: 'FINALE',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export const PlayerRole = { FAITHFUL: 'FAITHFUL', TRAITOR: 'TRAITOR' } as const;
export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole];

export const PlayerStatus = {
  ACTIVE: 'ACTIVE',
  BANISHED: 'BANISHED',
  MURDERED: 'MURDERED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];

export const EndgameChoice = { END_GAME: 'END_GAME', BANISH_AGAIN: 'BANISH_AGAIN' } as const;
export type EndgameChoice = (typeof EndgameChoice)[keyof typeof EndgameChoice];

export const MurderOutcome = { SUCCESS: 'SUCCESS', BLOCKED_BY_SHIELD: 'BLOCKED_BY_SHIELD' } as const;
export type MurderOutcome = (typeof MurderOutcome)[keyof typeof MurderOutcome];

export const RecruitmentOutcome = { ACCEPTED: 'ACCEPTED', DECLINED: 'DECLINED' } as const;
export type RecruitmentOutcome = (typeof RecruitmentOutcome)[keyof typeof RecruitmentOutcome];

export const RoundTableKind = { REGULAR: 'REGULAR', ENDGAME: 'ENDGAME' } as const;
export type RoundTableKind = (typeof RoundTableKind)[keyof typeof RoundTableKind];

export const PrizeTransactionType = { MISSION: 'MISSION', PENALTY: 'PENALTY', ADJUSTMENT: 'ADJUSTMENT' } as const;
export type PrizeTransactionType = (typeof PrizeTransactionType)[keyof typeof PrizeTransactionType];

export const PhrasePhase = {
  ARRIVAL: 'ARRIVAL',
  BREAKFAST: 'BREAKFAST',
  MISSION: 'MISSION',
  ROUND_TABLE: 'ROUND_TABLE',
  TRAITORS_MEETING: 'TRAITORS_MEETING',
  ENDGAME: 'ENDGAME',
} as const;
export type PhrasePhase = (typeof PhrasePhase)[keyof typeof PhrasePhase];

export const PhraseTone = {
  NEUTRAL: 'NEUTRAL',
  FRIENDLY: 'FRIENDLY',
  ALLIANCE: 'ALLIANCE',
  SUSPICION: 'SUSPICION',
  ACCUSATION: 'ACCUSATION',
  CONFLICT: 'CONFLICT',
  DEFENSE: 'DEFENSE',
  STRATEGY: 'STRATEGY',
  EMOTION: 'EMOTION',
  HUMOR: 'HUMOR',
} as const;
export type PhraseTone = (typeof PhraseTone)[keyof typeof PhraseTone];

export const SeasonMode = { MANUAL: 'MANUAL', AUTOMATIC: 'AUTOMATIC', PLAYER: 'PLAYER' } as const;
export type SeasonMode = (typeof SeasonMode)[keyof typeof SeasonMode];

export const SimulationEventKind = {
  NARRATION: 'NARRATION',
  DIALOGUE: 'DIALOGUE',
  MISSION_STEP: 'MISSION_STEP',
  ALLIANCE: 'ALLIANCE',
  BETRAYAL: 'BETRAYAL',
  VOTE: 'VOTE',
  REVEAL: 'REVEAL',
  MURDER: 'MURDER',
  RECRUITMENT: 'RECRUITMENT',
  SHIELD: 'SHIELD',
  SECRET: 'SECRET',
  PLAYER: 'PLAYER',
  REACTION: 'REACTION',
  APPROACH: 'APPROACH',
} as const;
export type SimulationEventKind = (typeof SimulationEventKind)[keyof typeof SimulationEventKind];

/** O que o jogador pode fazer ao clicar na foto de alguém (modo Jogador). */
export const HumanAction = {
  ACCUSE: 'ACCUSE',
  SUSPECT: 'SUSPECT',
  DEFEND: 'DEFEND',
  TRUST: 'TRUST',
  PRAISE: 'PRAISE',
  JOKE: 'JOKE',
  INSULT: 'INSULT',
  ALLIANCE: 'ALLIANCE',
  ASK: 'ASK',
  ASK_ABOUT: 'ASK_ABOUT',
  PERSUADE_GUILTY: 'PERSUADE_GUILTY',
  PERSUADE_INNOCENT: 'PERSUADE_INNOCENT',
  TOWER_ASK: 'TOWER_ASK',
  TOWER_KILL: 'TOWER_KILL',
  TOWER_SPARE: 'TOWER_SPARE',
  TOWER_RECRUIT: 'TOWER_RECRUIT',
} as const;
export type HumanAction = (typeof HumanAction)[keyof typeof HumanAction];

/** Conversas que falam de uma terceira pessoa. */
export const SUBJECT_ACTIONS: HumanAction[] = ['ASK_ABOUT', 'PERSUADE_GUILTY', 'PERSUADE_INNOCENT', 'TOWER_KILL', 'TOWER_SPARE', 'TOWER_RECRUIT'];
/** Conversas da torre (debate com os outros traidores). */
export const TOWER_ACTIONS: HumanAction[] = ['TOWER_ASK', 'TOWER_KILL', 'TOWER_SPARE', 'TOWER_RECRUIT'];
