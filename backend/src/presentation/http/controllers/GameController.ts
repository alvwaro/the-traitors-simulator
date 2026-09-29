import { AdvancePhaseUseCase } from '../../../application/use-cases/game/AdvancePhaseUseCase';
import { GetGameStateUseCase } from '../../../application/use-cases/game/GetGameStateUseCase';
import { GetSeasonHistoryUseCase } from '../../../application/use-cases/game/GetSeasonHistoryUseCase';
import { GoBackPhaseUseCase } from '../../../application/use-cases/game/GoBackPhaseUseCase';
import { StartEndgameUseCase } from '../../../application/use-cases/game/StartEndgameUseCase';
import { StartSeasonUseCase } from '../../../application/use-cases/game/StartSeasonUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { seasonIdParams } from '../validators/schemas';

export interface GameUseCases {
  start: StartSeasonUseCase;
  state: GetGameStateUseCase;
  history: GetSeasonHistoryUseCase;
  advance: AdvancePhaseUseCase;
  back: GoBackPhaseUseCase;
  endgame: StartEndgameUseCase;
}

/** Fluxo da temporada: iniciar, consultar, avançar ou voltar fase, final. */
export function gameController(g: GameUseCases): Handlers<RoutesOf<'game'>> {
  const bySeason = { params: seasonIdParams };
  return {
    'game.start': endpoint(g.start, bySeason),
    'game.state': endpoint(g.state, bySeason),
    'game.history': endpoint(g.history, bySeason),
    'game.advance': endpoint(g.advance, bySeason),
    'game.back': endpoint(g.back, bySeason),
    'game.endgame': endpoint(g.endgame, bySeason),
  };
}
