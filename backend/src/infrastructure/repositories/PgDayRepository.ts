import { Day, DayPhase } from '../../domain/entities';
import { GamePhase } from '../../domain/enums';
import { IDayRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query, queryOne } from '../database/query';

interface DayRow {
  id: string;
  season_id: string;
  number: number;
  title: string | null;
  created_at: Date;
}

interface DayPhaseRow {
  id: string;
  day_id: string;
  phase: GamePhase;
  notes: string | null;
  started_at: Date;
  ended_at: Date | null;
}

const toDay = (r: DayRow): Day =>
  new Day({ id: r.id, seasonId: r.season_id, number: r.number, title: r.title, createdAt: r.created_at });

const toPhase = (r: DayPhaseRow): DayPhase =>
  new DayPhase({ id: r.id, dayId: r.day_id, phase: r.phase, notes: r.notes, startedAt: r.started_at, endedAt: r.ended_at });

export class PgDayRepository implements IDayRepository {
  constructor(private readonly db: Queryable) {}

  findById(id: string): Promise<Day | null> {
    return queryOne(this.db, 'SELECT * FROM days WHERE id = $1', [id], toDay);
  }

  findBySeasonAndNumber(seasonId: string, number: number): Promise<Day | null> {
    return queryOne(this.db, 'SELECT * FROM days WHERE season_id = $1 AND number = $2', [seasonId, number], toDay);
  }

  async findBySeason(seasonId: string): Promise<Day[]> {
    const rows = await query<DayRow>(this.db, 'SELECT * FROM days WHERE season_id = $1 ORDER BY number', [seasonId]);
    return rows.map(toDay);
  }

  async create(day: Day): Promise<void> {
    const d = day.toJSON();
    await query(
      this.db,
      'INSERT INTO days (id, season_id, number, title, created_at) VALUES ($1, $2, $3, $4, $5)',
      [d.id, d.seasonId, d.number, d.title, d.createdAt],
    );
  }

  findPhase(dayId: string, phase: GamePhase): Promise<DayPhase | null> {
    return queryOne(this.db, 'SELECT * FROM day_phases WHERE day_id = $1 AND phase = $2', [dayId, phase], toPhase);
  }

  async findPhases(dayId: string): Promise<DayPhase[]> {
    const rows = await query<DayPhaseRow>(this.db, 'SELECT * FROM day_phases WHERE day_id = $1 ORDER BY started_at', [dayId]);
    return rows.map(toPhase);
  }

  async savePhase(phase: DayPhase): Promise<void> {
    const p = phase.toJSON();
    await query(
      this.db,
      `INSERT INTO day_phases (id, day_id, phase, notes, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET notes = EXCLUDED.notes, ended_at = EXCLUDED.ended_at`,
      [p.id, p.dayId, p.phase, p.notes, p.startedAt, p.endedAt],
    );
  }
}
