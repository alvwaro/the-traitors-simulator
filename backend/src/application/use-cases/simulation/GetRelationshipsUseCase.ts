import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { RelationshipsOutput } from '../../dtos/GameDTOs';
import { requireSeason } from '../../services/gameGuards';
import { buildRelationshipsOutput } from '../../services/simulation';
import { viewerOf } from '../../services/playerView';
import { DomainError } from '../../../domain/errors/DomainError';

/** Quem sente o quê por quem, e o termômetro do castelo (confiança, suspeita, chance de banimento). */
export class GetRelationshipsUseCase implements IUseCase<SeasonIdInput, RelationshipsOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: SeasonIdInput): Promise<RelationshipsOutput> {
    const season = await requireSeason(this.repos, input.seasonId);
    // Participante não enxerga o que os outros sentem: só quando sai do jogo ou a temporada acaba.
    if (viewerOf(season, await this.repos.players.findBySeason(season.id)).hide) {
      throw new DomainError('Você está jogando: os sentimentos do castelo são segredo');
    }
    return buildRelationshipsOutput(this.repos, season);
  }
}
