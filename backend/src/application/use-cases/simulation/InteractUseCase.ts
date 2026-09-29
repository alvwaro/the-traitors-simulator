import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { GameStateOutput, InteractInput } from '../../dtos/GameDTOs';
import { Day, Season } from '../../../domain/entities';
import { GamePhase, MurderOutcome } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { gameRng, isTraitor, performHumanAction, SimPlayer, SUBJECT_ACTIONS, TOWER_ACTIONS } from '../../../domain/simulation';
import { HumanTurn, loadHumanTurn, saveHumanTurn } from '../../services/humanTurn';

/**
 * Modo Jogador: o usuário clica na foto de alguém e fala com ele(a) (acusar, defender, convencer...).
 * Cada conversa gasta uma das interações do momento e muda os relacionamentos de quem estava ouvindo.
 * Na torre, as conversas são o debate com os outros traidores sobre quem matar ou recrutar.
 */
export class InteractUseCase implements IUseCase<InteractInput, GameStateOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: InteractInput): Promise<GameStateOutput> {
    return this.uow.run(async (repos) => {
      const turn = await loadHumanTurn(repos, input.seasonId, 'Conversas só existem no modo Jogador');
      const { season, day, phase, view, active, human } = turn;
      if (!view.canTalk) {
        throw new DomainError(view.interactionsLeft === 0 ? 'Você já usou todas as conversas deste momento' : 'Não é hora de conversar');
      }
      const towerAction = TOWER_ACTIONS.includes(input.action);
      if (towerAction !== view.towerTalk) {
        throw new DomainError(view.towerTalk ? 'Na torre, o assunto é quem matar ou recrutar' : 'Essa conversa só existe na torre dos traidores');
      }
      if (!view.allowedActions.includes(input.action)) throw new DomainError('Não dá para falar disso agora');

      const present = view.towerTalk ? active.filter(isTraitor) : active;
      const target = present.find((p) => p.id === input.targetId);
      if (!target || target.id === human.id) {
        throw new DomainError(view.towerTalk ? 'Na torre, só dá para falar com os outros traidores' : 'Escolha alguém que está no castelo');
      }
      const subject = this.subjectOf(input, turn, target, towerAction);

      const events = performHumanAction({
        rng: gameRng,
        matrix: turn.state.matrix,
        alliances: turn.alliances,
        human,
        target,
        subject,
        present,
        active,
        action: input.action,
        phase,
        day: day.number,
        victim: phase === GamePhase.BREAKFAST ? await this.lastVictim(repos, season, day, active, turn.state.sim) : undefined,
        memory: turn.memory,
        dungeonIds: view.dungeonIds,
        chaos: season.chaos / 100,
      });
      return saveHumanTurn(repos, turn, events);
    });
  }

  /** De quem vão falar (nas conversas sobre uma terceira pessoa). */
  private subjectOf(input: InteractInput, turn: HumanTurn, target: SimPlayer, towerAction: boolean): SimPlayer | undefined {
    if (!SUBJECT_ACTIONS.includes(input.action)) return undefined;
    const subject = turn.active.find((p) => p.id === input.subjectId);
    if (!subject || subject.id === target.id || subject.id === turn.human.id) throw new DomainError('Escolha de quem vocês vão falar');
    if (towerAction && isTraitor(subject)) throw new DomainError('Na torre, falem de um fiel');
    return subject;
  }

  /** Quem os traidores mataram ontem (citado nas conversas do café). */
  private async lastVictim(repos: Repositories, season: Season, day: Day, active: SimPlayer[], everyone: SimPlayer[]): Promise<SimPlayer | undefined> {
    const yesterday = await repos.days.findBySeasonAndNumber(season.id, day.number - 1);
    const murder = yesterday ? (await repos.traitorMeetings.findByDay(yesterday.id))?.murder : null;
    if (murder?.outcome !== MurderOutcome.SUCCESS || active.some((p) => p.id === murder.targetId)) return undefined;
    return everyone.find((p) => p.id === murder.targetId);
  }
}
