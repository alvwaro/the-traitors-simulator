import type { GameState, SeasonHistory } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

/** Fluxo da temporada: iniciar, consultar, avançar e final. */
export interface IGameService {
  start(seasonId: string): Promise<GameState>;
  state(seasonId: string): Promise<GameState>;
  history(seasonId: string): Promise<SeasonHistory>;
  advance(seasonId: string): Promise<GameState>;
  startEndgame(seasonId: string): Promise<GameState>;
}

export class GameService implements IGameService {
  constructor(private readonly http: IHttpClient) {}

  start(seasonId: string) {
    return this.http.post<GameState>(`/seasons/${seasonId}/start`);
  }

  state(seasonId: string) {
    return this.http.get<GameState>(`/seasons/${seasonId}/state`);
  }

  history(seasonId: string) {
    return this.http.get<SeasonHistory>(`/seasons/${seasonId}/history`);
  }

  advance(seasonId: string) {
    return this.http.post<GameState>(`/seasons/${seasonId}/advance`);
  }

  startEndgame(seasonId: string) {
    return this.http.post<GameState>(`/seasons/${seasonId}/endgame`);
  }
}
