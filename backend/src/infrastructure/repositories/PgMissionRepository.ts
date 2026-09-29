import { Mission } from '../../domain/entities';
import { RewardType } from '../../domain/enums';
import { IMissionRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { groupBy, insertMany, query } from '../database/query';

interface MissionRow {
  id: string;
  day_id: string;
  name: string;
  description: string | null;
  prize_available: string | null;
  created_at: Date;
}

interface RewardRow {
  id: string;
  mission_id: string;
  player_id: string;
  reward_type: RewardType;
}

export class PgMissionRepository implements IMissionRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Mission | null> {
    const rows = await query<MissionRow>(this.db, 'SELECT * FROM missions WHERE id = $1', [id]);
    const [mission] = await this.hydrate(rows);
    return mission ?? null;
  }

  async findByDay(dayId: string): Promise<Mission[]> {
    const rows = await query<MissionRow>(this.db, 'SELECT * FROM missions WHERE day_id = $1 ORDER BY created_at', [dayId]);
    return this.hydrate(rows);
  }

  async countBySeason(seasonId: string): Promise<number> {
    const [row] = await query<{ total: number }>(
      this.db,
      'SELECT count(*)::int AS total FROM missions m JOIN days d ON d.id = m.day_id WHERE d.season_id = $1',
      [seasonId],
    );
    return row?.total ?? 0;
  }

  async create(mission: Mission): Promise<void> {
    const m = mission.toJSON();
    await query(
      this.db,
      `INSERT INTO missions (id, day_id, name, description, prize_available, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [m.id, m.dayId, m.name, m.description, m.prizeAvailable, m.createdAt],
    );
    await insertMany(this.db, 'mission_rewards', ['id', 'mission_id', 'player_id', 'reward_type'], m.rewards.map((r) => [r.id, r.missionId, r.playerId, r.rewardType]));
  }

  async findShieldedPlayerIds(dayId: string): Promise<string[]> {
    const rows = await query<{ player_id: string }>(
      this.db,
      `SELECT DISTINCT mr.player_id
         FROM mission_rewards mr
         JOIN missions m ON m.id = mr.mission_id
        WHERE m.day_id = $1 AND mr.reward_type = 'SHIELD'`,
      [dayId],
    );
    return rows.map((r) => r.player_id);
  }

  private async hydrate(rows: MissionRow[]): Promise<Mission[]> {
    if (rows.length === 0) return [];
    const rewards = await query<RewardRow>(
      this.db,
      'SELECT * FROM mission_rewards WHERE mission_id = ANY($1::uuid[]) ORDER BY created_at',
      [rows.map((r) => r.id)],
    );
    const byMission = groupBy(rewards, (w) => w.mission_id);
    return rows.map(
      (r) =>
        new Mission({
          id: r.id,
          dayId: r.day_id,
          name: r.name,
          description: r.description,
          prizeAvailable: r.prize_available === null ? null : Number(r.prize_available),
          createdAt: r.created_at,
          rewards: (byMission.get(r.id) ?? []).map((w) => ({ id: w.id, missionId: w.mission_id, playerId: w.player_id, rewardType: w.reward_type })),
        }),
    );
  }
}
