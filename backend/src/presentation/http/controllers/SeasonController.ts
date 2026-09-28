import { Request, Response } from 'express';
import { CreateSeasonUseCase } from '../../../application/use-cases/season/CreateSeasonUseCase';
import { DeleteSeasonUseCase } from '../../../application/use-cases/season/DeleteSeasonUseCase';
import { GetSeasonUseCase } from '../../../application/use-cases/season/GetSeasonUseCase';
import { ListSeasonsUseCase } from '../../../application/use-cases/season/ListSeasonsUseCase';
import { RegisterPrizeAdjustmentUseCase } from '../../../application/use-cases/season/RegisterPrizeAdjustmentUseCase';
import { SaveSeasonAsCastUseCase } from '../../../application/use-cases/season/SaveSeasonAsCastUseCase';
import { UpdateSeasonUseCase } from '../../../application/use-cases/season/UpdateSeasonUseCase';
import {
  createSeasonBody,
  prizeAdjustmentBody,
  saveAsCastBody,
  seasonIdParams,
  updateSeasonBody,
} from '../validators/schemas';
import { actorOf } from '../middlewares/session';

export class SeasonController {
  constructor(
    private readonly createSeason: CreateSeasonUseCase,
    private readonly listSeasons: ListSeasonsUseCase,
    private readonly getSeason: GetSeasonUseCase,
    private readonly updateSeason: UpdateSeasonUseCase,
    private readonly deleteSeason: DeleteSeasonUseCase,
    private readonly saveSeasonAsCast: SaveSeasonAsCastUseCase,
    private readonly registerPrizeAdjustment: RegisterPrizeAdjustmentUseCase,
  ) {}

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.createSeason.execute({ ...createSeasonBody.parse(req.body), ownerId: actorOf(res).id }));
  };

  list = async (_req: Request, res: Response) => {
    res.json(await this.listSeasons.execute({ ownerId: actorOf(res).id }));
  };

  get = async (req: Request, res: Response) => {
    res.json(await this.getSeason.execute(seasonIdParams.parse(req.params)));
  };

  update = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...updateSeasonBody.parse(req.body) };
    res.json(await this.updateSeason.execute(input));
  };

  remove = async (req: Request, res: Response) => {
    await this.deleteSeason.execute(seasonIdParams.parse(req.params));
    res.status(204).end();
  };

  saveAsCast = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...saveAsCastBody.parse(req.body), ownerId: actorOf(res).id };
    res.status(201).json(await this.saveSeasonAsCast.execute(input));
  };

  prizeAdjustment = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...prizeAdjustmentBody.parse(req.body) };
    res.status(201).json(await this.registerPrizeAdjustment.execute(input));
  };
}
