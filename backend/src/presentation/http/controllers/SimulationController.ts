import { Request, Response } from 'express';
import { GetRelationshipsUseCase } from '../../../application/use-cases/simulation/GetRelationshipsUseCase';
import { RegenerateRelationshipsUseCase } from '../../../application/use-cases/simulation/RegenerateRelationshipsUseCase';
import { SimulatePhaseUseCase } from '../../../application/use-cases/simulation/SimulatePhaseUseCase';
import { UpdateRelationshipUseCase } from '../../../application/use-cases/simulation/UpdateRelationshipUseCase';
import { InteractUseCase } from '../../../application/use-cases/simulation/InteractUseCase';
import { AnswerInviteUseCase } from '../../../application/use-cases/simulation/AnswerInviteUseCase';
import { interactBody, inviteAnswerBody, seasonIdParams, simulateBody, updateRelationshipBody } from '../validators/schemas';

/** Simulação automática: simular fases e consultar/ajustar relacionamentos. */
export class SimulationController {
  constructor(
    private readonly simulatePhase: SimulatePhaseUseCase,
    private readonly getRelationships: GetRelationshipsUseCase,
    private readonly regenerateRelationships: RegenerateRelationshipsUseCase,
    private readonly updateRelationship: UpdateRelationshipUseCase,
    private readonly interactUseCase: InteractUseCase,
    private readonly answerInviteUseCase: AnswerInviteUseCase,
  ) {}

  answerInvite = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...inviteAnswerBody.parse(req.body) };
    res.json(await this.answerInviteUseCase.execute(input));
  };

  interact = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...interactBody.parse(req.body) };
    res.json(await this.interactUseCase.execute(input));
  };

  simulate = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...simulateBody.parse(req.body ?? {}) };
    res.json(await this.simulatePhase.execute(input));
  };

  relationships = async (req: Request, res: Response) => {
    res.json(await this.getRelationships.execute(seasonIdParams.parse(req.params)));
  };

  regenerate = async (req: Request, res: Response) => {
    res.json(await this.regenerateRelationships.execute(seasonIdParams.parse(req.params)));
  };

  update = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...updateRelationshipBody.parse(req.body) };
    res.json(await this.updateRelationship.execute(input));
  };
}
