import { IAccessRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

export class PgAccessRepository implements IAccessRepository {
  constructor(private readonly db: Queryable) {}

  async seasonOwner(seasonId: string): Promise<string | null | undefined> {
    const [row] = await query<{ owner_id: string | null }>(this.db, 'SELECT owner_id FROM seasons WHERE id = $1', [seasonId]);
    return row ? row.owner_id : undefined;
  }

  async castOwner(castId: string): Promise<string | null | undefined> {
    const [row] = await query<{ owner_id: string | null }>(this.db, 'SELECT owner_id FROM casts WHERE id = $1', [castId]);
    return row ? row.owner_id : undefined;
  }

  async characterOwner(characterId: string): Promise<string | null | undefined> {
    const [row] = await query<{ owner_id: string | null }>(this.db, 'SELECT owner_id FROM characters WHERE id = $1', [characterId]);
    return row ? row.owner_id : undefined;
  }

  async claimOrphans(ownerId: string): Promise<void> {
    await query(this.db, 'UPDATE seasons SET owner_id = $1 WHERE owner_id IS NULL', [ownerId]);
    await query(this.db, 'UPDATE casts SET owner_id = $1 WHERE owner_id IS NULL', [ownerId]);
    await query(this.db, 'UPDATE characters SET owner_id = $1 WHERE owner_id IS NULL', [ownerId]);
    await query(this.db, 'UPDATE publications SET publisher_id = $1 WHERE publisher_id IS NULL', [ownerId]);
  }
}
