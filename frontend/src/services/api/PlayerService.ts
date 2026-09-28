import type { PlayerRole } from '../../domain/enums';
import type { Player } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface AddPlayerInput {
  characterId?: string | null;
  name?: string;
  imageUrl?: string | null;
  role?: PlayerRole;
  saveToLibrary?: boolean;
  behaviorIds?: string[];
}

export interface UpdatePlayerInput {
  name?: string;
  imageUrl?: string | null;
  role?: PlayerRole;
  behaviorIds?: string[];
}

export interface IPlayerService {
  list(seasonId: string): Promise<Player[]>;
  add(seasonId: string, input: AddPlayerInput): Promise<Player>;
  update(seasonId: string, playerId: string, input: UpdatePlayerInput): Promise<Player>;
  remove(seasonId: string, playerId: string): Promise<void>;
  withdraw(seasonId: string, playerId: string): Promise<Player>;
}

export class PlayerService implements IPlayerService {
  constructor(private readonly http: IHttpClient) {}

  list(seasonId: string) {
    return this.http.get<Player[]>(`/seasons/${seasonId}/players`);
  }

  add(seasonId: string, input: AddPlayerInput) {
    return this.http.post<Player>(`/seasons/${seasonId}/players`, input);
  }

  update(seasonId: string, playerId: string, input: UpdatePlayerInput) {
    return this.http.patch<Player>(`/seasons/${seasonId}/players/${playerId}`, input);
  }

  remove(seasonId: string, playerId: string) {
    return this.http.delete(`/seasons/${seasonId}/players/${playerId}`);
  }

  withdraw(seasonId: string, playerId: string) {
    return this.http.post<Player>(`/seasons/${seasonId}/players/${playerId}/withdraw`);
  }
}
