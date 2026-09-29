/**
 * Limite de requisições por chave (ex.: IP) numa janela deslizante.
 * O armazenamento padrão é em memória: cada processo conta as suas. Com várias instâncias, troque por um
 * armazenamento compartilhado implementando a mesma interface (o gateway e o backend só dependem dela).
 */
export interface RateLimitRule {
  windowMs: number;
  max: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Quantas ainda cabem na janela. */
  remaining: number;
  /** Segundos até abrir uma vaga (0 quando passou). */
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  /** Tenta ocupar uma vaga agora. Tentativa barrada não é registrada (o histórico nunca passa de `max`). */
  take(key: string, rule: RateLimitRule, now: number): RateLimitVerdict;
}

/** Janela deslizante em memória; limpa as chaves paradas de tempos em tempos para o mapa não crescer para sempre. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly maxKeys = 10_000) {}

  take(key: string, { windowMs, max }: RateLimitRule, now: number): RateLimitVerdict {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const allowed = recent.length < max;
    if (allowed) recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.sweep(windowMs, now);
    return {
      allowed,
      remaining: max - recent.length,
      retryAfterSeconds: allowed ? 0 : Math.ceil((recent[0] + windowMs - now) / 1000),
    };
  }

  private sweep(windowMs: number, now: number): void {
    for (const [key, times] of this.hits) if (times.every((t) => now - t >= windowMs)) this.hits.delete(key);
  }
}

/** Uma regra (máximo por janela) aplicada sobre um armazenamento. */
export class RateLimiter {
  constructor(
    private readonly rule: RateLimitRule,
    private readonly store: RateLimitStore = new MemoryRateLimitStore(),
  ) {}

  check(key: string, now = Date.now()): RateLimitVerdict {
    return this.store.take(key, this.rule, now);
  }
}
