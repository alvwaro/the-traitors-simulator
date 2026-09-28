import type { Behavior, BehaviorEffects } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface BehaviorInput {
  name: string;
  description?: string | null;
  effects: BehaviorEffects;
}

export interface IBehaviorService {
  list(): Promise<Behavior[]>;
  create(input: BehaviorInput): Promise<Behavior>;
  update(id: string, input: Partial<BehaviorInput>): Promise<Behavior>;
  remove(id: string): Promise<void>;
}

export class BehaviorService implements IBehaviorService {
  constructor(private readonly http: IHttpClient) {}

  list() {
    return this.http.get<Behavior[]>('/behaviors');
  }

  create(input: BehaviorInput) {
    return this.http.post<Behavior>('/behaviors', input);
  }

  update(id: string, input: Partial<BehaviorInput>) {
    return this.http.patch<Behavior>(`/behaviors/${id}`, input);
  }

  remove(id: string) {
    return this.http.delete(`/behaviors/${id}`);
  }
}
