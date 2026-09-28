import { RoundTable } from '../entities';

export interface IRoundTableRepository {
  findById(id: string): Promise<RoundTable | null>;
  findByDay(dayId: string): Promise<RoundTable[]>;
  findBySeason(seasonId: string): Promise<RoundTable[]>;
  /** Persiste a mesa com votos e votos de final. */
  create(roundTable: RoundTable): Promise<void>;
}
