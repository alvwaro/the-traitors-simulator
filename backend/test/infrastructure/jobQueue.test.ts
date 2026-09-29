import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobWorker, type JobHandler } from '../../src/application/jobs/JobWorker';
import { MAINTENANCE_SCHEDULE, PruneFinishedJobs, PurgeExpiredSessions } from '../../src/application/jobs/maintenance';
import { Scheduler } from '../../src/application/jobs/Scheduler';
import { pool } from '../../src/infrastructure/database/connection';
import { PgJobQueue } from '../../src/infrastructure/queue/PgJobQueue';
import { createRepositories } from '../../src/infrastructure/repositories';

const queue = new PgJobQueue(pool);

async function statusOf(type: string): Promise<{ status: string; attempts: number; last_error: string | null }[]> {
  const { rows } = await pool.query('SELECT status, attempts, last_error FROM jobs WHERE type = $1 ORDER BY id', [type]);
  return rows;
}

beforeEach(async () => {
  await pool.query('DELETE FROM jobs');
});

describe('fila de trabalhos no Postgres', () => {
  it('entrega cada trabalho uma vez, na ordem, e marca como feito', async () => {
    await queue.enqueue({ type: 'teste.a', payload: { n: 1 } });
    await queue.enqueue({ type: 'teste.a', payload: { n: 2 } });
    const first = await queue.claim();
    const second = await queue.claim();
    expect([first?.payload, second?.payload]).toEqual([{ n: 1 }, { n: 2 }]);
    expect(first).toMatchObject({ type: 'teste.a', attempts: 1, maxAttempts: 5 });
    expect(await queue.claim()).toBeNull();

    await queue.complete(first!.id);
    expect((await statusOf('teste.a')).map((j) => j.status)).toEqual(['done', 'running']);
  });

  it('não duplica trabalhos com a mesma chave e respeita o horário de início', async () => {
    await queue.enqueue({ type: 'teste.b', dedupeKey: 'b:1' });
    await queue.enqueue({ type: 'teste.b', dedupeKey: 'b:1' });
    await queue.enqueue({ type: 'teste.b', runAt: new Date(Date.now() + 60_000) });
    expect(await statusOf('teste.b')).toHaveLength(2);
    expect(await queue.claim()).not.toBeNull();
    expect(await queue.claim()).toBeNull();
  });

  it('tenta de novo mais tarde e desiste depois do máximo de tentativas', async () => {
    await queue.enqueue({ type: 'teste.c', maxAttempts: 2 });
    const job = (await queue.claim())!;
    await queue.fail(job, 'deu ruim');
    expect(await statusOf('teste.c')).toEqual([{ status: 'queued', attempts: 1, last_error: 'deu ruim' }]);
    expect(await queue.claim()).toBeNull();

    // A espera passou: volta a ser entregue; na última tentativa, fica como falho.
    await pool.query("UPDATE jobs SET run_at = now() WHERE type = 'teste.c'");
    const retry = (await queue.claim())!;
    expect(retry.attempts).toBe(2);
    await queue.fail(retry, 'de novo');
    expect(await statusOf('teste.c')).toEqual([{ status: 'failed', attempts: 2, last_error: 'de novo' }]);
  });

  it('recupera o trabalho de um worker que caiu no meio', async () => {
    await queue.enqueue({ type: 'teste.d' });
    await queue.claim();
    expect(await queue.claim()).toBeNull();
    await pool.query("UPDATE jobs SET locked_at = now() - interval '1 hour' WHERE type = 'teste.d'");
    expect((await queue.claim())?.attempts).toBe(2);
  });

  it('dois workers ao mesmo tempo nunca pegam o mesmo trabalho', async () => {
    for (let i = 0; i < 6; i++) await queue.enqueue({ type: 'teste.e', payload: { i } });
    const claimed = await Promise.all(Array.from({ length: 8 }, () => queue.claim()));
    const ids = claimed.flatMap((job) => (job ? [job.id] : []));
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it('apaga só os concluídos antigos', async () => {
    await queue.enqueue({ type: 'teste.f' });
    await queue.enqueue({ type: 'teste.f' });
    const old = (await queue.claim())!;
    await queue.complete(old.id);
    await pool.query("UPDATE jobs SET finished_at = now() - interval '30 days' WHERE id = $1", [old.id]);
    expect(await queue.prune(new Date(Date.now() - 24 * 60 * 60 * 1000))).toBe(1);
    expect(await statusOf('teste.f')).toHaveLength(1);
  });
});

describe('worker e agendador', () => {
  it('chama o handler de cada tipo e registra falhas (inclusive de tipo desconhecido)', async () => {
    const handled: unknown[] = [];
    const ok: JobHandler = { type: 'teste.ok', handle: async (payload) => void handled.push(payload) };
    const broken: JobHandler = { type: 'teste.erro', handle: async () => Promise.reject(new Error('quebrou')) };
    const log = vi.fn();
    const worker = new JobWorker(queue, [ok, broken], { pollMs: 10, log });
    await queue.enqueue({ type: 'teste.ok', payload: { oi: true } });
    await queue.enqueue({ type: 'teste.erro' });
    await queue.enqueue({ type: 'teste.sem-handler' });

    expect(await worker.drain()).toBe(3);
    expect(handled).toEqual([{ oi: true }]);
    expect((await statusOf('teste.ok'))[0].status).toBe('done');
    expect((await statusOf('teste.erro'))[0]).toMatchObject({ status: 'queued', last_error: 'quebrou' });
    expect((await statusOf('teste.sem-handler'))[0].last_error).toMatch(/Nenhum handler/);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('processa a fila em segundo plano até ser parado', async () => {
    const handle = vi.fn(async () => undefined);
    const worker = new JobWorker(queue, [{ type: 'teste.bg', handle }], { pollMs: 10 });
    worker.start();
    worker.start();
    await queue.enqueue({ type: 'teste.bg' });
    await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(1));
    await worker.stop();
    await queue.enqueue({ type: 'teste.bg' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('agenda cada trabalho periódico uma vez por janela de tempo', async () => {
    let now = Date.parse('2026-09-29T10:15:00Z');
    const scheduler = new Scheduler(queue, MAINTENANCE_SCHEDULE, () => now);
    await scheduler.tick();
    await scheduler.tick();
    expect(await statusOf('sessions.purge-expired')).toHaveLength(1);
    expect(await statusOf('jobs.prune')).toHaveLength(1);
    now += 60 * 60 * 1000;
    await scheduler.tick();
    expect(await statusOf('sessions.purge-expired')).toHaveLength(2);
    expect(await statusOf('jobs.prune')).toHaveLength(1);
  });

  it('manutenção: apaga as sessões vencidas e o histórico antigo da fila', async () => {
    const userId = randomUUID();
    await pool.query("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, 'x', 'FAN')", [userId, `fila${Date.now().toString(36)}`]);
    await pool.query("INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() - interval '1 day'), ($3, $2, now() + interval '1 day')", [
      'a'.repeat(64),
      userId,
      'b'.repeat(64),
    ]);
    await new PurgeExpiredSessions(createRepositories(pool)).handle();
    const { rows } = await pool.query('SELECT token_hash FROM user_sessions WHERE user_id = $1', [userId]);
    expect(rows).toEqual([{ token_hash: 'b'.repeat(64) }]);

    await queue.enqueue({ type: 'teste.velho' });
    const done = (await queue.claim())!;
    await queue.complete(done.id);
    await new PruneFinishedJobs(queue, () => Date.now() + 8 * 24 * 60 * 60 * 1000).handle();
    expect(await statusOf('teste.velho')).toHaveLength(0);
  });
});
