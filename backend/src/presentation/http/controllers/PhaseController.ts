import { RegisterEndgameRoundTableUseCase } from '../../../application/use-cases/phases/RegisterEndgameRoundTableUseCase';
import { RegisterMissionUseCase } from '../../../application/use-cases/phases/RegisterMissionUseCase';
import { RegisterPhaseNotesUseCase } from '../../../application/use-cases/phases/RegisterPhaseNotesUseCase';
import { RegisterRoundTableUseCase } from '../../../application/use-cases/phases/RegisterRoundTableUseCase';
import { RegisterTraitorsMeetingUseCase } from '../../../application/use-cases/phases/RegisterTraitorsMeetingUseCase';
import { SelectTraitorsUseCase } from '../../../application/use-cases/phases/SelectTraitorsUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import {
  endgameRoundTableBody,
  missionBody,
  phaseNotesBody,
  roundTableBody,
  seasonIdParams,
  selectTraitorsBody,
  traitorsMeetingBody,
} from '../validators/schemas';

export interface PhaseUseCases {
  notes: RegisterPhaseNotesUseCase;
  selectTraitors: SelectTraitorsUseCase;
  mission: RegisterMissionUseCase;
  roundTable: RegisterRoundTableUseCase;
  traitorsMeeting: RegisterTraitorsMeetingUseCase;
  endgameRoundTable: RegisterEndgameRoundTableUseCase;
}

/** Registro das decisões da fase atual (temporadas manuais). */
export function phaseController(p: PhaseUseCases): Handlers<RoutesOf<'phase'>> {
  const params = seasonIdParams;
  return {
    'phase.notes': endpoint(p.notes, { params, body: phaseNotesBody }),
    'phase.traitorSelection': endpoint(p.selectTraitors, { params, body: selectTraitorsBody }),
    'phase.mission': endpoint(p.mission, { params, body: missionBody, status: 201 }),
    'phase.roundTable': endpoint(p.roundTable, { params, body: roundTableBody, status: 201 }),
    'phase.traitorsMeeting': endpoint(p.traitorsMeeting, { params, body: traitorsMeetingBody, status: 201 }),
    'phase.endgameRoundTable': endpoint(p.endgameRoundTable, { params, body: endgameRoundTableBody, status: 201 }),
  };
}
