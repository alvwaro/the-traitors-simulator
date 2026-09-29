/** Dados de um trabalho (serializáveis em JSON). */
export type JobPayload = Record<string, unknown>;

/** Um trabalho para fazer depois, fora da requisição (no worker). */
export interface JobRequest {
  type: string;
  payload?: JobPayload;
  /** A partir de quando pode rodar (padrão: agora). */
  runAt?: Date;
  /** Chave de unicidade: o mesmo trabalho pedido por várias instâncias entra uma vez só. */
  dedupeKey?: string;
  /** Tentativas antes de desistir (padrão: 5). */
  maxAttempts?: number;
}

export interface QueuedJob {
  id: string;
  type: string;
  payload: JobPayload;
  /** Contando a tentativa atual. */
  attempts: number;
  maxAttempts: number;
}

/**
 * Fila de trabalhos. A implementação atual fica no Postgres (dá para enfileirar na mesma transação do caso de uso);
 * trocar por Redis/SQS é implementar esta interface.
 */
export interface IJobQueue {
  enqueue(job: JobRequest): Promise<void>;
  /** Pega o próximo trabalho vencido (nenhum outro worker pega o mesmo). */
  claim(): Promise<QueuedJob | null>;
  complete(id: string): Promise<void>;
  /** Falhou: volta para a fila com espera crescente ou, depois do máximo de tentativas, fica como falho. */
  fail(job: QueuedJob, error: string): Promise<void>;
  /** Apaga os trabalhos concluídos antes da data; devolve quantos. */
  prune(finishedBefore: Date): Promise<number>;
}
