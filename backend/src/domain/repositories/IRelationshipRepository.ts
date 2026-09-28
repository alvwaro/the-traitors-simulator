import { RelationshipProps } from '../simulation/RelationshipMatrix';

export interface IRelationshipRepository {
  findBySeason(seasonId: string): Promise<RelationshipProps[]>;
  /** Insere ou atualiza os pares informados. */
  saveMany(seasonId: string, relationships: readonly RelationshipProps[]): Promise<void>;
  deleteBySeason(seasonId: string): Promise<void>;
}
