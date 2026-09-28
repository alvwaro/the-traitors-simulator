import { Pool } from 'pg';
import { translateDbError } from './query';

/**
 * Confere na subida do servidor se o banco responde e se as migrações foram aplicadas.
 * Não derruba a API: só explica o problema no terminal.
 */
export async function checkDatabase(pool: Pool): Promise<void> {
  try {
    const { rows } = await pool.query<{ ok: boolean }>(`SELECT to_regclass('public.characters') IS NOT NULL AS ok`);
    if (!rows[0]?.ok) console.warn('[banco] Conectado, mas as tabelas não existem. Rode: npm run db:migrate');
    else console.log('[banco] Conectado e com as migrações aplicadas.');
  } catch (err) {
    const translated = translateDbError(err);
    console.error(`[banco] ${translated instanceof Error ? translated.message : String(err)}`);
  }
}
