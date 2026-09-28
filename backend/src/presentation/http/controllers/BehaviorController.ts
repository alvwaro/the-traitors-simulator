import { Request, Response } from 'express';
import { CreateBehaviorUseCase } from '../../../application/use-cases/behavior/CreateBehaviorUseCase';
import { DeleteBehaviorUseCase } from '../../../application/use-cases/behavior/DeleteBehaviorUseCase';
import { ListBehaviorsUseCase } from '../../../application/use-cases/behavior/ListBehaviorsUseCase';
import { UpdateBehaviorUseCase } from '../../../application/use-cases/behavior/UpdateBehaviorUseCase';
import { behaviorIdParams, createBehaviorBody, updateBehaviorBody } from '../validators/schemas';

/** Comportamentos (tags de personalidade) da simulação automática. */
export class BehaviorController {
  constructor(
    private readonly createBehavior: CreateBehaviorUseCase,
    private readonly listBehaviors: ListBehaviorsUseCase,
    private readonly updateBehavior: UpdateBehaviorUseCase,
    private readonly deleteBehavior: DeleteBehaviorUseCase,
  ) {}

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.createBehavior.execute(createBehaviorBody.parse(req.body)));
  };

  list = async (_req: Request, res: Response) => {
    res.json(await this.listBehaviors.execute());
  };

  update = async (req: Request, res: Response) => {
    const input = { ...behaviorIdParams.parse(req.params), ...updateBehaviorBody.parse(req.body) };
    res.json(await this.updateBehavior.execute(input));
  };

  remove = async (req: Request, res: Response) => {
    await this.deleteBehavior.execute(behaviorIdParams.parse(req.params));
    res.status(204).end();
  };
}
