import type { Cast, CastRankingRow, Relationship } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

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

export class CastService implements ICastService {
  constructor(private readonly http: IHttpClient) {}

  list() {
    return this.http.get<Cast[]>('/casts');
  }

  get(id: string) {
    return this.http.get<Cast>(`/casts/${id}`);
  }

  create(input: CastInput) {
    return this.http.post<Cast>('/casts', input);
  }

  update(id: string, input: Partial<CastInput>) {
    return this.http.patch<Cast>(`/casts/${id}`, input);
  }

  remove(id: string) {
    return this.http.delete(`/casts/${id}`);
  }

  relationships(id: string) {
    return this.http.get<{ relationships: Relationship[] }>(`/casts/${id}/relationships`);
  }

  updateRelationship(id: string, patch: CastRelationshipPatch) {
    return this.http.patch<{ relationships: Relationship[] }>(`/casts/${id}/relationships`, patch);
  }

  ranking(id: string) {
    return this.http.get<{ rows: CastRankingRow[] }>(`/casts/${id}/ranking`);
  }

  randomizeBehaviors(id: string) {
    return this.http.post<Cast>(`/casts/${id}/randomize-behaviors`, {});
  }
}
