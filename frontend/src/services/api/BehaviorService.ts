import type { Behavior, BehaviorEffects } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';
import { ResourceService } from '../http/ResourceService';

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

export class BehaviorService extends ResourceService<Behavior, BehaviorInput> implements IBehaviorService {
  constructor(http: IHttpClient) {
    super(http, '/behaviors');
  }

  list() {
    return this.listWhere();
  }
}
