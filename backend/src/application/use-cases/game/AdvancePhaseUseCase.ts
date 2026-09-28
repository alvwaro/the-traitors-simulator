import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { GameStateOutput } from '../../dtos/GameDTOs';
import { Day, DayPhase } from '../../../domain/entities';
import { GamePhase, PlayerStatus } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { PhaseFlowPolicy, WinnerPolicy } from '../../../domain/services';
import { loadActiveGame } from '../../services/gameGuards';
import { readGameState } from '../../services/gameState';
import { pendingRequirement } from '../../services/phaseRequirements';
import { phaseHistory } from '../../services/phaseHistory';
import { rememberForUndo } from '../../services/undo';

/**
 * Botão "avançar": fecha a fase atual e abre a próxima.
 * Só avança se o que a fase exige já foi registrado (ver phaseRequirements).
 * Ao chegar na FINALE, calcula os vencedores e a divisão do prêmio.
 * Depois de voltar fases, avançar segue o caminho que já foi registrado (reaproveitando dias e fases).
 */
export class AdvancePhaseUseCase implements IUseCase<SeasonIdInput, GameStateOutput> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly phaseFlow: PhaseFlowPolicy,
    private readonly winnerPolicy: WinnerPolicy,
  ) {}

  execute(input: SeasonIdInput): Promise<GameStateOutput> {
    return this.uow.run(async (repos) => {
      await rememberForUndo(repos, input.seasonId, 'Avanço de fase');
      return this.record(repos, input);
    });
  }

  /** A mesma regra dentro de uma transação já aberta (usada também pela simulação automática). */
  async record(repos: Repositories, input: SeasonIdInput): Promise<GameStateOutput> {
    const { season, day, phase } = await loadActiveGame(repos, input.seasonId);

    const missing = await pendingRequirement(repos, season, day, phase);
    if (missing) throw new DomainError(missing);

    const current = await repos.days.findPhase(day.id, phase);
    if (current) {
      current.end();
      await repos.days.savePhase(current);
    }

    // Já existe uma fase registrada depois desta (o usuário tinha voltado): segue por ela.
    const history = await phaseHistory(repos, season.id);
    const index = history.findIndex((h) => h.day.number === day.number && h.phase.phase === phase);
    const recorded = index >= 0 ? history[index + 1] : undefined;
    const next = recorded ? { day: recorded.day.number, phase: recorded.phase.phase } : this.phaseFlow.next({ day: day.number, phase }, season.isEndgame());

    let nextDay = recorded?.day ?? (next.day === day.number ? day : await repos.days.findBySeasonAndNumber(season.id, next.day));
    if (!nextDay) {
      nextDay = Day.create({ seasonId: season.id, number: next.day });
      await repos.days.create(nextDay);
    }
    const nextPhase = recorded?.phase ?? (await repos.days.findPhase(nextDay.id, next.phase)) ?? DayPhase.start(nextDay.id, next.phase);
    nextPhase.reopen();

    if (next.phase === GamePhase.FINALE) {
      const finalists = await repos.players.findBySeason(season.id, { status: PlayerStatus.ACTIVE });
      const prizePot = await repos.prizes.getPrizePot(season.id);
      await repos.winners.saveAll(this.winnerPolicy.determine(season.id, finalists, prizePot));
      nextPhase.end();
      season.finish();
    } else {
      season.moveTo(next.day, next.phase);
    }

    await repos.days.savePhase(nextPhase);
    await repos.seasons.update(season);
    return readGameState(repos, season.id);
  }
}
