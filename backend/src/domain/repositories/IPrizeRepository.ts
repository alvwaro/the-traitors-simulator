import { PrizeTransaction } from '../entities';

export interface IPrizeRepository {
  addTransaction(transaction: PrizeTransaction): Promise<void>;
  findBySeason(seasonId: string): Promise<PrizeTransaction[]>;
  /** Lê da view season_prize_pots. */
  getPrizePot(seasonId: string): Promise<number>;
}
