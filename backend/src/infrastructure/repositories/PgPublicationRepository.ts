import { Publication, PublicationArea, PublicationKind, PublicationSource, PublishedSnapshot } from '../../domain/entities';
import { IPublicationRepository, PublicationFilter } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query, queryOne } from '../database/query';

interface PublicationRow {
  id: string;
  kind: PublicationKind;
  area: PublicationArea;
  publisher_id: string | null;
  season_id: string | null;
  cast_id: string | null;
  character_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  snapshot: PublishedSnapshot | null;
  published_at: Date;
}

const toEntity = (r: PublicationRow): Publication =>
  new Publication({
    id: r.id,
    kind: r.kind,
    area: r.area,
    publisherId: r.publisher_id,
    seasonId: r.season_id,
    castId: r.cast_id,
    characterId: r.character_id,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    snapshot: r.snapshot,
    publishedAt: r.published_at,
  });

/** Coluna que liga a publicação à origem, por tipo. */
const SOURCE_COLUMN = { SEASON: 'season_id', CAST: 'cast_id', CHARACTER: 'character_id' } as const;

function sourceId(source: PublicationSource): string {
  switch (source.kind) {
    case 'SEASON':
      return source.seasonId;
    case 'CAST':
      return source.castId;
    case 'CHARACTER':
      return source.characterId;
  }
}

export class PgPublicationRepository implements IPublicationRepository {
  constructor(private readonly db: Queryable) {}

  findById(id: string): Promise<Publication | null> {
    return queryOne(this.db, 'SELECT * FROM publications WHERE id = $1', [id], toEntity);
  }

  findBySource(source: PublicationSource): Promise<Publication | null> {
    return queryOne(this.db, `SELECT * FROM publications WHERE ${SOURCE_COLUMN[source.kind]} = $1`, [sourceId(source)], toEntity);
  }

  async findAll(filter: PublicationFilter = {}): Promise<Publication[]> {
    const rows = await query<PublicationRow>(
      this.db,
      `SELECT * FROM publications
        WHERE ($1::publication_area IS NULL OR area = $1)
          AND ($2::publication_kind IS NULL OR kind = $2)
          AND ($3::uuid IS NULL OR publisher_id = $3)
        ORDER BY published_at DESC`,
      [filter.area ?? null, filter.kind ?? null, filter.publisherId ?? null],
    );
    return rows.map(toEntity);
  }

  async publisherNames(userIds: readonly string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await query<{ id: string; username: string }>(this.db, 'SELECT id, username FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    return new Map(rows.map((r) => [r.id, r.username]));
  }

  async save(publication: Publication): Promise<void> {
    const p = publication.toJSON();
    await query(
      this.db,
      `INSERT INTO publications (id, kind, area, publisher_id, season_id, cast_id, character_id, name, description, image_url, snapshot, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name, description = EXCLUDED.description, image_url = EXCLUDED.image_url,
              snapshot = EXCLUDED.snapshot, published_at = EXCLUDED.published_at`,
      [
        p.id,
        p.kind,
        p.area,
        p.publisherId,
        p.seasonId,
        p.castId,
        p.characterId,
        p.name,
        p.description,
        p.imageUrl,
        p.snapshot === null ? null : JSON.stringify(p.snapshot),
        p.publishedAt,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    await query(this.db, 'DELETE FROM publications WHERE id = $1', [id]);
  }
}
