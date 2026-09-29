import { TraitorMeeting } from '../../domain/entities';
import { MurderOutcome, RecruitmentOutcome } from '../../domain/enums';
import { ITraitorMeetingRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { groupBy, insertMany, query } from '../database/query';

interface MeetingRow {
  id: string;
  day_id: string;
  notes: string | null;
  created_at: Date;
}

interface MurderRow {
  id: string;
  meeting_id: string;
  target_id: string;
  outcome: MurderOutcome;
}

interface RecruitmentRow {
  id: string;
  meeting_id: string;
  target_id: string;
  is_ultimatum: boolean;
  outcome: RecruitmentOutcome;
}

export class PgTraitorMeetingRepository implements ITraitorMeetingRepository {
  constructor(private readonly db: Queryable) {}

  async findByDay(dayId: string): Promise<TraitorMeeting | null> {
    const rows = await query<MeetingRow>(this.db, 'SELECT * FROM traitor_meetings WHERE day_id = $1', [dayId]);
    const [meeting] = await this.hydrate(rows);
    return meeting ?? null;
  }

  async findBySeason(seasonId: string): Promise<TraitorMeeting[]> {
    const rows = await query<MeetingRow>(
      this.db,
      `SELECT tm.* FROM traitor_meetings tm
         JOIN days d ON d.id = tm.day_id
        WHERE d.season_id = $1
        ORDER BY d.number`,
      [seasonId],
    );
    return this.hydrate(rows);
  }

  async create(meeting: TraitorMeeting): Promise<void> {
    const m = meeting.toJSON();
    await query(this.db, 'INSERT INTO traitor_meetings (id, day_id, notes, created_at) VALUES ($1, $2, $3, $4)', [m.id, m.dayId, m.notes, m.createdAt]);
    const murders = m.murder ? [[m.murder.id, m.id, m.murder.targetId, m.murder.outcome]] : [];
    await insertMany(this.db, 'murders', ['id', 'meeting_id', 'target_id', 'outcome'], murders);
    await insertMany(this.db, 'recruitments', ['id', 'meeting_id', 'target_id', 'is_ultimatum', 'outcome'], m.recruitments.map((r) => [r.id, m.id, r.targetId, r.isUltimatum, r.outcome]));
  }

  private async hydrate(rows: MeetingRow[]): Promise<TraitorMeeting[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const murders = groupBy(await query<MurderRow>(this.db, 'SELECT * FROM murders WHERE meeting_id = ANY($1::uuid[])', [ids]), (m) => m.meeting_id);
    const recruitments = groupBy(
      await query<RecruitmentRow>(this.db, 'SELECT * FROM recruitments WHERE meeting_id = ANY($1::uuid[]) ORDER BY created_at', [ids]),
      (x) => x.meeting_id,
    );
    return rows.map((r) => {
      const murder = murders.get(r.id)?.[0];
      return new TraitorMeeting({
        id: r.id,
        dayId: r.day_id,
        notes: r.notes,
        createdAt: r.created_at,
        murder: murder ? { id: murder.id, targetId: murder.target_id, outcome: murder.outcome } : null,
        recruitments: (recruitments.get(r.id) ?? []).map((x) => ({ id: x.id, targetId: x.target_id, isUltimatum: x.is_ultimatum, outcome: x.outcome })),
      });
    });
  }
}
