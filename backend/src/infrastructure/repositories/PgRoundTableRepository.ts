import { RoundTable } from '../../domain/entities';
import { EndgameChoice, RoundTableKind } from '../../domain/enums';
import { IRoundTableRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { groupBy, insertMany, query } from '../database/query';

interface RoundTableRow {
  id: string;
  day_id: string;
  kind: RoundTableKind;
  sequence: number;
  banished_player_id: string | null;
  notes: string | null;
  created_at: Date;
}

interface VoteRow {
  id: string;
  round_table_id: string;
  round: number;
  voter_id: string;
  target_id: string;
}

interface EndgameVoteRow {
  id: string;
  round_table_id: string;
  voter_id: string;
  choice: EndgameChoice;
}

export class PgRoundTableRepository implements IRoundTableRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<RoundTable | null> {
    const rows = await query<RoundTableRow>(this.db, 'SELECT * FROM round_tables WHERE id = $1', [id]);
    const [roundTable] = await this.hydrate(rows);
    return roundTable ?? null;
  }

  async findByDay(dayId: string): Promise<RoundTable[]> {
    const rows = await query<RoundTableRow>(this.db, 'SELECT * FROM round_tables WHERE day_id = $1 ORDER BY sequence', [dayId]);
    return this.hydrate(rows);
  }

  async findBySeason(seasonId: string): Promise<RoundTable[]> {
    const rows = await query<RoundTableRow>(
      this.db,
      `SELECT rt.* FROM round_tables rt
         JOIN days d ON d.id = rt.day_id
        WHERE d.season_id = $1
        ORDER BY d.number, rt.sequence`,
      [seasonId],
    );
    return this.hydrate(rows);
  }

  async create(roundTable: RoundTable): Promise<void> {
    const rt = roundTable.toJSON();
    await query(
      this.db,
      `INSERT INTO round_tables (id, day_id, kind, sequence, banished_player_id, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rt.id, rt.dayId, rt.kind, rt.sequence, rt.banishedPlayerId, rt.notes, rt.createdAt],
    );
    await insertMany(this.db, 'round_table_votes', ['id', 'round_table_id', 'round', 'voter_id', 'target_id'], rt.votes.map((v) => [v.id, rt.id, v.round, v.voterId, v.targetId]));
    await insertMany(this.db, 'endgame_votes', ['id', 'round_table_id', 'voter_id', 'choice'], rt.endgameVotes.map((v) => [v.id, rt.id, v.voterId, v.choice]));
  }

  private async hydrate(rows: RoundTableRow[]): Promise<RoundTable[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const votes = groupBy(
      await query<VoteRow>(this.db, 'SELECT * FROM round_table_votes WHERE round_table_id = ANY($1::uuid[]) ORDER BY round, created_at', [ids]),
      (v) => v.round_table_id,
    );
    const endgameVotes = groupBy(
      await query<EndgameVoteRow>(this.db, 'SELECT * FROM endgame_votes WHERE round_table_id = ANY($1::uuid[]) ORDER BY created_at', [ids]),
      (v) => v.round_table_id,
    );
    return rows.map(
      (r) =>
        new RoundTable({
          id: r.id,
          dayId: r.day_id,
          kind: r.kind,
          sequence: r.sequence,
          banishedPlayerId: r.banished_player_id,
          notes: r.notes,
          createdAt: r.created_at,
          votes: (votes.get(r.id) ?? []).map((v) => ({ id: v.id, round: v.round, voterId: v.voter_id, targetId: v.target_id })),
          endgameVotes: (endgameVotes.get(r.id) ?? []).map((v) => ({ id: v.id, voterId: v.voter_id, choice: v.choice })),
        }),
    );
  }
}
