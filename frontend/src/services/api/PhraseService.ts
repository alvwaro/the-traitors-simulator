import type { PhrasePhase, PhraseTone } from '../../domain/enums';
import type { Phrase } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';
import { ResourceService } from '../http/ResourceService';

export interface PhraseInput {
  phase: PhrasePhase;
  tone: PhraseTone;
  behaviorId: string | null;
  text: string;
}

export interface IPhraseService {
  list(phase?: PhrasePhase): Promise<Phrase[]>;
  create(input: PhraseInput): Promise<Phrase>;
  update(id: string, input: Partial<PhraseInput>): Promise<Phrase>;
  remove(id: string): Promise<void>;
}

export class PhraseService extends ResourceService<Phrase, PhraseInput> implements IPhraseService {
  constructor(http: IHttpClient) {
    super(http, '/phrases');
  }

  list(phase?: PhrasePhase) {
    return this.listWhere({ phase });
  }
}
