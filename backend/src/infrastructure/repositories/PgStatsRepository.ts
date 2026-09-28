import { CharacterStats, IStatsRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface StatsRow {
  character_id: string;
  seasons: number;
  finished: number;
  wins: number;
  wins_as_traitor: number;
  wins_as_faithful: number;
  prize_won: number;
  times_traitor: number;
  times_recruited: number;
  banished: number;
  murdered: number;
  withdrawn: number;
  finals: number;
  votes_received: number;
  votes_cast: number;
  votes_on_traitors: number;
  shields: number;
  avg_days: number;
}

/** Estatísticas agregadas a partir do histórico das temporadas (só as que já começaram). */
export class PgStatsRepository implements IStatsRepository {
  constructor(private readonly db: Queryable) {}

  async characterStats(characterIds: readonly string[]): Promise<CharacterStats[]> {
    if (characterIds.length === 0) return [];
    const rows = await query<StatsRow>(
      this.db,
      `WITH p AS (
         SELECT pl.*, s.status AS season_status, ed.number AS eliminated_day,
                (SELECT max(d.number) FROM days d WHERE d.season_id = pl.season_id) AS season_days
           FROM players pl
           JOIN seasons s ON s.id = pl.season_id
           LEFT JOIN days ed ON ed.id = pl.eliminated_day_id
          WHERE pl.character_id = ANY($1::uuid[]) AND s.status <> 'SETUP'
       )
       SELECT p.character_id,
              count(*)::int                                                               AS seasons,
              count(*) FILTER (WHERE p.season_status = 'FINISHED')::int                   AS finished,
              count(w.player_id)::int                                                     AS wins,
              count(w.player_id) FILTER (WHERE p.role = 'TRAITOR')::int                   AS wins_as_traitor,
              count(w.player_id) FILTER (WHERE p.role = 'FAITHFUL')::int                  AS wins_as_faithful,
              COALESCE(sum(w.prize_share), 0)::float                                      AS prize_won,
              count(*) FILTER (WHERE p.role = 'TRAITOR')::int                             AS times_traitor,
              count(*) FILTER (WHERE p.role = 'TRAITOR' AND NOT p.is_original_traitor)::int AS times_recruited,
              count(*) FILTER (WHERE p.status = 'BANISHED')::int                          AS banished,
              count(*) FILTER (WHERE p.status = 'MURDERED')::int                          AS murdered,
              count(*) FILTER (WHERE p.status = 'WITHDRAWN')::int                         AS withdrawn,
              count(*) FILTER (WHERE p.season_status = 'FINISHED' AND p.status = 'ACTIVE')::int AS finals,
              COALESCE(sum((SELECT count(*) FROM round_table_votes v WHERE v.target_id = p.id)), 0)::int AS votes_received,
              COALESCE(sum((SELECT count(*) FROM round_table_votes v WHERE v.voter_id = p.id)), 0)::int  AS votes_cast,
              COALESCE(sum((SELECT count(*) FROM round_table_votes v JOIN players t ON t.id = v.target_id
                             WHERE v.voter_id = p.id AND t.role = 'TRAITOR')), 0)::int                 AS votes_on_traitors,
              COALESCE(sum((SELECT count(*) FROM mission_rewards r WHERE r.player_id = p.id)), 0)::int AS shields,
              COALESCE(avg(COALESCE(p.eliminated_day, p.season_days)), 0)::float          AS avg_days
         FROM p
         LEFT JOIN season_winners w ON w.player_id = p.id
        GROUP BY p.character_id`,
      [characterIds],
    );
    return rows.map((r) => ({
      characterId: r.character_id,
      seasons: r.seasons,
      finished: r.finished,
      wins: r.wins,
      winsAsTraitor: r.wins_as_traitor,
      winsAsFaithful: r.wins_as_faithful,
      prizeWon: r.prize_won,
      timesTraitor: r.times_traitor,
      timesRecruited: r.times_recruited,
      banished: r.banished,
      murdered: r.murdered,
      withdrawn: r.withdrawn,
      finals: r.finals,
      votesReceived: r.votes_received,
      votesCast: r.votes_cast,
      votesOnTraitors: r.votes_on_traitors,
      shields: r.shields,
      avgDays: r.avg_days,
    }));
  }
}
