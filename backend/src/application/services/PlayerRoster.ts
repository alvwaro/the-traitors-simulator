import { Player } from '../../domain/entities';
import { DomainError } from '../../domain/errors/DomainError';
import { Repositories } from '../ports/IUnitOfWork';

/** Elenco da temporada carregado em memória, com validações de pertencimento. */
export class PlayerRoster {
  private constructor(private readonly byId: Map<string, Player>) {}

  static async load(repos: Repositories, seasonId: string): Promise<PlayerRoster> {
    const players = await repos.players.findBySeason(seasonId);
    return new PlayerRoster(new Map(players.map((p) => [p.id, p])));
  }

  all(): Player[] {
    return [...this.byId.values()];
  }

  active(): Player[] {
    return this.all().filter((p) => p.isActive());
  }

  require(playerId: string): Player {
    const player = this.byId.get(playerId);
    if (!player) throw new DomainError(`Jogador ${playerId} não pertence a esta temporada`);
    return player;
  }

  requireActive(playerId: string): Player {
    const player = this.require(playerId);
    if (!player.isActive()) throw new DomainError(`${player.name} já foi eliminado(a)`);
    return player;
  }
}
