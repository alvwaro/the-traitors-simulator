import { IJobQueue, JobPayload } from '../ports/IJobQueue';

/** Quem sabe fazer um tipo de trabalho (Command): um por tipo, registrados no worker. */
export interface JobHandler {
  readonly type: string;
  handle(payload: JobPayload): Promise<void>;
}

export interface JobWorkerOptions {
  /** Espera entre as buscas quando a fila está vazia. */
  pollMs: number;
  log?: (message: string) => void;
}

/**
 * Processa a fila: pega o próximo trabalho vencido, chama o handler do tipo e marca como feito
 * (ou como falho, para nova tentativa). Vários workers podem rodar juntos, em processos diferentes.
 */
export class JobWorker {
  private readonly handlers: ReadonlyMap<string, JobHandler>;
  private running = false;
  private timer?: NodeJS.Timeout;
  private current: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly queue: IJobQueue,
    handlers: readonly JobHandler[],
    private readonly options: JobWorkerOptions,
  ) {
    this.handlers = new Map(handlers.map((h) => [h.type, h]));
  }

  /** Roda um trabalho, se houver; devolve se rodou algum. */
  async runNext(): Promise<boolean> {
    const job = await this.queue.claim();
    if (!job) return false;
    const handler = this.handlers.get(job.type);
    try {
      if (!handler) throw new Error(`Nenhum handler para o trabalho "${job.type}"`);
      await handler.handle(job.payload);
      await this.queue.complete(job.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.options.log?.(`[jobs] ${job.type} #${job.id} falhou (tentativa ${job.attempts} de ${job.maxAttempts}): ${message}`);
      await this.queue.fail(job, message);
    }
    return true;
  }

  /** Processa tudo que está vencido agora; devolve quantos trabalhos rodou. */
  async drain(): Promise<number> {
    let done = 0;
    while (await this.runNext()) done++;
    return done;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.current = this.drain()
        .catch((err: unknown) => this.options.log?.(`[jobs] erro ao ler a fila: ${err instanceof Error ? err.message : String(err)}`))
        .finally(() => {
          if (this.running) this.timer = setTimeout(loop, this.options.pollMs);
        });
    };
    loop();
  }

  /** Para de buscar trabalhos e espera o que estiver rodando terminar. */
  async stop(): Promise<void> {
    this.running = false;
    clearTimeout(this.timer);
    await this.current;
  }
}
