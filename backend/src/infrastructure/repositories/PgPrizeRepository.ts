import { PrizeTransaction } from '../../domain/entities';
import { PrizeTransactionType } from '../../domain/enums';
import { IPrizeRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface PrizeTransactionRow {
  id: string;
  season_id: string;
  day_id: string | null;
  mission_id: string | null;
  type: PrizeTransactionType;
  amount: string;
  description: string | null;
  created_at: Date;
}

export class PgPrizeRepository implements IPrizeRepository {
  constructor(private readonly db: Queryable) {}

  async addTransaction(transaction: PrizeTransaction): Promise<void> {
    const t = transaction.toJSON();
    await query(
      this.db,
      `INSERT INTO prize_transactions (id, season_id, day_id, mission_id, type, amount, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [t.id, t.seasonId, t.dayId, t.missionId, t.type, t.amount, t.description, t.createdAt],
    );
  }

  async findBySeason(seasonId: string): Promise<PrizeTransaction[]> {
    const rows = await query<PrizeTransactionRow>(
      this.db,
      'SELECT * FROM prize_transactions WHERE season_id = $1 ORDER BY created_at',
      [seasonId],
    );
    return rows.map(
      (r) =>
        new PrizeTransaction({
          id: r.id,
          seasonId: r.season_id,
          dayId: r.day_id,
          missionId: r.mission_id,
          type: r.type,
          amount: Number(r.amount),
          description: r.description,
          createdAt: r.created_at,
        }),
    );
  }

  async getPrizePot(seasonId: string): Promise<number> {
    const [row] = await query<{ prize_pot: string }>(
      this.db,
      'SELECT prize_pot FROM season_prize_pots WHERE season_id = $1',
      [seasonId],
    );
    return row ? Number(row.prize_pot) : 0;
  }
}
