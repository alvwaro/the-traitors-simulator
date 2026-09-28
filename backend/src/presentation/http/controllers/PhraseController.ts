import { Request, Response } from 'express';
import { CreatePhraseUseCase } from '../../../application/use-cases/phrase/CreatePhraseUseCase';
import { DeletePhraseUseCase } from '../../../application/use-cases/phrase/DeletePhraseUseCase';
import { ListPhrasesUseCase } from '../../../application/use-cases/phrase/ListPhrasesUseCase';
import { UpdatePhraseUseCase } from '../../../application/use-cases/phrase/UpdatePhraseUseCase';
import { createPhraseBody, listPhrasesQuery, phraseIdParams, updatePhraseBody } from '../validators/schemas';

/** Frases das conversas simuladas. */
export class PhraseController {
  constructor(
    private readonly createPhrase: CreatePhraseUseCase,
    private readonly listPhrases: ListPhrasesUseCase,
    private readonly updatePhrase: UpdatePhraseUseCase,
    private readonly deletePhrase: DeletePhraseUseCase,
  ) {}

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.createPhrase.execute(createPhraseBody.parse(req.body)));
  };

  list = async (req: Request, res: Response) => {
    res.json(await this.listPhrases.execute(listPhrasesQuery.parse(req.query)));
  };

  update = async (req: Request, res: Response) => {
    const input = { ...phraseIdParams.parse(req.params), ...updatePhraseBody.parse(req.body) };
    res.json(await this.updatePhrase.execute(input));
  };

  remove = async (req: Request, res: Response) => {
    await this.deletePhrase.execute(phraseIdParams.parse(req.params));
    res.status(204).end();
  };
}
