import { Request, Response } from 'express';
import { CreateCastUseCase } from '../../../application/use-cases/cast/CreateCastUseCase';
import { DeleteCastUseCase } from '../../../application/use-cases/cast/DeleteCastUseCase';
import { GetCastUseCase } from '../../../application/use-cases/cast/GetCastUseCase';
import { ListCastsUseCase } from '../../../application/use-cases/cast/ListCastsUseCase';
import { UpdateCastUseCase } from '../../../application/use-cases/cast/UpdateCastUseCase';
import { GetCastRelationshipsUseCase, UpdateCastRelationshipUseCase } from '../../../application/use-cases/cast/CastRelationshipsUseCases';
import { GetCastRankingUseCase } from '../../../application/use-cases/cast/GetCastRankingUseCase';
import { RandomizeCastBehaviorsUseCase } from '../../../application/use-cases/cast/RandomizeCastBehaviorsUseCase';
import { castIdParams, createCastBody, updateCastBody, updateCastRelationshipBody } from '../validators/schemas';
import { actorOf } from '../middlewares/session';

/** Casts salvos (grupos de personagens). */
export class CastController {
  constructor(
    private readonly createCast: CreateCastUseCase,
    private readonly listCasts: ListCastsUseCase,
    private readonly getCast: GetCastUseCase,
    private readonly updateCast: UpdateCastUseCase,
    private readonly deleteCast: DeleteCastUseCase,
    private readonly getRelationships: GetCastRelationshipsUseCase,
    private readonly updateRelationship: UpdateCastRelationshipUseCase,
    private readonly getRanking: GetCastRankingUseCase,
    private readonly randomizeBehaviors: RandomizeCastBehaviorsUseCase,
  ) {}

  randomize = async (req: Request, res: Response) => {
    res.json(await this.randomizeBehaviors.execute(castIdParams.parse(req.params)));
  };

  relationships = async (req: Request, res: Response) => {
    res.json(await this.getRelationships.execute(castIdParams.parse(req.params)));
  };

  updateRelationships = async (req: Request, res: Response) => {
    const input = { ...castIdParams.parse(req.params), ...updateCastRelationshipBody.parse(req.body) };
    res.json(await this.updateRelationship.execute(input));
  };

  ranking = async (req: Request, res: Response) => {
    res.json(await this.getRanking.execute(castIdParams.parse(req.params)));
  };

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.createCast.execute({ ...createCastBody.parse(req.body), ownerId: actorOf(res).id }));
  };

  list = async (_req: Request, res: Response) => {
    res.json(await this.listCasts.execute({ ownerId: actorOf(res).id }));
  };

  get = async (req: Request, res: Response) => {
    res.json(await this.getCast.execute(castIdParams.parse(req.params)));
  };

  update = async (req: Request, res: Response) => {
    const input = { ...castIdParams.parse(req.params), ...updateCastBody.parse(req.body), ownerId: actorOf(res).id };
    res.json(await this.updateCast.execute(input));
  };

  remove = async (req: Request, res: Response) => {
    await this.deleteCast.execute(castIdParams.parse(req.params));
    res.status(204).end();
  };
}
