import { Season } from '../entities';

export interface FindOptions {
  /** Trava a linha até o fim da transação (SELECT ... FOR UPDATE). */
  forUpdate?: boolean;
}

export interface ISeasonRepository {
  findById(id: string, options?: FindOptions): Promise<Season | null>;
  /** Temporadas de uma pessoa (Minha Área). */
  findAll(ownerId: string): Promise<Season[]>;
  findByIds(ids: readonly string[]): Promise<Season[]>;
  create(season: Season): Promise<void>;
  update(season: Season): Promise<void>;
  delete(id: string): Promise<void>;
}
