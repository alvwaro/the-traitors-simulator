import { Request, Response } from 'express';
import { ListEditionsUseCase } from '../../../application/use-cases/edition/ListEditionsUseCase';

/** Guia das temporadas do programa (EUA e Reino Unido). */
export class EditionController {
  constructor(private readonly listEditions: ListEditionsUseCase) {}

  list = async (_req: Request, res: Response) => {
    res.json(await this.listEditions.execute());
  };
}
