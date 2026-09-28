import {
  DayPhaseProps,
  DayProps,
  MissionProps,
  PlayerProps,
  PrizeTransactionProps,
  RoundTableProps,
  SeasonProps,
  SeasonWinnerProps,
  SimulationEventProps,
  TraitorMeetingProps,
} from '../../domain/entities';
import { RelationshipProps, Standing } from '../../domain/simulation';
import { EndgameChoice, GamePhase, PlayerRole, PlayerStatus } from '../../domain/enums';
import { HumanAction } from '../../domain/simulation/humanActions';

export interface GameStateOutput {
  season: SeasonProps;
  day: number | null;
  phase: GamePhase | null;
  /** O que falta registrar para poder avançar (null = pode avançar). */
  pendingRequirement: string | null;
  /** Temporadas automáticas: a fase atual já foi simulada (mesmo que o jogador não veja o que aconteceu). */
  phaseSimulated: boolean;
  prizePot: number;
  activePlayers: PlayerProps[];
  eliminatedPlayers: PlayerProps[];
  winners: SeasonWinnerProps[];
  /** Modo Jogador: a situação do usuário (null nos outros modos). */
  player: PlayerView | null;
}

/** O que o jogador humano precisa decidir para a fase atual andar. */
export type PlayerNeed = 'VOTE' | 'REVOTE' | 'FINAL_TABLE' | 'TOWER' | 'OFFER' | 'SEER' | 'SEER_ANNOUNCE' | 'MISSION' | 'FIRE_VOTE';

export interface PlayerView {
  playerId: string;
  name: string;
  imageUrl: string | null;
  role: PlayerRole;
  status: PlayerStatus;
  isActive: boolean;
  /** Sem máscara: eliminado(a) ou temporada encerrada, o usuário assiste a tudo. */
  spectator: boolean;
  interactionLimit: number;
  interactionsLeft: number;
  /** Pode conversar agora (momento de conversa; no café, só depois de saber quem morreu). */
  canTalk: boolean;
  /** Pode conversar só com os outros traidores (na torre). */
  towerTalk: boolean;
  /** O que dá para dizer neste momento (na chegada, só primeiras impressões; na torre, só o plano da noite). */
  allowedActions: string[];
  need: PlayerNeed | null;
  /** Missão interativa parada: a pergunta da vez e o que já aconteceu na missão até ela. */
  mission: { prompt: string; playerIds: string[]; options: { id: string; label: string; playerId?: string }[]; preview: { kind: string; tone: string | null; text: string; playerIds: string[] }[] } | null;
  pendingOffer: { ultimatum: boolean } | null;
  canRecruit: boolean;
  canUltimatum: boolean;
  fellowTraitorIds: string[];
  /** Condenados da masmorra desta noite (só para traidores). */
  dungeonIds: string[];
  /** Na torre: o que cada parceiro pretende e por quê. */
  towerIntents: TowerIntent[];
  /** Acusações/defesas que o tempo provou certas ou erradas (vira credibilidade). */
  record: { hits: number; misses: number };
  /** Empate na votação: em quem dá para votar na revotação (sem o próprio jogador). */
  tiedIds: string[];
  /** Reta final: 'TABLE' = a última mesa redonda (voto simples); 'FIRE' = o Fogo da Verdade. */
  finalStage: 'TABLE' | 'FIRE' | null;
  /** Você é o(a) Vidente e ainda não escolheu com quem jantar esta noite. */
  seerPending: boolean;
  /** O que você descobriu como Vidente (e se já contou no café). */
  seer: { guestId: string; role: PlayerRole; announced: boolean } | null;
  /** Noite dos caixões (traidor): escolha três nomes e qual caixão será pregado. */
  coffinNight: boolean;
  /** Convites para aliança esperando resposta neste momento (quem convidou, para qual aliança e quem já está nela). */
  invites: { fromId: string; groupId: string | null; memberIds: string[] }[];
  /** As alianças do jogador, cada uma um grupo (sem ele na lista). */
  alliances: { id: string; memberIds: string[] }[];
  /** Todos os aliados, somando as alianças. */
  allyIds: string[];
}

/** Modo Jogador: resposta a um convite para aliança. */
export interface AnswerInviteInput {
  seasonId: string;
  inviterId: string;
  /** A aliança do convite (null = aliança nova a dois). */
  groupId?: string | null;
  accept: boolean;
}

/** Anotações livres da fase atual (interações na chegada, café da manhã etc). */
export interface RegisterPhaseNotesInput {
  seasonId: string;
  notes: string | null;
}

export interface SelectTraitorsInput {
  seasonId: string;
  traitorIds: string[];
}

export interface RegisterMissionInput {
  seasonId: string;
  /** Opcional: sem nome vira "Missão 01", "Missão 02"... na ordem da temporada. */
  name?: string | null;
  description?: string | null;
  prizeEarned: number;
  prizeAvailable?: number | null;
  shieldedPlayerIds: string[];
}

export interface MissionOutput extends MissionProps {
  prizeEarned: number;
}

export interface VoteInput {
  voterId: string;
  targetId: string;
  round?: number; // 2+ = revotação por empate
}

export interface RegisterRoundTableInput {
  seasonId: string;
  banishedPlayerId: string;
  votes?: VoteInput[]; // opcional: dá pra registrar só o banido
  notes?: string | null;
}

export interface RoundTableOutput extends RoundTableProps {
  /** Papel revelado do banido. */
  revealedRole: PlayerRole | null;
}

export interface RegisterTraitorsMeetingInput {
  seasonId: string;
  murderTargetId?: string | null; // o resultado (escudo) é calculado pelo sistema
  /** Assassinato à vista de todos (taça envenenada): o escudo não protege. */
  plainSight?: boolean;
  recruitment?: {
    targetId: string;
    accepted: boolean;
    isUltimatum?: boolean;
  } | null;
  notes?: string | null;
}

export interface RegisterEndgameRoundTableInput {
  seasonId: string;
  endgameVotes: { voterId: string; choice: EndgameChoice }[];
  // Se não for unânime em END_GAME, há novo banimento:
  banishedPlayerId?: string | null;
  votes?: VoteInput[];
  notes?: string | null;
}

export interface DayHistory {
  day: DayProps;
  phases: DayPhaseProps[];
  missions: MissionOutput[];
  roundTables: RoundTableOutput[];
  traitorsMeeting: TraitorMeetingProps | null;
  /** Narrativa da simulação automática (vazia nas temporadas manuais). */
  events: SimulationEventProps[];
}

export interface SeasonHistoryOutput {
  season: SeasonProps;
  prizePot: number;
  players: PlayerProps[];
  prizeTransactions: PrizeTransactionProps[];
  winners: SeasonWinnerProps[];
  days: DayHistory[];
}

export interface SimulateInput {
  seasonId: string;
  /** Simula e avança fase após fase até a revelação final. */
  untilEnd?: boolean;
  /** Modo Jogador: o que o usuário decidiu para esta fase. */
  decision?: HumanDecision;
}

export interface HumanDecision {
  /** Mesa redonda e mesa final: em quem vota. */
  voteTargetId?: string | null;
  /** Mesa final: encerrar ou banir de novo. */
  endgameChoice?: EndgameChoice | null;
  /** Torre (traidor): quem assassinar. */
  murderTargetId?: string | null;
  /** Torre (traidor): recrutar em vez de assassinar. */
  recruit?: { targetId: string; ultimatum: boolean; victimIfAcceptedId?: string | null } | null;
  /** Resposta ao convite dos traidores. */
  offerResponse?: 'ACCEPT' | 'DECLINE' | null;
  /** Ultimato aceito: a vítima que o usuário escolhe junto com quem o recrutou. */
  victimId?: string | null;
  /** Vidente: com quem jantar esta noite. */
  seerGuestId?: string | null;
  /** Vidente, no café: contar a verdade, mentir ou guardar segredo. */
  seerAnnouncement?: 'TRUTH' | 'LIE' | 'SECRET' | null;
  /** Noite dos caixões (traidor): os três nomes (a vítima, murderTargetId, é um deles). */
  coffinIds?: string[] | null;
  /** Missão interativa: a opção escolhida para a pergunta da vez. */
  missionAnswer?: string | null;
}

export interface InteractInput {
  seasonId: string;
  targetId: string;
  action: HumanAction;
  /** De quem se fala (convencer, perguntar sobre, torre). */
  subjectId?: string | null;
}

/** O que um parceiro traidor quer fazer esta noite (visto na torre pelo jogador traidor). */
export interface TowerIntent {
  traitorId: string;
  targetId: string;
  /** Motivo em palavras ("está desconfiando de nós"...). */
  reason: string;
  /** Combinado com o jogador. */
  pledged: boolean;
}

export interface RelationshipsOutput {
  relationships: RelationshipProps[];
  standings: Standing[];
}

export interface UpdateRelationshipInput {
  seasonId: string;
  fromId: string;
  toId: string;
  trust?: number;
  liking?: number;
  hatred?: number;
  /** Aliança vale nos dois sentidos. */
  allied?: boolean;
}
