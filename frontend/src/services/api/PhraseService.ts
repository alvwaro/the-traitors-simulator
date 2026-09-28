import type { PhrasePhase, PhraseTone } from '../../domain/enums';
import type { Phrase } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

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

export class PhraseService implements IPhraseService {
  constructor(private readonly http: IHttpClient) {}

  list(phase?: PhrasePhase) {
    return this.http.get<Phrase[]>('/phrases', { phase });
  }

  create(input: PhraseInput) {
    return this.http.post<Phrase>('/phrases', input);
  }

  update(id: string, input: Partial<PhraseInput>) {
    return this.http.patch<Phrase>(`/phrases/${id}`, input);
  }

  remove(id: string) {
    return this.http.delete(`/phrases/${id}`);
  }
}
