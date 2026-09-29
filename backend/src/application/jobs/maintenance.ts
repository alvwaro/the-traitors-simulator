import { IJobQueue } from '../ports/IJobQueue';
import { Repositories } from '../ports/IUnitOfWork';
import { JobHandler } from './JobWorker';
import { RecurringJob } from './Scheduler';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Apaga as sessões vencidas (antes era feito a cada login, no caminho do usuário). */
export class PurgeExpiredSessions implements JobHandler {
  readonly type = 'sessions.purge-expired';

  constructor(private readonly repos: Pick<Repositories, 'sessions'>) {}

  handle(): Promise<void> {
    return this.repos.sessions.deleteExpired();
  }
}

/** Some com o histórico dos trabalhos concluídos há mais de uma semana (os que falharam ficam para análise). */
export class PruneFinishedJobs implements JobHandler {
  readonly type = 'jobs.prune';

  constructor(
    private readonly queue: IJobQueue,
    private readonly now: () => number = Date.now,
  ) {}

  async handle(): Promise<void> {
    await this.queue.prune(new Date(this.now() - 7 * DAY));
  }
}

/** Manutenção periódica que o worker agenda sozinho. */
export const MAINTENANCE_SCHEDULE: readonly RecurringJob[] = [
  { type: 'sessions.purge-expired', everyMs: HOUR },
  { type: 'jobs.prune', everyMs: DAY },
];
