import { IJobQueue } from '../ports/IJobQueue';

/** Trabalho que se repete a cada intervalo. */
export interface RecurringJob {
  type: string;
  everyMs: number;
}

/**
 * Agenda os trabalhos periódicos. Cada janela de tempo vira um trabalho com chave única ("tipo:janela"),
 * então vários workers agendando ao mesmo tempo não duplicam nada.
 */
export class Scheduler {
  constructor(
    private readonly queue: IJobQueue,
    private readonly jobs: readonly RecurringJob[],
    private readonly now: () => number = Date.now,
  ) {}

  async tick(): Promise<void> {
    const now = this.now();
    for (const job of this.jobs) {
      const slot = Math.floor(now / job.everyMs);
      await this.queue.enqueue({ type: job.type, dedupeKey: `${job.type}:${slot}`, runAt: new Date(slot * job.everyMs), maxAttempts: 3 });
    }
  }
}
