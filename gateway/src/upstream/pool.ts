import { request } from 'node:http';
import { request as secureRequest } from 'node:https';
import type { BalancingStrategyName } from '../config';

/** Uma instância do backend e o que o gateway sabe dela. */
export interface Upstream {
  readonly url: URL;
  healthy: boolean;
  /** Requisições em andamento nesta instância. */
  active: number;
}

/** Strategy: qual instância saudável recebe a próxima requisição. */
export interface BalancingStrategy {
  pick(candidates: readonly Upstream[]): Upstream | undefined;
}

/** Revezamento: uma de cada vez, em ordem. */
export class RoundRobin implements BalancingStrategy {
  private next = 0;

  pick(candidates: readonly Upstream[]): Upstream | undefined {
    if (candidates.length === 0) return undefined;
    const chosen = candidates[this.next % candidates.length];
    this.next = (this.next + 1) % Number.MAX_SAFE_INTEGER;
    return chosen;
  }
}

/** A que tem menos requisições em andamento (bom quando algumas demoram muito, como "simular até o fim"). */
export class LeastConnections implements BalancingStrategy {
  pick(candidates: readonly Upstream[]): Upstream | undefined {
    return candidates.reduce<Upstream | undefined>((best, u) => (!best || u.active < best.active ? u : best), undefined);
  }
}

export function strategyFor(name: BalancingStrategyName): BalancingStrategy {
  return name === 'least-connections' ? new LeastConnections() : new RoundRobin();
}

/** Pergunta à instância se ela pode receber tráfego (GET /health/ready → 200). */
export function probe(url: URL, timeoutMs: number): Promise<boolean> {
  const target = new URL('/health/ready', url);
  const send = target.protocol === 'https:' ? secureRequest : request;
  return new Promise((resolve) => {
    const req = send(target, { method: 'GET', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
    req.end();
  });
}

/**
 * As instâncias do backend com a saúde de cada uma. A checagem ativa roda de tempos em tempos (a instância
 * que responde 503 ao desligar sai da roda); a passiva tira da roda quem falha ao conectar, até a próxima checagem.
 */
export class UpstreamPool {
  readonly upstreams: Upstream[];
  private timer?: NodeJS.Timeout;

  constructor(
    urls: readonly URL[],
    private readonly strategy: BalancingStrategy,
    private readonly check: (url: URL) => Promise<boolean> = (url) => probe(url, 2000),
  ) {
    this.upstreams = urls.map((url) => ({ url, healthy: true, active: 0 }));
  }

  /** Próxima instância saudável (sem repetir as que já falharam nesta requisição). */
  pick(exclude: ReadonlySet<Upstream> = new Set()): Upstream | undefined {
    return this.strategy.pick(this.upstreams.filter((u) => u.healthy && !exclude.has(u)));
  }

  get hasHealthy(): boolean {
    return this.upstreams.some((u) => u.healthy);
  }

  markDown(upstream: Upstream): void {
    upstream.healthy = false;
  }

  async checkAll(): Promise<void> {
    await Promise.all(
      this.upstreams.map(async (u) => {
        u.healthy = await this.check(u.url);
      }),
    );
  }

  /** Checagem periódica (o timer não segura o processo de pé). */
  startHealthChecks(intervalMs: number): void {
    if (intervalMs <= 0 || this.timer) return;
    this.timer = setInterval(() => void this.checkAll(), intervalMs);
    this.timer.unref();
  }

  stopHealthChecks(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
