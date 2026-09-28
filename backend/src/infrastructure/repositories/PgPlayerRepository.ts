import { Player } from '../../domain/entities';
import { PlayerRole, PlayerStatus } from '../../domain/enums';
import { IPlayerRepository, PlayerFilter } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface PlayerRow {
  id: string;
  season_id: string;
  character_id: string | null;
  is_human: boolean;
  name: string;
  image_url: string | null;
  behavior_ids: string[];
  role: PlayerRole;
  is_original_traitor: boolean;
  status: PlayerStatus;
  eliminated_day_id: string | null;
  created_at: Date;
}

const toEntity = (r: PlayerRow): Player =>
  new Player({
    id: r.id,
    seasonId: r.season_id,
    characterId: r.character_id,
    isHuman: r.is_human,
    name: r.name,
    imageUrl: r.image_url,
    behaviorIds: r.behavior_ids ?? [],
    role: r.role,
    isOriginalTraitor: r.is_original_traitor,
    status: r.status,
    eliminatedDayId: r.eliminated_day_id,
    createdAt: r.created_at,
  });

const SELECT = `
  SELECT p.*,
         COALESCE(ARRAY(SELECT pb.behavior_id FROM player_behaviors pb
                         JOIN behaviors b ON b.id = pb.behavior_id
                        WHERE pb.player_id = p.id ORDER BY lower(b.name)), '{}') AS behavior_ids
    FROM players p`;

export class PgPlayerRepository implements IPlayerRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Player | null> {
    const [row] = await query<PlayerRow>(this.db, `${SELECT} WHERE p.id = $1`, [id]);
    return row ? toEntity(row) : null;
  }

  async findByIds(ids: string[]): Promise<Player[]> {
    if (ids.length === 0) return [];
    const rows = await query<PlayerRow>(this.db, `${SELECT} WHERE p.id = ANY($1::uuid[])`, [ids]);
    return rows.map(toEntity);
  }

  async findBySeason(seasonId: string, filter: PlayerFilter = {}): Promise<Player[]> {
    const rows = await query<PlayerRow>(
      this.db,
      `${SELECT}
        WHERE p.season_id = $1
          AND ($2::player_status IS NULL OR p.status = $2)
          AND ($3::player_role IS NULL OR p.role = $3)
        ORDER BY p.created_at, p.name`,
      [seasonId, filter.status ?? null, filter.role ?? null],
    );
    return rows.map(toEntity);
  }

  async create(player: Player): Promise<void> {
    const p = player.toJSON();
    await query(
      this.db,
      `INSERT INTO players (id, season_id, character_id, name, image_url, role, is_original_traitor,
                            status, eliminated_day_id, created_at, is_human)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [p.id, p.seasonId, p.characterId, p.name, p.imageUrl, p.role, p.isOriginalTraitor,
       p.status, p.eliminatedDayId, p.createdAt, p.isHuman],
    );
    await this.saveBehaviors(p.id, p.behaviorIds);
  }

  async update(player: Player): Promise<void> {
    const p = player.toJSON();
    await query(
      this.db,
      `UPDATE players
          SET character_id = $2, name = $3, image_url = $4, role = $5, is_original_traitor = $6,
              status = $7, eliminated_day_id = $8
        WHERE id = $1`,
      [p.id, p.characterId, p.name, p.imageUrl, p.role, p.isOriginalTraitor, p.status, p.eliminatedDayId],
    );
    await this.saveBehaviors(p.id, p.behaviorIds);
  }

  async updateMany(players: Player[]): Promise<void> {
    for (const player of players) await this.update(player);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM players WHERE id = $1', [id]);
  }

  private async saveBehaviors(playerId: string, behaviorIds: string[]): Promise<void> {
    await query(this.db, 'DELETE FROM player_behaviors WHERE player_id = $1', [playerId]);
    if (behaviorIds.length === 0) return;
    await query(this.db, 'INSERT INTO player_behaviors (player_id, behavior_id) SELECT $1, unnest($2::uuid[])', [playerId, behaviorIds]);
  }
}
