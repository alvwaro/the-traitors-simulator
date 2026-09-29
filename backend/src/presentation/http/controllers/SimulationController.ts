import { AnswerInviteUseCase } from '../../../application/use-cases/simulation/AnswerInviteUseCase';
import { GetRelationshipsUseCase } from '../../../application/use-cases/simulation/GetRelationshipsUseCase';
import { InteractUseCase } from '../../../application/use-cases/simulation/InteractUseCase';
import { RegenerateRelationshipsUseCase } from '../../../application/use-cases/simulation/RegenerateRelationshipsUseCase';
import { SimulatePhaseUseCase } from '../../../application/use-cases/simulation/SimulatePhaseUseCase';
import { UpdateRelationshipUseCase } from '../../../application/use-cases/simulation/UpdateRelationshipUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { interactBody, inviteAnswerBody, seasonIdParams, simulateBody, updateRelationshipBody } from '../validators/schemas';

export interface SimulationUseCases {
  simulate: SimulatePhaseUseCase;
  interact: InteractUseCase;
  answerInvite: AnswerInviteUseCase;
  relationships: GetRelationshipsUseCase;
  updateRelationship: UpdateRelationshipUseCase;
  regenerate: RegenerateRelationshipsUseCase;
}

/** Simulação automática e modo Jogador: simular fases, conversar, responder convites e ver/ajustar relacionamentos. */
export function simulationController(s: SimulationUseCases): Handlers<RoutesOf<'simulation'>> {
  const params = seasonIdParams;
  return {
    'simulation.simulate': endpoint(s.simulate, { params, body: simulateBody }),
    'simulation.interact': endpoint(s.interact, { params, body: interactBody }),
    'simulation.answerInvite': endpoint(s.answerInvite, { params, body: inviteAnswerBody }),
    'simulation.relationships': endpoint(s.relationships, { params }),
    'simulation.updateRelationship': endpoint(s.updateRelationship, { params, body: updateRelationshipBody }),
    'simulation.regenerate': endpoint(s.regenerate, { params }),
  };
}
