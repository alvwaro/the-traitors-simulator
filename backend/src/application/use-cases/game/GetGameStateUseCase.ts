import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { GameStateOutput } from '../../dtos/GameDTOs';
import { readGameState } from '../../services/gameState';

export class GetGameStateUseCase implements IUseCase<SeasonIdInput, GameStateOutput> {
  constructor(private readonly repos: Repositories) {}

  execute(input: SeasonIdInput): Promise<GameStateOutput> {
    return readGameState(this.repos, input.seasonId);
  }
}
