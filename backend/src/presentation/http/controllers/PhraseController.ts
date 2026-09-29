import { CreatePhraseUseCase } from '../../../application/use-cases/phrase/CreatePhraseUseCase';
import { DeletePhraseUseCase } from '../../../application/use-cases/phrase/DeletePhraseUseCase';
import { ListPhrasesUseCase } from '../../../application/use-cases/phrase/ListPhrasesUseCase';
import { UpdatePhraseUseCase } from '../../../application/use-cases/phrase/UpdatePhraseUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { createPhraseBody, listPhrasesQuery, phraseIdParams, updatePhraseBody } from '../validators/schemas';

export interface PhraseUseCases {
  create: CreatePhraseUseCase;
  list: ListPhrasesUseCase;
  update: UpdatePhraseUseCase;
  remove: DeletePhraseUseCase;
}

/** Frases das conversas simuladas (valem para todos; só os donos do site alteram). */
export function phraseController(p: PhraseUseCases): Handlers<RoutesOf<'phrases'>> {
  return {
    'phrases.list': endpoint(p.list, { query: listPhrasesQuery }),
    'phrases.create': endpoint(p.create, { body: createPhraseBody, status: 201 }),
    'phrases.update': endpoint(p.update, { params: phraseIdParams, body: updatePhraseBody }),
    'phrases.remove': endpoint(p.remove, { params: phraseIdParams, status: 204 }),
  };
}
