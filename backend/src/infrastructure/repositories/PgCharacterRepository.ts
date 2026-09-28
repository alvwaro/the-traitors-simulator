import { Character } from '../../domain/entities';
import { ICharacterRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface CharacterRow {
  id: string;
  name: string;
  image_url: string | null;
  behavior_ids: string[];
  created_at: Date;
  owner_id: string | null;
}

const SELECT = `
  SELECT c.*,
         COALESCE(ARRAY(SELECT cb.behavior_id FROM character_behaviors cb
                         JOIN behaviors b ON b.id = cb.behavior_id
                        WHERE cb.character_id = c.id ORDER BY lower(b.name)), '{}') AS behavior_ids
    FROM characters c`;

const toEntity = (r: CharacterRow): Character =>
  new Character({ id: r.id, name: r.name, imageUrl: r.image_url, behaviorIds: r.behavior_ids ?? [], createdAt: r.created_at, ownerId: r.owner_id });

export class PgCharacterRepository implements ICharacterRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Character | null> {
    const [row] = await query<CharacterRow>(this.db, `${SELECT} WHERE c.id = $1`, [id]);
    return row ? toEntity(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Character[]> {
    if (ids.length === 0) return [];
    const rows = await query<CharacterRow>(this.db, `${SELECT} WHERE c.id = ANY($1::uuid[])`, [ids]);
    const byId = new Map(rows.map((r) => [r.id, toEntity(r)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  async findByName(ownerId: string, name: string): Promise<Character | null> {
    const [row] = await query<CharacterRow>(this.db, `${SELECT} WHERE c.owner_id = $1 AND lower(c.name) = lower($2)`, [ownerId, name.trim()]);
    return row ? toEntity(row) : null;
  }

  async findAll(ownerId: string, search?: string): Promise<Character[]> {
    const rows = await query<CharacterRow>(
      this.db,
      `${SELECT}
        WHERE c.owner_id = $1 AND ($2::text IS NULL OR c.name ILIKE '%' || $2 || '%')
        ORDER BY lower(c.name)`,
      [ownerId, search?.trim() || null],
    );
    return rows.map(toEntity);
  }

  async create(character: Character): Promise<void> {
    const c = character.toJSON();
    await query(
      this.db,
      'INSERT INTO characters (id, name, image_url, created_at, owner_id) VALUES ($1, $2, $3, $4, $5)',
      [c.id, c.name, c.imageUrl, c.createdAt, c.ownerId],
    );
    await this.saveBehaviors(c.id, c.behaviorIds);
  }

  async update(character: Character): Promise<void> {
    const c = character.toJSON();
    await query(this.db, 'UPDATE characters SET name = $2, image_url = $3 WHERE id = $1', [c.id, c.name, c.imageUrl]);
    await this.saveBehaviors(c.id, c.behaviorIds);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM characters WHERE id = $1', [id]);
  }

  private async saveBehaviors(characterId: string, behaviorIds: string[]): Promise<void> {
    await query(this.db, 'DELETE FROM character_behaviors WHERE character_id = $1', [characterId]);
    if (behaviorIds.length === 0) return;
    await query(
      this.db,
      'INSERT INTO character_behaviors (character_id, behavior_id) SELECT $1, unnest($2::uuid[])',
      [characterId, behaviorIds],
    );
  }
}
