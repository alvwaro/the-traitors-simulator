import { SeasonWinner } from '../../domain/entities';
import { ISeasonWinnerRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface SeasonWinnerRow {
  season_id: string;
  player_id: string;
  prize_share: string;
}

export class PgSeasonWinnerRepository implements ISeasonWinnerRepository {
  constructor(private readonly db: Queryable) {}

  async findBySeason(seasonId: string): Promise<SeasonWinner[]> {
    const rows = await query<SeasonWinnerRow>(this.db, 'SELECT * FROM season_winners WHERE season_id = $1', [seasonId]);
    return rows.map((r) => new SeasonWinner({ seasonId: r.season_id, playerId: r.player_id, prizeShare: Number(r.prize_share) }));
  }

  async saveAll(winners: SeasonWinner[]): Promise<void> {
    for (const w of winners.map((x) => x.toJSON())) {
      await query(
        this.db,
        `INSERT INTO season_winners (season_id, player_id, prize_share) VALUES ($1, $2, $3)
         ON CONFLICT (season_id, player_id) DO UPDATE SET prize_share = EXCLUDED.prize_share`,
        [w.seasonId, w.playerId, w.prizeShare],
      );
    }
  }
}
