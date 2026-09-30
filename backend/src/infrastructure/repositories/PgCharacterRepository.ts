import { Character, CharacterPhoto, ParticipantProfile } from '../../domain/entities';
import { ICharacterRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { inOrder, query, queryOne } from '../database/query';
import { CHARACTER_BEHAVIORS } from './rows';

interface CharacterRow {
  id: string;
  name: string;
  image_url: string | null;
  photos: CharacterPhoto[] | null;
  profile: ParticipantProfile | null;
  behavior_ids: string[];
  created_at: Date;
  owner_id: string | null;
}

const SELECT = `SELECT c.*, ${CHARACTER_BEHAVIORS.column('c')} FROM characters c`;

const toEntity = (r: CharacterRow): Character =>
  new Character({
    id: r.id,
    name: r.name,
    imageUrl: r.image_url,
    photos: r.photos ?? [],
    behaviorIds: r.behavior_ids ?? [],
    profile: r.profile ?? null,
    createdAt: r.created_at,
    ownerId: r.owner_id,
  });

export class PgCharacterRepository implements ICharacterRepository {
  constructor(private readonly db: Queryable) {}

  findById(id: string): Promise<Character | null> {
    return queryOne(this.db, `${SELECT} WHERE c.id = $1`, [id], toEntity);
  }

  async findByIds(ids: readonly string[]): Promise<Character[]> {
    if (ids.length === 0) return [];
    const rows = await query<CharacterRow>(this.db, `${SELECT} WHERE c.id = ANY($1::uuid[])`, [ids]);
    return inOrder(ids, rows.map(toEntity));
  }

  findByName(ownerId: string, name: string): Promise<Character | null> {
    return queryOne(this.db, `${SELECT} WHERE c.owner_id = $1 AND lower(c.name) = lower($2)`, [ownerId, name.trim()], toEntity);
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
      'INSERT INTO characters (id, name, image_url, photos, profile, created_at, owner_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [c.id, c.name, c.imageUrl, JSON.stringify(c.photos), c.profile === null ? null : JSON.stringify(c.profile), c.createdAt, c.ownerId],
    );
    await CHARACTER_BEHAVIORS.replace(this.db, c.id, c.behaviorIds);
  }

  async update(character: Character): Promise<void> {
    const c = character.toJSON();
    await query(this.db, 'UPDATE characters SET name = $2, image_url = $3, photos = $4, profile = $5 WHERE id = $1', [
      c.id,
      c.name,
      c.imageUrl,
      JSON.stringify(c.photos),
      c.profile === null ? null : JSON.stringify(c.profile),
    ]);
    await CHARACTER_BEHAVIORS.replace(this.db, c.id, c.behaviorIds);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM characters WHERE id = $1', [id]);
  }
}
