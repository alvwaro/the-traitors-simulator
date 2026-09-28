import { Request, Response } from 'express';
import { RegisterEndgameRoundTableUseCase } from '../../../application/use-cases/phases/RegisterEndgameRoundTableUseCase';
import { RegisterMissionUseCase } from '../../../application/use-cases/phases/RegisterMissionUseCase';
import { RegisterPhaseNotesUseCase } from '../../../application/use-cases/phases/RegisterPhaseNotesUseCase';
import { RegisterRoundTableUseCase } from '../../../application/use-cases/phases/RegisterRoundTableUseCase';
import { RegisterTraitorsMeetingUseCase } from '../../../application/use-cases/phases/RegisterTraitorsMeetingUseCase';
import { SelectTraitorsUseCase } from '../../../application/use-cases/phases/SelectTraitorsUseCase';
import {
  endgameRoundTableBody,
  missionBody,
  phaseNotesBody,
  roundTableBody,
  seasonIdParams,
  selectTraitorsBody,
  traitorsMeetingBody,
} from '../validators/schemas';

/** Registro das decisões de cada fase da fase atual. */
export class PhaseController {
  constructor(
    private readonly registerNotes: RegisterPhaseNotesUseCase,
    private readonly selectTraitors: SelectTraitorsUseCase,
    private readonly registerMission: RegisterMissionUseCase,
    private readonly registerRoundTable: RegisterRoundTableUseCase,
    private readonly registerTraitorsMeeting: RegisterTraitorsMeetingUseCase,
    private readonly registerEndgameRoundTable: RegisterEndgameRoundTableUseCase,
  ) {}

  notes = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...phaseNotesBody.parse(req.body) };
    res.json(await this.registerNotes.execute(input));
  };

  traitorSelection = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...selectTraitorsBody.parse(req.body) };
    res.json(await this.selectTraitors.execute(input));
  };

  mission = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...missionBody.parse(req.body) };
    res.status(201).json(await this.registerMission.execute(input));
  };

  roundTable = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...roundTableBody.parse(req.body) };
    res.status(201).json(await this.registerRoundTable.execute(input));
  };

  traitorsMeeting = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...traitorsMeetingBody.parse(req.body) };
    res.status(201).json(await this.registerTraitorsMeeting.execute(input));
  };

  endgameRoundTable = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...endgameRoundTableBody.parse(req.body) };
    res.status(201).json(await this.registerEndgameRoundTable.execute(input));
  };
}
