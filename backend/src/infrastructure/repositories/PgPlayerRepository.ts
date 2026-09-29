import { Player } from '../../domain/entities';
import { PlayerRole, PlayerStatus } from '../../domain/enums';
import { IPlayerRepository, PlayerFilter } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query, queryOne } from '../database/query';
import { PLAYER_BEHAVIORS } from './rows';

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

const SELECT = `SELECT p.*, ${PLAYER_BEHAVIORS.column('p')} FROM players p`;

export class PgPlayerRepository implements IPlayerRepository {
  constructor(private readonly db: Queryable) {}

  findById(id: string): Promise<Player | null> {
    return queryOne(this.db, `${SELECT} WHERE p.id = $1`, [id], toEntity);
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
    await PLAYER_BEHAVIORS.replace(this.db, p.id, p.behaviorIds);
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
    await PLAYER_BEHAVIORS.replace(this.db, p.id, p.behaviorIds);
  }

  async updateMany(players: Player[]): Promise<void> {
    for (const player of players) await this.update(player);
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM players WHERE id = $1', [id]);
  }
}
