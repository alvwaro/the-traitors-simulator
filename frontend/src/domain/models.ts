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
import type { BehaviorEffects, CharacterStats, MissionPool, PublicationArea, PublicationCountry, PublicationKind, UserRole } from '@traitors/shared';

// Tipos que o backend define igual (kernel compartilhado).
export type { BehaviorEffects, CharacterStats, MissionPool, PublicationArea, PublicationCountry, PublicationKind, UserRole } from '@traitors/shared';

// Formatos devolvidos pela API (datas chegam como string ISO).

export interface CharacterPhoto {
  url: string;
  /** Legenda curta, como "EUA · 4ª temporada". */
  label: string | null;
}

/** Papel do participante numa temporada do programa (spoiler). */
export type ParticipantRole = 'FAITHFUL' | 'TRAITOR' | 'RECRUITED';

/** Uma temporada de The Traitors em que o participante real esteve. */
export interface ParticipantSeason {
  label: string;
  /** Temporada oficial publicada no site que corresponde a esta (a página mostra o cartão dela). */
  publicationId: string | null;
  role: ParticipantRole | null;
  roleDetail: string | null;
  fate: string | null;
  placement: string | null;
  shieldWins: number | null;
  episodes: number | null;
}

/** Página de informações do participante (temporadas oficiais). */
export interface ParticipantProfile {
  wikiUrl: string | null;
  seasons: ParticipantSeason[];
  otherShows: string[];
}

export interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Fotos extras; cada cast pode usar uma delas. */
  photos?: CharacterPhoto[];
  behaviorIds: string[];
  profile?: ParticipantProfile | null;
  createdAt: string;
}

/** A página do participante, como a API devolve. */
export interface Participant {
  id: string;
  name: string;
  imageUrl: string | null;
  photos: CharacterPhoto[];
  profile: ParticipantProfile | null;
  canEdit: boolean;
}

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
  /** Temporadas: o personagem de origem (a página do participante, nas oficiais). */
  characterId?: string | null;
}

/** As configurações de uma temporada publicada: quem copia a temporada recebe as mesmas. */
export interface PublishedSeason {
  mode: SeasonMode;
  chaos: number;
  /** A temporada do programa que ela reproduz. */
  missionPool: MissionPool;
  interactionLimit: number;
  withdrawals: boolean;
  hiddenShieldChance: number;
  currency: string;
  initialPrizePot: number;
  maxPrizePot: number | null;
  drama?: boolean;
  showPhrases?: boolean;
}

/** Algo publicado numa área pública: sempre uma cópia do momento da publicação. */
export interface Publication {
  id: string;
  kind: PublicationKind;
  area: PublicationArea;
  /** Temporadas oficiais: EUA ou Reino Unido. */
  country: PublicationCountry | null;
  publisherId: string | null;
  publisherName: string | null;
  /** De onde veio (null se a origem foi apagada). */
  seasonId: string | null;
  castId: string | null;
  characterId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** O elenco: o cast, o personagem ou os participantes da temporada. */
  snapshot: {
    characters: PublishedCharacter[];
    relationships: { fromKey: string; toKey: string; trust: number; liking: number; hatred: number; allied: boolean }[];
  };
  /** Temporadas: as configurações quando foi publicada. */
  season: PublishedSeason | null;
  publishedAt: string;
}

/** Resultado de copiar uma publicação para a biblioteca. */
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
  /** A simulação pode tirar alguém do castelo por motivos pessoais. */
  withdrawals: boolean;
  /** Chance (0 a 100) de os escudos de uma missão ficarem misteriosos na simulação. */
  hiddenShieldChance?: number;
  /** Modo Jogador: os acontecimentos de cada momento aparecem um de cada vez. */
  drama?: boolean;
  /** Falas da biblioteca de frases na narrativa (desligado: foco nas eliminações). */
  showPhrases?: boolean;
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
  /** Temporada manual: há um registro para desfazer (ou uma fase anterior para onde voltar). */
  canGoBack: boolean;
}

export type PlayerNeed = 'VOTE' | 'REVOTE' | 'FINAL_TABLE' | 'TOWER' | 'OFFER' | 'SEER' | 'SEER_ANNOUNCE' | 'MISSION' | 'FIRE_VOTE';

/** Missão interativa parada numa escolha do jogador. */
export interface PendingMissionView {
  /** Enunciado com {user}, {user1}... na ordem de playerIds. */
  prompt: string;
  playerIds: string[];
  /** Opções; as que têm playerId são pessoas (mostradas pelo retrato). */
  options: { id: string; label: string; playerId?: string }[];
  /** O que já aconteceu na missão até a pergunta. */
  preview: { kind: SimulationEventKind; tone: PhraseTone | null; text: string; playerIds: string[] }[];
}

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
  mission: PendingMissionView | null;
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
  rewards: { id: string; missionId: string; playerId: string; rewardType: 'SHIELD'; hidden?: boolean }[];
  /** Escudo misterioso: quem ganhou escudo fica em segredo (a tela mostra "?"). */
  shieldsHidden?: boolean;
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

/** Um acontecimento ou reviravolta, como aparece no guia das temporadas. */
export interface GameEvent {
  name: string;
  description: string;
}

export interface EditionMission {
  key: string;
  origin: string;
  name: string;
  description: string;
  /** Valor máximo, na moeda da versão (dólar nos EUA, libra no Reino Unido). */
  prizeAvailable: number;
  kind: 'REGULAR' | 'SEER' | 'FINALE';
}

/** Uma temporada do programa: missões na ordem da exibição e reviravoltas próprias. */
export interface Edition {
  pool: MissionPool;
  country: 'US' | 'UK' | 'MIX';
  season: number | null;
  label: string;
  summary: string;
  currency: 'USD' | 'GBP';
  twists: GameEvent[];
  missions: EditionMission[];
}

export interface EditionsGuide {
  commonEvents: GameEvent[];
  editions: Edition[];
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
