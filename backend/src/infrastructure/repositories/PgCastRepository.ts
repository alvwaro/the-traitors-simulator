import { Cast } from '../../domain/entities';
import { ICastRepository } from '../../domain/repositories';
import { RelationshipProps } from '../../domain/simulation/RelationshipMatrix';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

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
    await query(this.db, 'UPDATE casts SET name = $2, description = $3, image_url = $4 WHERE id = $1', [
      c.id,
      c.name,
      c.description,
      c.imageUrl,
    ]);
    await query(this.db, 'DELETE FROM cast_members WHERE cast_id = $1', [c.id]);
    await this.insertMembers(c.id, c.characterIds);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM casts WHERE id = $1', [id]);
  }

  async findRelationships(castId: string): Promise<RelationshipProps[]> {
    const rows = await query<{ from_character_id: string; to_character_id: string; trust: number; liking: number; hatred: number; allied: boolean }>(
      this.db,
      'SELECT * FROM cast_relationships WHERE cast_id = $1',
      [castId],
    );
    return rows.map((r) => ({ fromId: r.from_character_id, toId: r.to_character_id, trust: r.trust, liking: r.liking, hatred: r.hatred, allied: r.allied }));
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

  private async insertMembers(castId: string, characterIds: string[]): Promise<void> {
    for (const [index, characterId] of characterIds.entries()) {
      await query(
        this.db,
        'INSERT INTO cast_members (cast_id, character_id, position) VALUES ($1, $2, $3)',
        [castId, characterId, index + 1],
      );
    }
  }

  private async hydrate(rows: CastRow[]): Promise<Cast[]> {
    if (rows.length === 0) return [];
    const members = await query<MemberRow>(
      this.db,
      'SELECT cast_id, character_id FROM cast_members WHERE cast_id = ANY($1::uuid[]) ORDER BY position',
      [rows.map((r) => r.id)],
    );
    return rows.map(
      (r) =>
        new Cast({
          id: r.id,
          name: r.name,
          description: r.description,
          imageUrl: r.image_url,
          createdAt: r.created_at,
          ownerId: r.owner_id,
          characterIds: members.filter((m) => m.cast_id === r.id).map((m) => m.character_id),
        }),
    );
  }
}
