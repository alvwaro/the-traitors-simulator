/**
 * Torna uma conta dona do site. Só existe na linha de comando: quem tem acesso ao servidor decide.
 * Uso: npm run user:owner -- <usuario>
 */
import { PromoteOwnerUseCase } from '../../application/use-cases/auth/SessionUseCases';
import { pool } from '../database/connection';
import { PgUnitOfWork } from '../database/PgUnitOfWork';

async function main(): Promise<void> {
  const username = process.argv[2]?.trim();
  if (!username) {
    console.error('Uso: npm run user:owner -- <usuario>');
    process.exitCode = 1;
    return;
  }
  const user = await new PromoteOwnerUseCase(new PgUnitOfWork(pool)).execute({ username });
  console.log(`"${user.username}" agora é dono(a) do site. Temporadas, casts e personagens sem dono passaram para essa conta.`);
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
