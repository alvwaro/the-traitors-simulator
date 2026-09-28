import { Request, Response } from 'express';
import { AdvancePhaseUseCase } from '../../../application/use-cases/game/AdvancePhaseUseCase';
import { GetGameStateUseCase } from '../../../application/use-cases/game/GetGameStateUseCase';
import { GetSeasonHistoryUseCase } from '../../../application/use-cases/game/GetSeasonHistoryUseCase';
import { GoBackPhaseUseCase } from '../../../application/use-cases/game/GoBackPhaseUseCase';
import { StartEndgameUseCase } from '../../../application/use-cases/game/StartEndgameUseCase';
import { StartSeasonUseCase } from '../../../application/use-cases/game/StartSeasonUseCase';
import { seasonIdParams } from '../validators/schemas';

/** Controle do fluxo da temporada (iniciar, avançar ou voltar fase, final). */
export class GameController {
  constructor(
    private readonly startSeason: StartSeasonUseCase,
    private readonly getGameState: GetGameStateUseCase,
    private readonly advancePhase: AdvancePhaseUseCase,
    private readonly startEndgame: StartEndgameUseCase,
    private readonly getSeasonHistory: GetSeasonHistoryUseCase,
    private readonly goBackPhase: GoBackPhaseUseCase,
  ) {}

  start = async (req: Request, res: Response) => {
    res.json(await this.startSeason.execute(seasonIdParams.parse(req.params)));
  };

  state = async (req: Request, res: Response) => {
    res.json(await this.getGameState.execute(seasonIdParams.parse(req.params)));
  };

  advance = async (req: Request, res: Response) => {
    res.json(await this.advancePhase.execute(seasonIdParams.parse(req.params)));
  };

  back = async (req: Request, res: Response) => {
    res.json(await this.goBackPhase.execute(seasonIdParams.parse(req.params)));
  };

  endgame = async (req: Request, res: Response) => {
    res.json(await this.startEndgame.execute(seasonIdParams.parse(req.params)));
  };

  history = async (req: Request, res: Response) => {
    res.json(await this.getSeasonHistory.execute(seasonIdParams.parse(req.params)));
  };
}
