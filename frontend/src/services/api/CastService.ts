import type { Cast, CastRankingRow, Relationship } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';
import { ResourceService } from '../http/ResourceService';

export interface CastInput {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  characterIds: string[];
}

export interface CastRelationshipPatch {
  fromId: string;
  toId: string;
  trust?: number;
  liking?: number;
  hatred?: number;
  allied?: boolean;
  /** Apaga o par (volta a ser sorteado). */
  clear?: boolean;
}

export interface ICastService {
  relationships(id: string): Promise<{ relationships: Relationship[] }>;
  updateRelationship(id: string, patch: CastRelationshipPatch): Promise<{ relationships: Relationship[] }>;
  ranking(id: string): Promise<{ rows: CastRankingRow[] }>;
  /** Sorteia novos comportamentos para todos os personagens do cast. */
  randomizeBehaviors(id: string): Promise<Cast>;
  list(): Promise<Cast[]>;
  get(id: string): Promise<Cast>;
  create(input: CastInput): Promise<Cast>;
  update(id: string, input: Partial<CastInput>): Promise<Cast>;
  remove(id: string): Promise<void>;
}

export class CastService extends ResourceService<Cast, CastInput> implements ICastService {
  constructor(http: IHttpClient) {
    super(http, '/casts');
  }

  list() {
    return this.listWhere();
  }

  get(id: string) {
    return this.http.get<Cast>(this.itemPath(id));
  }

  relationships(id: string) {
    return this.http.get<{ relationships: Relationship[] }>(this.itemPath(id, '/relationships'));
  }

  updateRelationship(id: string, patch: CastRelationshipPatch) {
    return this.http.patch<{ relationships: Relationship[] }>(this.itemPath(id, '/relationships'), patch);
  }

  ranking(id: string) {
    return this.http.get<{ rows: CastRankingRow[] }>(this.itemPath(id, '/ranking'));
  }

  randomizeBehaviors(id: string) {
    return this.http.post<Cast>(this.itemPath(id, '/randomize-behaviors'), {});
  }
}
