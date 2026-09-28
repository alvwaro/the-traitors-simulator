import { Phrase } from '../entities';
import { PhrasePhase } from '../enums';

export interface IPhraseRepository {
  findById(id: string): Promise<Phrase | null>;
  findAll(phase?: PhrasePhase): Promise<Phrase[]>;
  create(phrase: Phrase): Promise<void>;
  update(phrase: Phrase): Promise<void>;
  delete(id: string): Promise<void>;
}
