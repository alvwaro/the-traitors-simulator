import { Cast } from '../../domain/entities';
import { ICastRepository } from '../../domain/repositories';
import { RelationshipProps } from '../../domain/simulation/RelationshipMatrix';
import { Queryable } from '../database/connection';
import { groupBy, insertMany, query } from '../database/query';
import { RELATIONSHIP_FEELINGS, RelationshipRow, toRelationship } from './rows';

interface CastRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: Date;
  owner_id: string | null;
}

interface MemberRow {
  cast_id: string;
  character_id: string;
}

export class PgCastRepository implements ICastRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Cast | null> {
    const rows = await query<CastRow>(this.db, 'SELECT * FROM casts WHERE id = $1', [id]);
    const [cast] = await this.hydrate(rows);
    return cast ?? null;
  }

  async findAll(ownerId: string): Promise<Cast[]> {
    const rows = await query<CastRow>(this.db, 'SELECT * FROM casts WHERE owner_id = $1 ORDER BY lower(name)', [ownerId]);
    return this.hydrate(rows);
  }

  async create(cast: Cast): Promise<void> {
    const c = cast.toJSON();
    await query(
      this.db,
      'INSERT INTO casts (id, name, description, image_url, created_at, owner_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [c.id, c.name, c.description, c.imageUrl, c.createdAt, c.ownerId],
    );
    await this.insertMembers(c.id, c.characterIds);
  }

  async update(cast: Cast): Promise<void> {
    const c = cast.toJSON();
    await query(this.db, 'UPDATE casts SET name = $2, description = $3, image_url = $4 WHERE id = $1', [c.id, c.name, c.description, c.imageUrl]);
    await query(this.db, 'DELETE FROM cast_members WHERE cast_id = $1', [c.id]);
    await this.insertMembers(c.id, c.characterIds);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM casts WHERE id = $1', [id]);
  }

  async findRelationships(castId: string): Promise<RelationshipProps[]> {
    const rows = await query<RelationshipRow>(
      this.db,
      `SELECT from_character_id AS from_id, to_character_id AS to_id, ${RELATIONSHIP_FEELINGS} FROM cast_relationships WHERE cast_id = $1`,
      [castId],
    );
    return rows.map(toRelationship);
  }

  async saveRelationship(castId: string, r: RelationshipProps): Promise<void> {
    await query(
      this.db,
      `INSERT INTO cast_relationships (cast_id, from_character_id, to_character_id, trust, liking, hatred, allied)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (cast_id, from_character_id, to_character_id) DO UPDATE
          SET trust = EXCLUDED.trust, liking = EXCLUDED.liking, hatred = EXCLUDED.hatred, allied = EXCLUDED.allied`,
      [castId, r.fromId, r.toId, r.trust, r.liking, r.hatred, r.allied],
    );
  }

  async deleteRelationship(castId: string, fromId: string, toId: string): Promise<void> {
    await query(this.db, 'DELETE FROM cast_relationships WHERE cast_id = $1 AND from_character_id = $2 AND to_character_id = $3', [castId, fromId, toId]);
  }

  /** O elenco na ordem dada (position 1, 2, 3...). */
  private insertMembers(castId: string, characterIds: readonly string[]): Promise<void> {
    return insertMany(this.db, 'cast_members', ['cast_id', 'character_id', 'position'], characterIds.map((characterId, i) => [castId, characterId, i + 1]));
  }

  private async hydrate(rows: CastRow[]): Promise<Cast[]> {
    if (rows.length === 0) return [];
    const members = await query<MemberRow>(
      this.db,
      'SELECT cast_id, character_id FROM cast_members WHERE cast_id = ANY($1::uuid[]) ORDER BY position',
      [rows.map((r) => r.id)],
    );
    const byCast = groupBy(members, (m) => m.cast_id);
    return rows.map(
      (r) =>
        new Cast({
          id: r.id,
          name: r.name,
          description: r.description,
          imageUrl: r.image_url,
          createdAt: r.created_at,
          ownerId: r.owner_id,
          characterIds: (byCast.get(r.id) ?? []).map((m) => m.character_id),
        }),
    );
  }
}
