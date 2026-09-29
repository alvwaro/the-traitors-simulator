import { Pool } from 'pg';
import { Queryable } from './connection';
import { query, translateDbError } from './query';

/** O banco responde? (usado pela checagem de prontidão do balanceador; lança erro se não). */
export async function pingDatabase(db: Queryable): Promise<void> {
  await query(db, 'SELECT 1');
}

/**
 * Confere na subida do servidor se o banco responde e se as migrações foram aplicadas.
 * Não derruba a API: só explica o problema no terminal.
 */
export async function checkDatabase(pool: Pool): Promise<void> {
  try {
    const { rows } = await pool.query<{ ok: boolean }>(`SELECT to_regclass('public.characters') IS NOT NULL AS ok`);
    if (rows[0]?.ok) console.log('[banco] Conectado e com as migrações aplicadas.');
    else console.warn('[banco] Conectado, mas as tabelas não existem. Rode: npm run db:migrate');
  } catch (err) {
    const translated = translateDbError(err);
    console.error(`[banco] ${translated instanceof Error ? translated.message : String(err)}`);
  }
}
