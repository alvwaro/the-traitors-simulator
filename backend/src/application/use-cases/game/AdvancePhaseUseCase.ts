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

/**
 * Botão "avançar": fecha a fase atual e abre a próxima.
 * Só avança se o que a fase exige já foi registrado (ver phaseRequirements).
 * Ao chegar na FINALE, calcula os vencedores e a divisão do prêmio.
 */
export class AdvancePhaseUseCase implements IUseCase<SeasonIdInput, GameStateOutput> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly phaseFlow: PhaseFlowPolicy,
    private readonly winnerPolicy: WinnerPolicy,
  ) {}

  execute(input: SeasonIdInput): Promise<GameStateOutput> {
    return this.uow.run((repos) => this.record(repos, input));
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

    const next = this.phaseFlow.next({ day: day.number, phase }, season.isEndgame());
    let nextDay = day;
    if (next.day !== day.number) {
      nextDay = Day.create({ seasonId: season.id, number: next.day });
      await repos.days.create(nextDay);
    }
    const nextPhase = DayPhase.start(nextDay.id, next.phase);

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
