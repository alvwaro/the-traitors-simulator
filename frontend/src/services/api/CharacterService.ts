import type { Character } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

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

export class CharacterService implements ICharacterService {
  constructor(private readonly http: IHttpClient) {}

  list(search?: string) {
    return this.http.get<Character[]>('/characters', { search });
  }

  create(input: CharacterInput) {
    return this.http.post<Character>('/characters', input);
  }

  update(id: string, input: Partial<CharacterInput>) {
    return this.http.patch<Character>(`/characters/${id}`, input);
  }

  remove(id: string) {
    return this.http.delete(`/characters/${id}`);
  }
}
