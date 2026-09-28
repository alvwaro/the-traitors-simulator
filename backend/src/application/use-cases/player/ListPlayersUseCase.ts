import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { PlayerProps } from '../../../domain/entities';
import { requireSeason } from '../../services/gameGuards';

export class ListPlayersUseCase implements IUseCase<SeasonIdInput, PlayerProps[]> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: SeasonIdInput): Promise<PlayerProps[]> {
    await requireSeason(this.repos, input.seasonId);
    const players = await this.repos.players.findBySeason(input.seasonId);
    return players.map((p) => p.toJSON());
  }
}
