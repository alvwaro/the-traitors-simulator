import { IJobQueue, JobPayload, JobRequest, QueuedJob } from '../../application/ports/IJobQueue';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

/** Quanto tempo um trabalho pode ficar "rodando" antes de ser considerado abandonado (worker que caiu). */
const STUCK_AFTER_SECONDS = 300;
/** Espera antes da próxima tentativa: 2^tentativas segundos, até 1 hora. */
const MAX_BACKOFF_SECONDS = 3600;

interface JobRow {
  id: string;
  type: string;
  payload: JobPayload;
  attempts: number;
  max_attempts: number;
}

/** Fila no Postgres: SKIP LOCKED faz vários workers dividirem o trabalho sem pegar o mesmo item. */
export class PgJobQueue implements IJobQueue {
  constructor(private readonly db: Queryable) {}

  async enqueue(job: JobRequest): Promise<void> {
    await query(
      this.db,
      `INSERT INTO jobs (type, payload, run_at, dedupe_key, max_attempts)
       VALUES ($1, $2, COALESCE($3, now()), $4, $5)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      [job.type, JSON.stringify(job.payload ?? {}), job.runAt ?? null, job.dedupeKey ?? null, job.maxAttempts ?? 5],
    );
  }

  async claim(): Promise<QueuedJob | null> {
    const [row] = await query<JobRow>(
      this.db,
      `UPDATE jobs SET status = 'running', attempts = attempts + 1, locked_at = now()
        WHERE id = (
          SELECT id FROM jobs
           WHERE (status = 'queued' AND run_at <= now())
              OR (status = 'running' AND locked_at < now() - make_interval(secs => $1))
           ORDER BY run_at, id
           LIMIT 1
           FOR UPDATE SKIP LOCKED)
        RETURNING id, type, payload, attempts, max_attempts`,
      [STUCK_AFTER_SECONDS],
    );
    return row ? { id: String(row.id), type: row.type, payload: row.payload ?? {}, attempts: row.attempts, maxAttempts: row.max_attempts } : null;
  }

  async complete(id: string): Promise<void> {
    await query(this.db, "UPDATE jobs SET status = 'done', finished_at = now(), locked_at = NULL, last_error = NULL WHERE id = $1", [id]);
  }

  async fail(job: QueuedJob, error: string): Promise<void> {
    if (job.attempts >= job.maxAttempts) {
      await query(this.db, "UPDATE jobs SET status = 'failed', finished_at = now(), locked_at = NULL, last_error = $2 WHERE id = $1", [job.id, error.slice(0, 2000)]);
      return;
    }
    const delay = Math.min(MAX_BACKOFF_SECONDS, 2 ** job.attempts);
    await query(
      this.db,
      "UPDATE jobs SET status = 'queued', locked_at = NULL, last_error = $2, run_at = now() + make_interval(secs => $3) WHERE id = $1",
      [job.id, error.slice(0, 2000), delay],
    );
  }

  async prune(finishedBefore: Date): Promise<number> {
    const rows = await query<{ id: string }>(this.db, "DELETE FROM jobs WHERE status = 'done' AND finished_at < $1 RETURNING id", [finishedBefore]);
    return rows.length;
  }
}
