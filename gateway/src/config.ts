import type { RateLimitRule } from '@traitors/shared';

/** Como escolher a instância do backend para cada requisição. */
export type BalancingStrategyName = 'round-robin' | 'least-connections';

export interface GatewayConfig {
  port: number;
  /** Instâncias do backend (ex.: http://api-1:3000,http://api-2:3000). */
  upstreams: URL[];
  strategy: BalancingStrategyName;
  /** Atrás de outro proxy (balanceador da nuvem): o IP do visitante vem do X-Forwarded-For. */
  trustProxy: boolean;
  /** Origens extras que podem enviar POST/PATCH/DELETE (além do próprio host). */
  allowedOrigins: string[];
  /** Tamanho máximo do corpo das requisições. */
  bodyLimitBytes: number;
  /** Tempo máximo esperando o backend responder. */
  upstreamTimeoutMs: number;
  /** Intervalo da checagem de saúde de cada instância (0 desliga). */
  healthIntervalMs: number;
  /** Limite geral por IP em toda a API (os grupos do manifesto, como o login, têm limites próprios). */
  globalRateLimit: RateLimitRule;
}

type Env = Readonly<Record<string, string | undefined>>;

function numberOf(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} precisa ser um número positivo (veio "${raw}")`);
  return value;
}

function listOf(env: Env, name: string): string[] {
  return (env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function upstreamsOf(env: Env): URL[] {
  const raw = listOf(env, 'UPSTREAMS');
  const urls = (raw.length ? raw : ['http://localhost:3000']).map((item) => new URL(item));
  const invalid = urls.find((url) => url.protocol !== 'http:' && url.protocol !== 'https:');
  if (invalid) throw new Error(`UPSTREAMS aceita só endereços http(s): ${invalid.href}`);
  return urls;
}

function strategyOf(env: Env): BalancingStrategyName {
  const value = env.LB_STRATEGY ?? 'round-robin';
  if (value !== 'round-robin' && value !== 'least-connections') throw new Error(`LB_STRATEGY inválida: ${value}`);
  return value;
}

/** Lê e valida a configuração das variáveis de ambiente (falha logo na subida se algo estiver errado). */
export function loadConfig(env: Env = process.env): GatewayConfig {
  return {
    port: numberOf(env, 'PORT', 8080),
    upstreams: upstreamsOf(env),
    strategy: strategyOf(env),
    trustProxy: env.TRUST_PROXY === 'true',
    allowedOrigins: listOf(env, 'ALLOWED_ORIGINS'),
    bodyLimitBytes: numberOf(env, 'BODY_LIMIT_BYTES', 1024 * 1024),
    upstreamTimeoutMs: numberOf(env, 'UPSTREAM_TIMEOUT_MS', 60_000),
    healthIntervalMs: numberOf(env, 'HEALTH_INTERVAL_MS', 5000),
    globalRateLimit: {
      windowMs: numberOf(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
      max: numberOf(env, 'RATE_LIMIT_MAX', 600),
    },
  };
}
