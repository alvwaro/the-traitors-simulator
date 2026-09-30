import type { Character, CharacterPhoto, Participant, ParticipantProfile } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';
import { ResourceService } from '../http/ResourceService';

export interface CharacterInput {
  name: string;
  imageUrl?: string | null;
  behaviorIds?: string[];
  photos?: CharacterPhoto[];
  profile?: ParticipantProfile | null;
  /** Só na criação: o personagem já entra no fim desse cast (sem cast, fica em "Personagens sem cast"). */
  castId?: string | null;
}

export interface ICharacterService {
  list(search?: string): Promise<Character[]>;
  create(input: CharacterInput): Promise<Character>;
  update(id: string, input: Partial<CharacterInput>): Promise<Character>;
  remove(id: string): Promise<void>;
  /** Página do participante (a de quem criou ou a de um participante oficial). */
  participant(id: string): Promise<Participant>;
  /** Preenche o perfil e as fotos com a página do participante na wiki Fandom. */
  importWiki(id: string, url: string): Promise<Character>;
}

export class CharacterService extends ResourceService<Character, CharacterInput> implements ICharacterService {
  constructor(http: IHttpClient) {
    super(http, '/characters');
  }

  list(search?: string) {
    return this.listWhere({ search });
  }

  participant(id: string) {
    return this.http.get<Participant>(`/participants/${id}`);
  }

  importWiki(id: string, url: string) {
    return this.http.post<Character>(this.itemPath(id, '/wiki'), { url });
  }
}
