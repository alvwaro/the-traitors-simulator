import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { GameStateOutput } from '../../dtos/GameDTOs';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame, requireSeason } from '../../services/gameGuards';
import { readGameState } from '../../services/gameState';
import { indexOfPhase, phaseHistory } from '../../services/phaseHistory';

/**
 * Botão "voltar" das temporadas manuais: desfaz o último registro (mesa redonda, missão, torre,
 * avanço de fase...), devolvendo a temporada exatamente como estava antes dele, inclusive depois da final.
 * Temporadas sem estados guardados (anteriores a este recurso) só voltam o ponteiro para a fase anterior.
 */
export class GoBackPhaseUseCase implements IUseCase<SeasonIdInput, GameStateOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: SeasonIdInput): Promise<GameStateOutput> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      if (season.isAutomatic()) throw new DomainError('Só as temporadas manuais podem voltar');
      if (season.isInSetup()) throw new DomainError('A temporada ainda não foi iniciada');

      const undone = await repos.snapshots.restoreLatest(season.id);
      if (!undone) await this.previousPhase(repos, season.id);
      return readGameState(repos, season.id);
    });
  }

  /** Sem estado guardado: só volta para a fase anterior, sem apagar nada. */
  private async previousPhase(repos: Repositories, seasonId: string): Promise<void> {
    const { season, day, phase } = await loadActiveGame(repos, seasonId);
    const history = await phaseHistory(repos, season.id);
    const index = indexOfPhase(history, day.number, phase);
    const previous = index > 0 ? history[index - 1] : undefined;
    if (!previous) throw new DomainError('Não há nada para desfazer');

    previous.phase.reopen();
    await repos.days.savePhase(previous.phase);
    season.moveTo(previous.day.number, previous.phase.phase);
    await repos.seasons.update(season);
  }
}
