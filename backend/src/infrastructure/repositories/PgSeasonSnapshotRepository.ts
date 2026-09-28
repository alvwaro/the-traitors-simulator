import { ISeasonSnapshotRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

/** Quantos estados guardar por temporada (os mais antigos são descartados). */
const KEEP = 60;

const DAYS = 'SELECT id FROM days WHERE season_id = $1';
const ROUND_TABLES = `SELECT id FROM round_tables WHERE day_id IN (${DAYS})`;
const MEETINGS = `SELECT id FROM traitor_meetings WHERE day_id IN (${DAYS})`;

/**
 * Tabelas do jogo e como achar as linhas da temporada, na ordem em que precisam ser gravadas de volta
 * (cada uma só depende das anteriores).
 */
const TABLES: readonly [table: string, where: string][] = [
  ['days', 'season_id = $1'],
  ['day_phases', `day_id IN (${DAYS})`],
  ['players', 'season_id = $1'],
  ['player_behaviors', 'player_id IN (SELECT id FROM players WHERE season_id = $1)'],
  ['relationships', 'season_id = $1'],
  ['missions', `day_id IN (${DAYS})`],
  ['mission_rewards', `mission_id IN (SELECT id FROM missions WHERE day_id IN (${DAYS}))`],
  ['prize_transactions', 'season_id = $1'],
  ['round_tables', `day_id IN (${DAYS})`],
  ['round_table_votes', `round_table_id IN (${ROUND_TABLES})`],
  ['endgame_votes', `round_table_id IN (${ROUND_TABLES})`],
  ['traitor_meetings', `day_id IN (${DAYS})`],
  ['murders', `meeting_id IN (${MEETINGS})`],
  ['recruitments', `meeting_id IN (${MEETINGS})`],
  ['season_winners', 'season_id = $1'],
  ['simulation_events', 'season_id = $1'],
];

/** Campos da temporada que o jogo muda (nome, dono e configurações ficam como estão). */
const SEASON_FIELDS = ['status', 'current_day', 'current_phase', 'sim_state', 'finished_at'];

type Snapshot = { season: Record<string, unknown> } & Record<string, Record<string, unknown>[]>;

export class PgSeasonSnapshotRepository implements ISeasonSnapshotRepository {
  constructor(private readonly db: Queryable) {}

  async capture(seasonId: string, label: string): Promise<void> {
    const parts = TABLES.map(([table, where]) => `'${table}', (SELECT coalesce(json_agg(t), '[]'::json) FROM ${table} t WHERE ${where})`);
    await query(
      this.db,
      `INSERT INTO season_snapshots (season_id, label, data)
       SELECT $1, $2, json_build_object('season', (SELECT row_to_json(s) FROM seasons s WHERE id = $1), ${parts.join(', ')})`,
      [seasonId, label.slice(0, 120)],
    );
    await query(
      this.db,
      `DELETE FROM season_snapshots WHERE season_id = $1
         AND seq NOT IN (SELECT seq FROM season_snapshots WHERE season_id = $1 ORDER BY seq DESC LIMIT ${KEEP})`,
      [seasonId],
    );
  }

  async restoreLatest(seasonId: string): Promise<string | null> {
    const [latest] = await query<{ seq: string; label: string; data: Snapshot }>(
      this.db,
      'SELECT seq, label, data FROM season_snapshots WHERE season_id = $1 ORDER BY seq DESC LIMIT 1',
      [seasonId],
    );
    if (!latest) return null;
    const data = latest.data;

    // Apaga o que a temporada tem agora. As mesas redondas saem antes dos jogadores (apontam o banido)
    // e os jogadores antes dos dias (apontam o dia da eliminação); os dias levam o resto junto.
    await query(this.db, `DELETE FROM round_tables WHERE day_id IN (${DAYS})`, [seasonId]);
    await query(this.db, 'DELETE FROM players WHERE season_id = $1', [seasonId]);
    await query(this.db, 'DELETE FROM days WHERE season_id = $1', [seasonId]);
    for (const table of ['relationships', 'prize_transactions', 'season_winners', 'simulation_events']) {
      await query(this.db, `DELETE FROM ${table} WHERE season_id = $1`, [seasonId]);
    }

    // Personagem apagado da biblioteca depois do estado guardado: o jogador fica sem o vínculo.
    const characterIds = data.players.map((p) => p.character_id).filter((id): id is string => typeof id === 'string');
    const existing = new Set(
      (await query<{ id: string }>(this.db, 'SELECT id FROM characters WHERE id = ANY($1::uuid[])', [characterIds])).map((r) => r.id),
    );
    for (const p of data.players) if (p.character_id && !existing.has(p.character_id as string)) p.character_id = null;

    for (const [table] of TABLES) {
      const rows = data[table] ?? [];
      if (rows.length) await query(this.db, `INSERT INTO ${table} SELECT * FROM json_populate_recordset(NULL::${table}, $1::json)`, [JSON.stringify(rows)]);
    }
    const fields = SEASON_FIELDS.join(', ');
    await query(this.db, `UPDATE seasons SET (${fields}) = (SELECT ${fields} FROM json_populate_record(NULL::seasons, $2::json)) WHERE id = $1`, [
      seasonId,
      JSON.stringify(data.season),
    ]);
    await query(this.db, 'DELETE FROM season_snapshots WHERE seq = $1', [latest.seq]);
    return latest.label;
  }

  async count(seasonId: string): Promise<number> {
    const [row] = await query<{ n: number }>(this.db, 'SELECT count(*)::int AS n FROM season_snapshots WHERE season_id = $1', [seasonId]);
    return row?.n ?? 0;
  }
}
