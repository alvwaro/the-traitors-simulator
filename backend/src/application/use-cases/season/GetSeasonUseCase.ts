import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { SeasonDetailsOutput, SeasonIdInput } from '../../dtos/SeasonDTOs';
import { requireSeason } from '../../services/gameGuards';
import { maskPlayer, viewerOf } from '../../services/playerView';

export class GetSeasonUseCase implements IUseCase<SeasonIdInput, SeasonDetailsOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: SeasonIdInput): Promise<SeasonDetailsOutput> {
    const season = await requireSeason(this.repos, input.seasonId);
    const players = await this.repos.players.findBySeason(season.id);
    const prizePot = await this.repos.prizes.getPrizePot(season.id);
    const viewer = viewerOf(season, players);
    return { ...season.toJSON(), prizePot, players: players.map((p) => maskPlayer(p.toJSON(), viewer)) };
  }
}
