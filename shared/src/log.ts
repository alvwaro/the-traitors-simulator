import { looksLikeUuid } from './api/matcher';

/** Tamanho máximo de um valor no log (em caracteres) antes de ser cortado. */
export const LOG_VALUE_MAX = 200;

export const LOG_TRUNCATED = '…[truncado]';

/** Caracteres de controle (C0, DEL e C1, o que inclui CR e LF) e os separadores de linha/parágrafo do Unicode. */
const LOG_UNSAFE = /[\p{Cc}\p{Zl}\p{Zp}]/gu;

/**
 * Deixa um valor seguro para ir ao log: sem nada que quebre ou forje linhas (log injection) e com tamanho limitado.
 * Aceita qualquer coisa porque o que vem do cliente nem sempre é string (headers repetidos viram lista).
 */
export function sanitizeForLog(value: unknown, max = LOG_VALUE_MAX): string {
  const clean = String(value ?? '').replace(LOG_UNSAFE, '');
  const chars = Array.from(clean);
  return chars.length > max ? chars.slice(0, max).join('') + LOG_TRUNCATED : clean;
}

export interface LoggedError {
  name: string;
  message: string;
  code?: string;
  stack?: string;
}

/** Um erro pronto para o log: mensagem e stack podem repetir dados da requisição, então também passam pelo saneamento. */
export function errorForLog(err: unknown): LoggedError {
  if (!(err instanceof Error)) return { name: 'NonError', message: sanitizeForLog(err) };
  const code = (err as { code?: unknown }).code;
  return {
    name: sanitizeForLog(err.name),
    message: sanitizeForLog(err.message),
    ...(code === undefined ? {} : { code: sanitizeForLog(code) }),
    // O stack é longo por natureza: limite maior, mas as quebras de linha somem do mesmo jeito.
    ...(err.stack ? { stack: sanitizeForLog(err.stack, 4000) } : {}),
  };
}

/** Id da requisição: reaproveita o recebido só se for um UUID (formato seguro para logs e cabeçalhos); senão, cria um. */
export function requestIdFrom(incoming: unknown): string {
  return typeof incoming === 'string' && looksLikeUuid(incoming) ? incoming : crypto.randomUUID();
}
