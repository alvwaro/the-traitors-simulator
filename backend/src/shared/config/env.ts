import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  /** Cookie de sessão só por HTTPS (ligado em produção). */
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  /** Atrás de um proxy (Render, Railway...): usa o IP real do visitante no limite de tentativas. */
  trustProxy: process.env.TRUST_PROXY === 'true',
};
