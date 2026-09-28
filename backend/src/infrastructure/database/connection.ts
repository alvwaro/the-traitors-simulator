import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '../../shared/config/env';

/** Pool (fora de transação) ou client (dentro de transação). */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

export const pool = new Pool({ connectionString: env.databaseUrl, max: env.databasePoolMax });

// Conexão ociosa que cai (ex.: banco reiniciou) não deve derrubar a API.
pool.on('error', (err) => {
  console.error('Erro em conexão ociosa do Postgres:', err.message);
});
