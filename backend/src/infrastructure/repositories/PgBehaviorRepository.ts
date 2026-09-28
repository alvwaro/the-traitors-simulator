import { Behavior, BehaviorEffects } from '../../domain/entities';
import { IBehaviorRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface BehaviorRow {
  id: string;
  name: string;
  description: string | null;
  effects: BehaviorEffects;
  created_at: Date;
}

const toEntity = (r: BehaviorRow): Behavior =>
  new Behavior({ id: r.id, name: r.name, description: r.description, effects: r.effects ?? {}, createdAt: r.created_at });

export class PgBehaviorRepository implements IBehaviorRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Behavior | null> {
    const [row] = await query<BehaviorRow>(this.db, 'SELECT * FROM behaviors WHERE id = $1', [id]);
    return row ? toEntity(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Behavior[]> {
    if (ids.length === 0) return [];
    const rows = await query<BehaviorRow>(this.db, 'SELECT * FROM behaviors WHERE id = ANY($1::uuid[])', [ids]);
    const byId = new Map(rows.map((r) => [r.id, toEntity(r)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  async findAll(): Promise<Behavior[]> {
    const rows = await query<BehaviorRow>(this.db, 'SELECT * FROM behaviors ORDER BY lower(name)');
    return rows.map(toEntity);
  }

  async create(behavior: Behavior): Promise<void> {
    const b = behavior.toJSON();
    await query(
      this.db,
      'INSERT INTO behaviors (id, name, description, effects, created_at) VALUES ($1, $2, $3, $4, $5)',
      [b.id, b.name, b.description, JSON.stringify(b.effects), b.createdAt],
    );
  }

  async update(behavior: Behavior): Promise<void> {
    const b = behavior.toJSON();
    await query(this.db, 'UPDATE behaviors SET name = $2, description = $3, effects = $4 WHERE id = $1', [
      b.id,
      b.name,
      b.description,
      JSON.stringify(b.effects),
    ]);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM behaviors WHERE id = $1', [id]);
  }
}
