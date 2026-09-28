import { Behavior } from '../entities';

export interface IBehaviorRepository {
  findById(id: string): Promise<Behavior | null>;
  /** Retorna na mesma ordem dos ids informados (ignora os inexistentes). */
  findByIds(ids: readonly string[]): Promise<Behavior[]>;
  findAll(): Promise<Behavior[]>;
  create(behavior: Behavior): Promise<void>;
  update(behavior: Behavior): Promise<void>;
  delete(id: string): Promise<void>;
}
