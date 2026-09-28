import { Player } from '../entities';
import { PlayerRole, PlayerStatus } from '../enums';

export interface PlayerFilter {
  status?: PlayerStatus;
  role?: PlayerRole;
}

export interface IPlayerRepository {
  findById(id: string): Promise<Player | null>;
  findByIds(ids: string[]): Promise<Player[]>;
  findBySeason(seasonId: string, filter?: PlayerFilter): Promise<Player[]>;
  create(player: Player): Promise<void>;
  update(player: Player): Promise<void>;
  updateMany(players: Player[]): Promise<void>;
  delete(id: string): Promise<void>;
}
