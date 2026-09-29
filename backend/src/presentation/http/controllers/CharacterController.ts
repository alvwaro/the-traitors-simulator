import { CreateCharacterUseCase } from '../../../application/use-cases/character/CreateCharacterUseCase';
import { DeleteCharacterUseCase } from '../../../application/use-cases/character/DeleteCharacterUseCase';
import { GetCharacterUseCase } from '../../../application/use-cases/character/GetCharacterUseCase';
import { ListCharactersUseCase } from '../../../application/use-cases/character/ListCharactersUseCase';
import { UpdateCharacterUseCase } from '../../../application/use-cases/character/UpdateCharacterUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { characterIdParams, createCharacterBody, listCharactersQuery, updateCharacterBody } from '../validators/schemas';

export interface CharacterUseCases {
  create: CreateCharacterUseCase;
  list: ListCharactersUseCase;
  get: GetCharacterUseCase;
  update: UpdateCharacterUseCase;
  remove: DeleteCharacterUseCase;
}

/** Biblioteca de personagens salvos (Minha Área). */
export function characterController(c: CharacterUseCases): Handlers<RoutesOf<'characters'>> {
  return {
    'characters.create': endpoint(c.create, { body: createCharacterBody, identity: 'ownerId', status: 201 }),
    'characters.list': endpoint(c.list, { query: listCharactersQuery, identity: 'ownerId' }),
    'characters.get': endpoint(c.get, { params: characterIdParams }),
    'characters.update': endpoint(c.update, { params: characterIdParams, body: updateCharacterBody }),
    'characters.remove': endpoint(c.remove, { params: characterIdParams, status: 204 }),
  };
}
