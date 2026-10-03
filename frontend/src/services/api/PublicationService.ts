import type { CopyResult, Publication, PublicationArea, PublicationCountry, PublicationKind, SeasonDetails } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface PublicationQuery {
  area?: PublicationArea;
  kind?: PublicationKind;
  /** Só as publicações de quem está logado. */
  mine?: boolean;
}

/** Onde publicar: a área e, nas Temporadas Oficiais, o país (só donos escolhem). */
export interface PublicationPlace {
  area: PublicationArea;
  country?: PublicationCountry;
}

/** A temporada criada ao copiar uma publicada: o nome e, no modo Jogador, quem vai jogar. */
export interface SeasonCopy {
  name?: string;
  human?: { name: string };
}

/** Temporadas Oficiais, Área de Fãs e as publicações de quem está logado. */
export interface IPublicationService {
  list(query?: PublicationQuery): Promise<Publication[]>;
  get(id: string): Promise<Publication>;
  /** Publica (ou atualiza a publicação de) uma temporada, cast ou personagem seu: vai uma cópia do momento. */
  publish(kind: PublicationKind, sourceId: string, description?: string | null, place?: PublicationPlace): Promise<Publication>;
  unpublish(id: string): Promise<void>;
  /** Copia para a biblioteca: casts e temporadas viram um cast; personagens entram na biblioteca. */
  copy(id: string, name?: string): Promise<CopyResult>;
  /** Copia uma temporada publicada inteira: uma temporada nova, com as mesmas configurações e o elenco. */
  copySeason(id: string, copy?: SeasonCopy): Promise<SeasonDetails>;
}

export class PublicationService implements IPublicationService {
  constructor(private readonly http: IHttpClient) {}

  list(query: PublicationQuery = {}) {
    return this.http.get<Publication[]>('/publications', { area: query.area, kind: query.kind, mine: query.mine ? 'true' : undefined });
  }

  get(id: string) {
    return this.http.get<Publication>(`/publications/${id}`);
  }

  publish(kind: PublicationKind, sourceId: string, description?: string | null, place?: PublicationPlace) {
    return this.http.post<Publication>('/publications', { kind, sourceId, description, ...place });
  }

  unpublish(id: string) {
    return this.http.delete(`/publications/${id}`);
  }

  copy(id: string, name?: string) {
    return this.http.post<CopyResult>(`/publications/${id}/copy`, name ? { name } : {});
  }

  copySeason(id: string, copy: SeasonCopy = {}) {
    return this.http.post<SeasonDetails>(`/publications/${id}/copy-season`, copy);
  }
}
