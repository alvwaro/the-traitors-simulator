import { IRelationshipRepository } from '../../domain/repositories';
import { RelationshipProps } from '../../domain/simulation/RelationshipMatrix';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface RelationshipRow {
  from_player_id: string;
  to_player_id: string;
  trust: number;
  liking: number;
  hatred: number;
  allied: boolean;
}

/** Quantos pares vão em cada INSERT (4 colunas variáveis por par + season). */
const BATCH = 500;

export class PgRelationshipRepository implements IRelationshipRepository {
  constructor(private readonly db: Queryable) {}

  async findBySeason(seasonId: string): Promise<RelationshipProps[]> {
    const rows = await query<RelationshipRow>(
      this.db,
      'SELECT from_player_id, to_player_id, trust, liking, hatred, allied FROM relationships WHERE season_id = $1',
      [seasonId],
    );
    return rows.map((r) => ({ fromId: r.from_player_id, toId: r.to_player_id, trust: r.trust, liking: r.liking, hatred: r.hatred, allied: r.allied }));
  }

  async saveMany(seasonId: string, relationships: readonly RelationshipProps[]): Promise<void> {
    for (let start = 0; start < relationships.length; start += BATCH) {
      const chunk = relationships.slice(start, start + BATCH);
      await query(
        this.db,
        `INSERT INTO relationships (season_id, from_player_id, to_player_id, trust, liking, hatred, allied)
         SELECT $1, * FROM unnest($2::uuid[], $3::uuid[], $4::smallint[], $5::smallint[], $6::smallint[], $7::boolean[])
         ON CONFLICT (from_player_id, to_player_id) DO UPDATE
            SET trust = EXCLUDED.trust, liking = EXCLUDED.liking, hatred = EXCLUDED.hatred,
                allied = EXCLUDED.allied, updated_at = now()`,
        [
          seasonId,
          chunk.map((r) => r.fromId),
          chunk.map((r) => r.toId),
          chunk.map((r) => r.trust),
          chunk.map((r) => r.liking),
          chunk.map((r) => r.hatred),
          chunk.map((r) => r.allied),
        ],
      );
    }
  }

  async deleteBySeason(seasonId: string): Promise<void> {
    await query(this.db, 'DELETE FROM relationships WHERE season_id = $1', [seasonId]);
  }
}
