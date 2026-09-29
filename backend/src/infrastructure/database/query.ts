import { DatabaseError, QueryResultRow } from 'pg';
import { DomainError } from '../../domain/errors/DomainError';
import { AppError, ConflictError, DatabaseUnavailableError } from '../../shared/errors/AppError';
import { Queryable } from './connection';

const UNIQUE_VIOLATIONS: Record<string, string> = {
  players_season_name_uq: 'Já existe um jogador com esse nome na temporada',
  players_season_character_uq: 'Esse personagem já está na temporada',
  characters_owner_name_uq: 'Você já tem um personagem salvo com esse nome',
  casts_owner_name_uq: 'Você já tem um cast salvo com esse nome',
  users_username_uq: 'Esse nome de usuário já está em uso',
  phrases_phase_text_uq: 'Essa frase já está cadastrada',
  behaviors_name_uq: 'Já existe um comportamento com esse nome',
  round_tables_day_sequence_uq: 'Essa mesa redonda já foi registrada',
  traitor_meetings_day_id_key: 'A reunião dos traidores de hoje já foi registrada',
};

const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN']);

/** Executa a query e traduz erros do Postgres para erros da aplicação. */
export async function query<R extends QueryResultRow = QueryResultRow>(
  db: Queryable,
  text: string,
  values: readonly unknown[] = [],
): Promise<R[]> {
  try {
    const result = await db.query<R>(text, [...values]);
    return result.rows;
  } catch (err) {
    throw translateDbError(err);
  }
}

/** A primeira linha, já convertida (null se a consulta não achou nada). */
export async function queryOne<R extends QueryResultRow, T>(db: Queryable, text: string, values: readonly unknown[], map: (row: R) => T): Promise<T | null> {
  const [row] = await query<R>(db, text, values);
  return row ? map(row) : null;
}

/**
 * Várias linhas num único INSERT (em vez de uma ida ao banco por linha). Tabela e colunas vêm sempre do
 * código, nunca do usuário; os valores vão como parâmetros. `suffix` aceita, por exemplo, um ON CONFLICT.
 */
export async function insertMany(db: Queryable, table: string, columns: readonly string[], rows: readonly (readonly unknown[])[], suffix = ''): Promise<void> {
  if (rows.length === 0) return;
  const width = columns.length;
  const tuples = rows.map((_, r) => `(${columns.map((_, c) => `$${r * width + c + 1}`).join(', ')})`);
  await query(db, `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}${suffix}`, rows.flat());
}

/** Agrupa pela chave (ex.: os votos de cada mesa), mantendo a ordem em que vieram. */
export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/** As entidades na ordem dos ids pedidos (as que não existem ficam de fora). */
export function inOrder<T extends { id: string }>(ids: readonly string[], items: readonly T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export function translateDbError(err: unknown): unknown {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && CONNECTION_CODES.has(code)) {
    return new DatabaseUnavailableError('Não foi possível conectar ao banco de dados. Ele está rodando? (npm run db:up)');
  }
  if (!(err instanceof DatabaseError)) return err;

  switch (err.code) {
    case '23505':
      return new ConflictError(UNIQUE_VIOLATIONS[err.constraint ?? ''] ?? `Registro duplicado (${err.constraint})`);
    case '23503':
      return new ConflictError(`Registro relacionado inexistente ou em uso (${err.constraint})`);
    case '23514':
      return new DomainError(`Dados inválidos (${err.constraint})`);
    case '22P02':
      // Texto no lugar de um id (ex.: /characters/abc): é um pedido inválido, não uma falha do servidor.
      return new AppError('Identificador inválido', 400);
    case '28P01':
    case '28000':
      return new DatabaseUnavailableError('O banco recusou usuário/senha. Confira o DATABASE_URL no .env (outro Postgres pode estar usando a mesma porta).');
    case '3D000':
      return new DatabaseUnavailableError('O banco de dados informado no DATABASE_URL não existe.');
    case '42P01':
      return new DatabaseUnavailableError('As tabelas não existem. Rode as migrações: npm run db:migrate');
    case '57P01':
    case '57P03':
      return new DatabaseUnavailableError('O banco de dados está iniciando ou reiniciando. Tente de novo em instantes.');
    default:
      return err;
  }
}
