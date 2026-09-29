import type { Character } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';
import { ResourceService } from '../http/ResourceService';

export interface CharacterInput {
  name: string;
  imageUrl?: string | null;
  behaviorIds?: string[];
}

export interface ICharacterService {
  list(search?: string): Promise<Character[]>;
  create(input: CharacterInput): Promise<Character>;
  update(id: string, input: Partial<CharacterInput>): Promise<Character>;
  remove(id: string): Promise<void>;
}

export class CharacterService extends ResourceService<Character, CharacterInput> implements ICharacterService {
  constructor(http: IHttpClient) {
    super(http, '/characters');
  }

  list(search?: string) {
    return this.listWhere({ search });
  }
}
