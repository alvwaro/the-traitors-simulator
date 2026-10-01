import type { EndgameChoice } from '../../domain/enums';
import type {
  DayPhaseRecord,
  MissionRecord,
  Player,
  RoundTableRecord,
  TraitorMeetingRecord,
} from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface VoteDraft {
  voterId: string;
  targetId: string;
  round: number;
}

export interface MissionInput {
  name?: string | null;
  description?: string | null;
  prizeEarned: number;
  prizeAvailable?: number | null;
  shieldedPlayerIds: string[];
  /** Escudos (dentre os de shieldedPlayerIds) que ficam escondidos: aparecem como "?". */
  hiddenShieldPlayerIds?: string[];
}

export interface RoundTableInput {
  banishedPlayerId: string;
  votes?: VoteDraft[];
  notes?: string | null;
}

export interface TraitorsMeetingInput {
  murderTargetId?: string | null;
  recruitment?: { targetId: string; accepted: boolean; isUltimatum?: boolean } | null;
  notes?: string | null;
}

export interface EndgameRoundTableInput {
  endgameVotes: { voterId: string; choice: EndgameChoice }[];
  banishedPlayerId?: string | null;
  votes?: VoteDraft[];
  notes?: string | null;
}

/** Registro das decisões da fase atual. */
export interface IPhaseService {
  notes(seasonId: string, notes: string | null): Promise<DayPhaseRecord>;
  selectTraitors(seasonId: string, traitorIds: string[]): Promise<Player[]>;
  mission(seasonId: string, input: MissionInput): Promise<MissionRecord>;
  roundTable(seasonId: string, input: RoundTableInput): Promise<RoundTableRecord>;
  traitorsMeeting(seasonId: string, input: TraitorsMeetingInput): Promise<TraitorMeetingRecord>;
  endgameRoundTable(seasonId: string, input: EndgameRoundTableInput): Promise<RoundTableRecord>;
}

export class PhaseService implements IPhaseService {
  constructor(private readonly http: IHttpClient) {}

  private path(seasonId: string, action: string) {
    return `/seasons/${seasonId}/phase/${action}`;
  }

  notes(seasonId: string, notes: string | null) {
    return this.http.post<DayPhaseRecord>(this.path(seasonId, 'notes'), { notes });
  }

  selectTraitors(seasonId: string, traitorIds: string[]) {
    return this.http.post<Player[]>(this.path(seasonId, 'traitor-selection'), { traitorIds });
  }

  mission(seasonId: string, input: MissionInput) {
    return this.http.post<MissionRecord>(this.path(seasonId, 'mission'), input);
  }

  roundTable(seasonId: string, input: RoundTableInput) {
    return this.http.post<RoundTableRecord>(this.path(seasonId, 'round-table'), input);
  }

  traitorsMeeting(seasonId: string, input: TraitorsMeetingInput) {
    return this.http.post<TraitorMeetingRecord>(this.path(seasonId, 'traitors-meeting'), input);
  }

  endgameRoundTable(seasonId: string, input: EndgameRoundTableInput) {
    return this.http.post<RoundTableRecord>(this.path(seasonId, 'endgame-round-table'), input);
  }
}
