import type { EndgameChoice, HumanAction } from '../../domain/enums';
import type { GameState, Relationships } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface RelationshipPatch {
  fromId: string;
  toId: string;
  trust?: number;
  liking?: number;
  hatred?: number;
  allied?: boolean;
}

/** Decisões do usuário no modo Jogador. */
export interface HumanDecision {
  voteTargetId?: string | null;
  endgameChoice?: EndgameChoice | null;
  murderTargetId?: string | null;
  recruit?: { targetId: string; ultimatum: boolean; victimIfAcceptedId?: string | null } | null;
  offerResponse?: 'ACCEPT' | 'DECLINE' | null;
  victimId?: string | null;
  seerGuestId?: string | null;
  seerAnnouncement?: 'TRUTH' | 'LIE' | 'SECRET' | null;
  coffinIds?: string[] | null;
  /** Missão interativa: a opção escolhida. */
  missionAnswer?: string | null;
}

/** Temporadas automáticas: simular fases e ver/ajustar relacionamentos. */
export interface ISimulationService {
  /** Simula a fase atual (ou tudo até a final, com untilEnd). No modo Jogador, com as decisões do usuário. */
  simulate(seasonId: string, untilEnd?: boolean, decision?: HumanDecision): Promise<GameState>;
  /** Modo Jogador: o usuário fala com alguém. */
  interact(seasonId: string, targetId: string, action: HumanAction, subjectId?: string | null): Promise<GameState>;
  /** Modo Jogador: aceitar ou recusar o convite de alguém para a aliança dele(a). */
  answerInvite(seasonId: string, inviterId: string, groupId: string | null, accept: boolean): Promise<GameState>;
  relationships(seasonId: string): Promise<Relationships>;
  regenerate(seasonId: string): Promise<Relationships>;
  updateRelationship(seasonId: string, patch: RelationshipPatch): Promise<Relationships>;
}

export class SimulationService implements ISimulationService {
  constructor(private readonly http: IHttpClient) {}

  simulate(seasonId: string, untilEnd = false, decision?: HumanDecision) {
    return this.http.post<GameState>(`/seasons/${seasonId}/simulate`, { untilEnd, decision });
  }

  interact(seasonId: string, targetId: string, action: HumanAction, subjectId?: string | null) {
    return this.http.post<GameState>(`/seasons/${seasonId}/interactions`, { targetId, action, subjectId });
  }

  answerInvite(seasonId: string, inviterId: string, groupId: string | null, accept: boolean) {
    return this.http.post<GameState>(`/seasons/${seasonId}/invites`, { inviterId, groupId, accept });
  }

  relationships(seasonId: string) {
    return this.http.get<Relationships>(`/seasons/${seasonId}/relationships`);
  }

  regenerate(seasonId: string) {
    return this.http.post<Relationships>(`/seasons/${seasonId}/relationships/regenerate`);
  }

  updateRelationship(seasonId: string, patch: RelationshipPatch) {
    return this.http.patch<Relationships>(`/seasons/${seasonId}/relationships`, patch);
  }
}
