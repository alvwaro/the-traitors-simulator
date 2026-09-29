import { JobWorker } from '../application/jobs/JobWorker';
import { MAINTENANCE_SCHEDULE, PruneFinishedJobs, PurgeExpiredSessions } from '../application/jobs/maintenance';
import { Scheduler } from '../application/jobs/Scheduler';
import { pool } from '../infrastructure/database/connection';
import { PgJobQueue } from '../infrastructure/queue/PgJobQueue';
import { createRepositories } from '../infrastructure/repositories';
import { env } from '../shared/config/env';

/**
 * Worker: processo separado da API que roda a fila de trabalhos e agenda a manutenção periódica.
 * Pode ter várias cópias (o banco garante que cada trabalho roda uma vez só).
 */
const queue = new PgJobQueue(pool);
const repos = createRepositories(pool);
const worker = new JobWorker(queue, [new PurgeExpiredSessions(repos), new PruneFinishedJobs(queue)], {
  pollMs: env.jobPollMs,
  log: (message) => console.log(message),
});
const scheduler = new Scheduler(queue, MAINTENANCE_SCHEDULE);

const schedule = () => scheduler.tick().catch((err: unknown) => console.error('[jobs] erro ao agendar:', err));
void schedule();
const ticker = setInterval(() => void schedule(), 60_000);
worker.start();
console.log('The Traitors worker rodando (fila de trabalhos no Postgres).');

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} recebido: terminando o trabalho em andamento...`);
  clearInterval(ticker);
  await worker.stop();
  await pool.end();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
