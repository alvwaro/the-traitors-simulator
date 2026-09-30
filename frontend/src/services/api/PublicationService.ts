import type { CopyResult, Publication, PublicationArea, PublicationKind } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface PublicationQuery {
  area?: PublicationArea;
  kind?: PublicationKind;
  /** Só as publicações de quem está logado. */
  mine?: boolean;
}

/** Área Oficial, Área de Fãs e as publicações da Minha Área. */
export interface IPublicationService {
  list(query?: PublicationQuery): Promise<Publication[]>;
  /** Publica (ou atualiza a publicação de) uma temporada, cast ou personagem seu. */
  /** Donos escolhem a área (oficial ou fãs); fãs publicam sempre na Área de Fãs. */
  publish(kind: PublicationKind, sourceId: string, description?: string | null, area?: PublicationArea): Promise<Publication>;
  unpublish(id: string): Promise<void>;
  /** Copia para a Minha Área: casts e temporadas viram um cast; personagens entram na biblioteca. */
  copy(id: string, name?: string): Promise<CopyResult>;
}

export class PublicationService implements IPublicationService {
  constructor(private readonly http: IHttpClient) {}

  list(query: PublicationQuery = {}) {
    return this.http.get<Publication[]>('/publications', { area: query.area, kind: query.kind, mine: query.mine ? 'true' : undefined });
  }

  publish(kind: PublicationKind, sourceId: string, description?: string | null, area?: PublicationArea) {
    return this.http.post<Publication>('/publications', { kind, sourceId, description, ...(area && { area }) });
  }

  unpublish(id: string) {
    return this.http.delete(`/publications/${id}`);
  }

  copy(id: string, name?: string) {
    return this.http.post<CopyResult>(`/publications/${id}/copy`, name ? { name } : {});
  }
}
