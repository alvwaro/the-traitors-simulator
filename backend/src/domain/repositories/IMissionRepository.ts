import { Mission } from '../entities';

export interface IMissionRepository {
  findById(id: string): Promise<Mission | null>;
  findByDay(dayId: string): Promise<Mission[]>;
  countBySeason(seasonId: string): Promise<number>;
  /** Persiste a missão com as recompensas (escudos). */
  create(mission: Mission): Promise<void>;
  /** Jogadores protegidos na noite do dia informado. */
  findShieldedPlayerIds(dayId: string): Promise<string[]>;
}
