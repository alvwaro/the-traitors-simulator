import { Pool } from 'pg';
import { IUnitOfWork, Repositories } from '../../application/ports/IUnitOfWork';
import { createRepositories } from '../repositories';
import { translateDbError } from './query';

export class PgUnitOfWork implements IUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    // Falhas de conexão/autenticação acontecem aqui, antes de qualquer query.
    const client = await this.pool.connect().catch((err: unknown) => {
      throw translateDbError(err);
    });
    try {
      await client.query('BEGIN');
      const result = await work(createRepositories(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
