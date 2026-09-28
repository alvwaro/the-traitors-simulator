import { Publication, PublicationArea, PublicationKind, PublicationSource } from '../entities';

export interface PublicationFilter {
  area?: PublicationArea;
  kind?: PublicationKind;
  publisherId?: string;
}

export interface IPublicationRepository {
  findById(id: string): Promise<Publication | null>;
  /** A publicação já existente da mesma temporada/cast/personagem (republicar atualiza). */
  findBySource(source: PublicationSource): Promise<Publication | null>;
  /** Mais recentes primeiro. */
  findAll(filter?: PublicationFilter): Promise<Publication[]>;
  /** Nome de quem publicou, por id de usuário. */
  publisherNames(userIds: readonly string[]): Promise<Map<string, string>>;
  /** Insere ou atualiza (republicação). */
  save(publication: Publication): Promise<void>;
  delete(id: string): Promise<void>;
}
