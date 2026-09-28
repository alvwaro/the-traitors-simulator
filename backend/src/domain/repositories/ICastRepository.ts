import { Cast } from '../entities';
import { RelationshipProps } from '../simulation/RelationshipMatrix';

export interface ICastRepository {
  findById(id: string): Promise<Cast | null>;
  /** Casts de uma pessoa (Minha Área). */
  findAll(ownerId: string): Promise<Cast[]>;
  /** Persiste o cast com os membros (cast_members). */
  create(cast: Cast): Promise<void>;
  /** Atualiza dados e substitui os membros. */
  update(cast: Cast): Promise<void>;
  delete(id: string): Promise<void>;
  /** Relacionamentos entre personagens do cast (fromId/toId são ids de personagem). */
  findRelationships(castId: string): Promise<RelationshipProps[]>;
  saveRelationship(castId: string, relationship: RelationshipProps): Promise<void>;
  deleteRelationship(castId: string, fromId: string, toId: string): Promise<void>;
}
