import { normalizeMissionPool, Season } from '../../domain/entities';
import { GamePhase, SeasonMode, SeasonStatus } from '../../domain/enums';
import { FindOptions, ISeasonRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query, queryOne } from '../database/query';

interface SeasonRow {
  id: string;
  name: string;
  cast_id: string | null;
  mode: SeasonMode;
  chaos: number;
  mission_pool: string;
  interaction_limit: number;
  allow_withdrawals: boolean;
  hidden_shield_chance: number | null;
  sim_state: Record<string, unknown>;
  status: SeasonStatus;
  current_day: number | null;
  current_phase: GamePhase | null;
  currency: string;
  initial_prize_pot: string;
  max_prize_pot: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  owner_id: string | null;
}

const toEntity = (r: SeasonRow): Season =>
  new Season({
    id: r.id,
    name: r.name,
    castId: r.cast_id,
    mode: r.mode,
    chaos: r.chaos,
    missionPool: normalizeMissionPool(r.mission_pool),
    interactionLimit: r.interaction_limit,
    withdrawals: r.allow_withdrawals ?? true,
    hiddenShieldChance: r.hidden_shield_chance ?? 0,
    simState: r.sim_state ?? {},
    status: r.status,
    currentDay: r.current_day,
    currentPhase: r.current_phase,
    currency: r.currency,
    initialPrizePot: Number(r.initial_prize_pot),
    maxPrizePot: r.max_prize_pot === null ? null : Number(r.max_prize_pot),
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    ownerId: r.owner_id,
  });

export class PgSeasonRepository implements ISeasonRepository {
  constructor(private readonly db: Queryable) {}

  findById(id: string, options: FindOptions = {}): Promise<Season | null> {
    // FOR UPDATE: trava a linha até o fim da transação (duas ações na mesma temporada não se atropelam).
    const sql = options.forUpdate ? 'SELECT * FROM seasons WHERE id = $1 FOR UPDATE' : 'SELECT * FROM seasons WHERE id = $1';
    return queryOne(this.db, sql, [id], toEntity);
  }

  async findAll(ownerId: string): Promise<Season[]> {
    const rows = await query<SeasonRow>(this.db, 'SELECT * FROM seasons WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
    return rows.map(toEntity);
  }

  async findByIds(ids: readonly string[]): Promise<Season[]> {
    if (ids.length === 0) return [];
    const rows = await query<SeasonRow>(this.db, 'SELECT * FROM seasons WHERE id = ANY($1::uuid[])', [ids]);
    return rows.map(toEntity);
  }

  async create(season: Season): Promise<void> {
    const s = season.toJSON();
    await query(
      this.db,
      `INSERT INTO seasons (id, name, cast_id, status, current_day, current_phase, currency,
                            initial_prize_pot, max_prize_pot, created_at, started_at, finished_at, mode,
                            chaos, mission_pool, sim_state, interaction_limit, owner_id, allow_withdrawals, hidden_shield_chance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [s.id, s.name, s.castId, s.status, s.currentDay, s.currentPhase, s.currency,
       s.initialPrizePot, s.maxPrizePot, s.createdAt, s.startedAt, s.finishedAt, s.mode,
       s.chaos, s.missionPool, JSON.stringify(s.simState), s.interactionLimit, s.ownerId, s.withdrawals, s.hiddenShieldChance],
    );
  }

  async update(season: Season): Promise<void> {
    const s = season.toJSON();
    await query(
      this.db,
      `UPDATE seasons
          SET name = $2, cast_id = $3, status = $4, current_day = $5, current_phase = $6, currency = $7,
              initial_prize_pot = $8, max_prize_pot = $9, started_at = $10, finished_at = $11, mode = $12,
              chaos = $13, mission_pool = $14, sim_state = $15, interaction_limit = $16, allow_withdrawals = $17,
              hidden_shield_chance = $18
        WHERE id = $1`,
      [s.id, s.name, s.castId, s.status, s.currentDay, s.currentPhase, s.currency,
       s.initialPrizePot, s.maxPrizePot, s.startedAt, s.finishedAt, s.mode,
       s.chaos, s.missionPool, JSON.stringify(s.simState), s.interactionLimit, s.withdrawals, s.hiddenShieldChance],
    );
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM seasons WHERE id = $1', [id]);
  }
}
