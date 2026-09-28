import { Request, Response } from 'express';
import { CreateCharacterUseCase } from '../../../application/use-cases/character/CreateCharacterUseCase';
import { DeleteCharacterUseCase } from '../../../application/use-cases/character/DeleteCharacterUseCase';
import { GetCharacterUseCase } from '../../../application/use-cases/character/GetCharacterUseCase';
import { ListCharactersUseCase } from '../../../application/use-cases/character/ListCharactersUseCase';
import { UpdateCharacterUseCase } from '../../../application/use-cases/character/UpdateCharacterUseCase';
import {
  characterIdParams,
  createCharacterBody,
  listCharactersQuery,
  updateCharacterBody,
} from '../validators/schemas';
import { actorOf } from '../middlewares/session';

/** Biblioteca de personagens salvos. */
export class CharacterController {
  constructor(
    private readonly createCharacter: CreateCharacterUseCase,
    private readonly listCharacters: ListCharactersUseCase,
    private readonly getCharacter: GetCharacterUseCase,
    private readonly updateCharacter: UpdateCharacterUseCase,
    private readonly deleteCharacter: DeleteCharacterUseCase,
  ) {}

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.createCharacter.execute({ ...createCharacterBody.parse(req.body), ownerId: actorOf(res).id }));
  };

  list = async (req: Request, res: Response) => {
    res.json(await this.listCharacters.execute({ ...listCharactersQuery.parse(req.query), ownerId: actorOf(res).id }));
  };

  get = async (req: Request, res: Response) => {
    res.json(await this.getCharacter.execute(characterIdParams.parse(req.params)));
  };

  update = async (req: Request, res: Response) => {
    const input = { ...characterIdParams.parse(req.params), ...updateCharacterBody.parse(req.body) };
    res.json(await this.updateCharacter.execute(input));
  };

  remove = async (req: Request, res: Response) => {
    await this.deleteCharacter.execute(characterIdParams.parse(req.params));
    res.status(204).end();
  };
}
