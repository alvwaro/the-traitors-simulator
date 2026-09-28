import { SimulationEvent } from '../../domain/entities';
import { GamePhase, PhraseTone, SimulationEventKind } from '../../domain/enums';
import { ISimulationEventRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface EventRow {
  id: string;
  season_id: string;
  day_id: string;
  phase: GamePhase;
  sequence: number;
  kind: SimulationEventKind;
  tone: PhraseTone | null;
  text: string;
  player_ids: string[];
  is_private: boolean;
  created_at: Date;
}

const toEntity = (r: EventRow): SimulationEvent =>
  new SimulationEvent({
    id: r.id,
    seasonId: r.season_id,
    dayId: r.day_id,
    phase: r.phase,
    sequence: r.sequence,
    kind: r.kind,
    tone: r.tone,
    text: r.text,
    playerIds: r.player_ids,
    isPrivate: r.is_private,
    createdAt: r.created_at,
  });

export class PgSimulationEventRepository implements ISimulationEventRepository {
  constructor(private readonly db: Queryable) {}

  async findByDay(dayId: string): Promise<SimulationEvent[]> {
    const rows = await query<EventRow>(
      this.db,
      `SELECT e.* FROM simulation_events e
         LEFT JOIN day_phases p ON p.day_id = e.day_id AND p.phase = e.phase
        WHERE e.day_id = $1
        ORDER BY p.started_at NULLS LAST, e.sequence`,
      [dayId],
    );
    return rows.map(toEntity);
  }

  async existsFor(dayId: string, phase: GamePhase): Promise<boolean> {
    const [row] = await query<{ found: boolean }>(
      this.db,
      "SELECT EXISTS (SELECT 1 FROM simulation_events WHERE day_id = $1 AND phase = $2 AND kind NOT IN ('PLAYER', 'REACTION')) AS found",
      [dayId, phase],
    );
    return row?.found ?? false;
  }

  async createMany(events: readonly SimulationEvent[]): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((e) => e.toJSON());
    await query(
      this.db,
      `INSERT INTO simulation_events (id, season_id, day_id, phase, sequence, kind, tone, text, player_ids, is_private, created_at)
       SELECT id, season_id, day_id, phase::game_phase, sequence, kind, tone::phrase_tone, text,
              ARRAY(SELECT jsonb_array_elements_text(player_ids))::uuid[], is_private, created_at
         FROM jsonb_to_recordset($1::jsonb) AS x(
              id uuid, season_id uuid, day_id uuid, phase text, sequence int, kind text,
              tone text, text text, player_ids jsonb, is_private boolean, created_at timestamptz)`,
      [
        JSON.stringify(
          rows.map((e) => ({
            id: e.id,
            season_id: e.seasonId,
            day_id: e.dayId,
            phase: e.phase,
            sequence: e.sequence,
            kind: e.kind,
            tone: e.tone,
            text: e.text,
            player_ids: e.playerIds,
            is_private: e.isPrivate,
            created_at: e.createdAt,
          })),
        ),
      ],
    );
  }
}
