import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** Lista separada por vírgulas (vazia quando a variável não existe). */
function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  /** Cookie de sessão só por HTTPS (ligado em produção). */
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  /** Atrás de um proxy (gateway, Nginx, Render...): usa o IP real do visitante no limite de tentativas. */
  trustProxy: process.env.TRUST_PROXY === 'true',
  /** Origens extras (além do próprio host) que podem enviar POST/PATCH/DELETE, ex.: https://app.site.com */
  allowedOrigins: list('ALLOWED_ORIGINS'),
  /** Tempo para terminar as requisições em andamento ao desligar (deploy, escala do balanceador). */
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000),
  /** Worker de jobs: intervalo entre as buscas por jobs na fila. */
  jobPollMs: Number(process.env.JOB_POLL_MS ?? 1000),
};
