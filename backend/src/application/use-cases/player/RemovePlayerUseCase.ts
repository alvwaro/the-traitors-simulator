import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { PlayerRefInput } from '../../dtos/PlayerDTOs';
import { DomainError } from '../../../domain/errors/DomainError';
import { requireSeason } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';

/** Remove do elenco. Só em SETUP; depois disso use WithdrawPlayer. */
export class RemovePlayerUseCase implements IUseCase<PlayerRefInput, void> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: PlayerRefInput): Promise<void> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      if (!season.isInSetup()) throw new DomainError('Depois do início, use a desistência em vez de remover o jogador');
      const player = (await PlayerRoster.load(repos, season.id)).require(input.playerId);
      if (player.isHuman) throw new DomainError('Você é o participante desta temporada; não dá para se dispensar');
      await repos.players.delete(player.id);
    });
  }
}
