import { Character } from '../entities';

export interface ICharacterRepository {
  findById(id: string): Promise<Character | null>;
  /** Retorna na mesma ordem dos ids informados (ignora os inexistentes). */
  findByIds(ids: readonly string[]): Promise<Character[]>;
  /** O personagem dessa pessoa com esse nome (sem diferenciar maiúsculas). */
  findByName(ownerId: string, name: string): Promise<Character | null>;
  /** Personagens de uma pessoa (Minha Área). */
  findAll(ownerId: string, search?: string): Promise<Character[]>;
  create(character: Character): Promise<void>;
  update(character: Character): Promise<void>;
  delete(id: string): Promise<void>;
}
