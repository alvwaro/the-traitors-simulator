import { Phrase } from '../../domain/entities';
import { PhrasePhase, PhraseTone } from '../../domain/enums';
import { IPhraseRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query, queryOne } from '../database/query';

interface PhraseRow {
  id: string;
  phase: PhrasePhase;
  tone: PhraseTone;
  behavior_id: string | null;
  text: string;
  created_at: Date;
}

const toEntity = (r: PhraseRow): Phrase => new Phrase({ id: r.id, phase: r.phase, tone: r.tone, behaviorId: r.behavior_id, text: r.text, createdAt: r.created_at });

export class PgPhraseRepository implements IPhraseRepository {
  constructor(private readonly db: Queryable) {}

  findById(id: string): Promise<Phrase | null> {
    return queryOne(this.db, 'SELECT * FROM phrases WHERE id = $1', [id], toEntity);
  }

  async findAll(phase?: PhrasePhase): Promise<Phrase[]> {
    const rows = await query<PhraseRow>(
      this.db,
      'SELECT * FROM phrases WHERE $1::phrase_phase IS NULL OR phase = $1 ORDER BY phase, tone, created_at',
      [phase ?? null],
    );
    return rows.map(toEntity);
  }

  async create(phrase: Phrase): Promise<void> {
    const p = phrase.toJSON();
    await query(this.db, 'INSERT INTO phrases (id, phase, tone, behavior_id, text, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [
      p.id,
      p.phase,
      p.tone,
      p.behaviorId,
      p.text,
      p.createdAt,
    ]);
  }

  async update(phrase: Phrase): Promise<void> {
    const p = phrase.toJSON();
    await query(this.db, 'UPDATE phrases SET phase = $2, tone = $3, behavior_id = $4, text = $5 WHERE id = $1', [
      p.id,
      p.phase,
      p.tone,
      p.behaviorId,
      p.text,
    ]);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM phrases WHERE id = $1', [id]);
  }
}
