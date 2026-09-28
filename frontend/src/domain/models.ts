import type {
  EndgameChoice,
  GamePhase,
  HumanAction,
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
} from './enums';
import type { BehaviorEffectKey } from './behaviors';

// Formatos devolvidos pela API (datas chegam como string ISO).

export interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
  behaviorIds: string[];
  createdAt: string;
}

/** Efeitos de um comportamento: modificadores de -50 a +50 (ver domain/behaviors.ts). */
export type BehaviorEffects = Partial<Record<BehaviorEffectKey, number>>;

export interface Behavior {
  id: string;
  name: string;
  description: string | null;
  effects: BehaviorEffects;
  createdAt: string;
}

export interface Cast {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  characterIds: string[];
  characters: Character[];
  createdAt: string;
}

/** Conta do site. OWNER: dono (publica na Área Oficial e modera); FAN: qualquer pessoa cadastrada. */
export type UserRole = 'OWNER' | 'FAN';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

/** Comportamento guardado pelo conteúdo dentro de uma publicação. */
export interface PublishedBehavior {
  name: string;
  description: string | null;
  effects: BehaviorEffects;
}

export interface PublishedCharacter {
  /** Identifica o personagem dentro da publicação. */
  key: string;
  name: string;
  imageUrl: string | null;
  behaviors: PublishedBehavior[];
}

export type PublicationKind = 'SEASON' | 'CAST' | 'CHARACTER';
/** OFFICIAL: Castelo · Área Oficial (donos). FAN: Área de Fãs. */
export type PublicationArea = 'OFFICIAL' | 'FAN';

/** Algo publicado numa área pública. Casts e personagens são cópias; temporadas são lidas ao vivo. */
export interface Publication {
  id: string;
  kind: PublicationKind;
  area: PublicationArea;
  publisherId: string | null;
  publisherName: string | null;
  seasonId: string | null;
  castId: string | null;
  characterId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  snapshot: {
    characters: PublishedCharacter[];
    relationships: { fromKey: string; toKey: string; trust: number; liking: number; hatred: number; allied: boolean }[];
  } | null;
  /** Temporadas: situação atual. */
  season: { id: string; name: string; mode: SeasonMode; status: SeasonStatus; currentDay: number | null; currentPhase: GamePhase | null } | null;
  publishedAt: string;
}

/** Resultado de copiar uma publicação para a Minha Área. */
export interface CopyResult {
  kind: PublicationKind;
  cast: Cast | null;
  character: Character | null;
}

export interface Season {
  id: string;
  name: string;
  castId: string | null;
  mode: SeasonMode;
  /** Loucura, de 0 a 100. */
  chaos: number;
  missionPool: MissionPool;
  /** Modo Jogador: conversas por momento. */
  interactionLimit: number;
  status: SeasonStatus;
  currentDay: number | null;
  currentPhase: GamePhase | null;
  currency: string;
  initialPrizePot: number;
  maxPrizePot: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Quem criou (compare com o usuário logado para saber se é da Minha Área). */
  ownerId: string | null;
}

export interface Player {
  id: string;
  seasonId: string;
  characterId: string | null;
  /** O participante controlado pelo usuário (modo Jogador). */
  isHuman: boolean;
  name: string;
  imageUrl: string | null;
  behaviorIds: string[];
  role: PlayerRole;
  isOriginalTraitor: boolean;
  status: PlayerStatus;
  eliminatedDayId: string | null;
  createdAt: string;
  /** Banido(a) na reta final sem revelar o papel à mesa (o papel só aparece no fim do jogo). */
  roleHidden?: boolean;
  /** Você também não sabe o papel (modo Jogador, ainda no jogo). */
  roleUnknown?: boolean;
}

export interface SeasonDetails extends Season {
  prizePot: number;
  players: Player[];
}

export interface Winner {
  seasonId: string;
  playerId: string;
  prizeShare: number;
}

export interface GameState {
  season: Season;
  day: number | null;
  phase: GamePhase | null;
  pendingRequirement: string | null;
  /** A fase atual já foi simulada (vale mesmo quando o jogador não pode ver o que aconteceu). */
  phaseSimulated: boolean;
  prizePot: number;
  activePlayers: Player[];
  eliminatedPlayers: Player[];
  winners: Winner[];
  /** Modo Jogador: a situação do usuário. */
  player: PlayerView | null;
}

export type PlayerNeed = 'VOTE' | 'REVOTE' | 'FINAL_TABLE' | 'TOWER' | 'OFFER' | 'SEER' | 'SEER_ANNOUNCE';

export interface PlayerView {
  playerId: string;
  name: string;
  imageUrl: string | null;
  role: PlayerRole;
  status: PlayerStatus;
  isActive: boolean;
  /** Eliminado(a) ou temporada encerrada: vê tudo, como quem assiste ao episódio. */
  spectator: boolean;
  interactionLimit: number;
  interactionsLeft: number;
  canTalk: boolean;
  /** Na torre: só dá para falar com os outros traidores. */
  towerTalk: boolean;
  /** O que dá para dizer neste momento. */
  allowedActions: HumanAction[];
  need: PlayerNeed | null;
  pendingOffer: { ultimatum: boolean } | null;
  canRecruit: boolean;
  canUltimatum: boolean;
  fellowTraitorIds: string[];
  dungeonIds: string[];
  /** Na torre: o que cada parceiro pretende e por quê. */
  towerIntents: { traitorId: string; targetId: string; reason: string; pledged: boolean }[];
  /** Acusações/defesas que o tempo provou certas ou erradas. */
  record: { hits: number; misses: number };
  /** Empate na votação: em quem dá para votar na revotação. */
  tiedIds: string[];
  /** Reta final: a última mesa redonda (voto simples) ou o Fogo da Verdade. */
  finalStage: 'TABLE' | 'FIRE' | null;
  /** Você é o(a) Vidente e ainda não escolheu com quem jantar. */
  seerPending: boolean;
  /** O que você descobriu como Vidente. */
  seer: { guestId: string; role: PlayerRole; announced: boolean } | null;
  /** Noite dos caixões (traidor): três nomes e qual caixão será pregado. */
  coffinNight: boolean;
  /** Convites para aliança esperando resposta: quem chamou, para qual aliança (null = nova a dois) e quem já está nela. */
  invites: { fromId: string; groupId: string | null; memberIds: string[] }[];
  /** Suas alianças, cada uma um grupo (sem você na lista). */
  alliances: { id: string; memberIds: string[] }[];
  /** Todos os seus aliados, somando as alianças. */
  allyIds: string[];
}

export interface DayRecord {
  id: string;
  seasonId: string;
  number: number;
  title: string | null;
  createdAt: string;
}

export interface DayPhaseRecord {
  id: string;
  dayId: string;
  phase: GamePhase;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface MissionRecord {
  id: string;
  dayId: string;
  name: string;
  description: string | null;
  prizeAvailable: number | null;
  prizeEarned: number;
  rewards: { id: string; missionId: string; playerId: string; rewardType: 'SHIELD' }[];
  createdAt: string;
}

export interface Vote {
  id: string;
  round: number;
  voterId: string;
  targetId: string;
}

export interface EndgameVote {
  id: string;
  voterId: string;
  choice: EndgameChoice;
}

export interface RoundTableRecord {
  id: string;
  dayId: string;
  kind: RoundTableKind;
  sequence: number;
  banishedPlayerId: string | null;
  votes: Vote[];
  endgameVotes: EndgameVote[];
  notes: string | null;
  revealedRole: PlayerRole | null;
  createdAt: string;
}

export interface TraitorMeetingRecord {
  id: string;
  dayId: string;
  murder: { id: string; targetId: string; outcome: MurderOutcome } | null;
  recruitments: { id: string; targetId: string; isUltimatum: boolean; outcome: RecruitmentOutcome }[];
  notes: string | null;
  createdAt: string;
}

export interface DayHistory {
  day: DayRecord;
  phases: DayPhaseRecord[];
  missions: MissionRecord[];
  roundTables: RoundTableRecord[];
  traitorsMeeting: TraitorMeetingRecord | null;
  /** Narrativa da simulação automática. */
  events: SimulationEventRecord[];
}

export interface SimulationEventRecord {
  id: string;
  seasonId: string;
  dayId: string;
  phase: GamePhase;
  sequence: number;
  kind: SimulationEventKind;
  tone: PhraseTone | null;
  /** Marcadores {user}, {user1}... na ordem de playerIds. */
  text: string;
  playerIds: string[];
  /** Conversa particular (só quem estava nela viu). */
  isPrivate?: boolean;
  createdAt: string;
}

export interface PrizeTransaction {
  id: string;
  seasonId: string;
  dayId: string | null;
  missionId: string | null;
  type: PrizeTransactionType;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface SeasonHistory {
  season: Season;
  prizePot: number;
  players: Player[];
  prizeTransactions: PrizeTransaction[];
  winners: Winner[];
  days: DayHistory[];
}

export interface Phrase {
  id: string;
  phase: PhrasePhase;
  tone: PhraseTone;
  behaviorId: string | null;
  text: string;
  createdAt: string;
}

/** O que `fromId` sente por `toId` (0 a 100). */
export interface Relationship {
  fromId: string;
  toId: string;
  trust: number;
  liking: number;
  hatred: number;
  allied: boolean;
}

/** Como o castelo enxerga um jogador (médias do que os outros sentem). */
export interface Standing {
  playerId: string;
  trust: number;
  suspicion: number;
  liking: number;
  hatred: number;
  /** 0 a 1 */
  banishChance: number;
  /** 0 a 1; null para traidores ou sem traidores */
  murderChance: number | null;
  allies: string[];
}

/** Temporada do programa (país + número) de onde vêm as missões e reviravoltas; MIX = todas. */
export type MissionPool = 'US_S1' | 'UK_S1' | 'US_S2' | 'UK_S2' | 'US_S3' | 'UK_S3' | 'MIX';

export interface CharacterStats {
  characterId: string;
  seasons: number;
  finished: number;
  wins: number;
  winsAsTraitor: number;
  winsAsFaithful: number;
  prizeWon: number;
  timesTraitor: number;
  timesRecruited: number;
  banished: number;
  murdered: number;
  withdrawn: number;
  finals: number;
  votesReceived: number;
  votesCast: number;
  votesOnTraitors: number;
  shields: number;
  avgDays: number;
}

export interface CastRankingRow {
  position: number;
  character: Character;
  stats: CharacterStats;
  score: number;
}

export interface Relationships {
  relationships: Relationship[];
  standings: Standing[];
}
