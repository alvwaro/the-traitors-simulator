import type { SeasonMode } from '../../domain/enums';
import type { Cast, MissionPool, PrizeTransaction, Season, SeasonDetails } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface PrizeSettings {
  currency?: string;
  initialPrizePot?: number;
  maxPrizePot?: number | null;
}

export interface SimulationSettings {
  chaos?: number;
  missionPool?: MissionPool;
  interactionLimit?: number;
}

export interface CreateSeasonInput extends PrizeSettings, SimulationSettings {
  name: string;
  mode?: SeasonMode;
  /** Modo Jogador: quem é você no castelo. */
  human?: { name: string; imageUrl?: string | null } | null;
  castId?: string | null;
  characterIds?: string[];
}

export type SeasonUpdate = PrizeSettings & SimulationSettings & { name?: string; mode?: SeasonMode };

export interface PrizeAdjustmentInput {
  type: 'PENALTY' | 'ADJUSTMENT';
  amount: number;
  description?: string | null;
}

export interface ISeasonService {
  list(): Promise<Season[]>;
  get(id: string): Promise<SeasonDetails>;
  create(input: CreateSeasonInput): Promise<SeasonDetails>;
  update(id: string, input: SeasonUpdate): Promise<Season>;
  remove(id: string): Promise<void>;
  saveAsCast(id: string, input: { name: string; description?: string | null }): Promise<Cast>;
  adjustPrize(id: string, input: PrizeAdjustmentInput): Promise<{ transaction: PrizeTransaction; prizePot: number }>;
}

export class SeasonService implements ISeasonService {
  constructor(private readonly http: IHttpClient) {}

  list() {
    return this.http.get<Season[]>('/seasons');
  }

  get(id: string) {
    return this.http.get<SeasonDetails>(`/seasons/${id}`);
  }

  create(input: CreateSeasonInput) {
    return this.http.post<SeasonDetails>('/seasons', input);
  }

  update(id: string, input: SeasonUpdate) {
    return this.http.patch<Season>(`/seasons/${id}`, input);
  }

  remove(id: string) {
    return this.http.delete(`/seasons/${id}`);
  }

  saveAsCast(id: string, input: { name: string; description?: string | null }) {
    return this.http.post<Cast>(`/seasons/${id}/save-as-cast`, input);
  }

  adjustPrize(id: string, input: PrizeAdjustmentInput) {
    return this.http.post<{ transaction: PrizeTransaction; prizePot: number }>(`/seasons/${id}/prize-adjustments`, input);
  }
}
