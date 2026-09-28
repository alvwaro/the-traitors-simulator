import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { GameStateOutput, InteractInput } from '../../dtos/GameDTOs';
import { Day, Season, SimulationEvent } from '../../../domain/entities';
import { GamePhase, MurderOutcome } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { AllianceBook, gameRng, HumanMemory, isTraitor, performHumanAction, SimPlayer, SimulationFlags, SUBJECT_ACTIONS, TOWER_ACTIONS } from '../../../domain/simulation';
import { loadActiveGame } from '../../services/gameGuards';
import { readGameState } from '../../services/gameState';
import { buildPlayerView } from '../../services/playerView';
import { activeSim, ensureRelationships } from '../../services/simulation';

/**
 * Modo Jogador: o usuário clica na foto de alguém e fala com ele(a) (acusar, defender, convencer...).
 * Cada conversa gasta uma das interações do momento e muda os relacionamentos de quem estava ouvindo.
 * Na torre, as conversas são o debate com os outros traidores sobre quem matar ou recrutar.
 */
export class InteractUseCase implements IUseCase<InteractInput, GameStateOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: InteractInput): Promise<GameStateOutput> {
    return this.uow.run(async (repos) => {
      const { season, day, phase } = await loadActiveGame(repos, input.seasonId);
      if (!season.isPlayerMode()) throw new DomainError('Conversas só existem no modo Jogador');

      const state = await ensureRelationships(repos, season.id);
      const view = await buildPlayerView(repos, season, state.players, day);
      if (!view?.isActive) throw new DomainError('Você não está mais no jogo');
      if (!view.canTalk) {
        throw new DomainError(view.interactionsLeft === 0 ? 'Você já usou todas as conversas deste momento' : 'Não é hora de conversar');
      }
      const towerAction = TOWER_ACTIONS.includes(input.action);
      if (towerAction !== view.towerTalk) {
        throw new DomainError(view.towerTalk ? 'Na torre, o assunto é quem matar ou recrutar' : 'Essa conversa só existe na torre dos traidores');
      }

      if (!view.allowedActions.includes(input.action)) throw new DomainError('Não dá para falar disso agora');

      const active = activeSim(state);
      const present = view.towerTalk ? active.filter(isTraitor) : active;
      const human = active.find((p) => p.id === view.playerId)!;
      const target = present.find((p) => p.id === input.targetId);
      if (!target || target.id === human.id) {
        throw new DomainError(view.towerTalk ? 'Na torre, só dá para falar com os outros traidores' : 'Escolha alguém que está no castelo');
      }

      let subject: SimPlayer | undefined;
      if (SUBJECT_ACTIONS.includes(input.action)) {
        subject = active.find((p) => p.id === input.subjectId);
        if (!subject || subject.id === target.id || subject.id === human.id) throw new DomainError('Escolha de quem vocês vão falar');
        if (towerAction && isTraitor(subject)) throw new DomainError('Na torre, falem de um fiel');
      }

      const flags = { ...(season.simState as SimulationFlags) };
      const memory: HumanMemory = { ...(flags.human ?? {}) };
      const alliances = new AllianceBook(state.matrix, flags, active.map((p) => p.id));
      const events = performHumanAction({
        rng: gameRng,
        matrix: state.matrix,
        alliances,
        human,
        target,
        subject,
        present,
        active,
        action: input.action,
        phase,
        day: day.number,
        victim: phase === GamePhase.BREAKFAST ? await this.lastVictim(repos, season, day, active, state.sim) : undefined,
        memory,
        dungeonIds: view.dungeonIds,
        chaos: season.chaos / 100,
      });

      await repos.relationships.saveMany(season.id, state.matrix.changed());
      season.recordSimState({ ...flags, human: memory });
      await repos.seasons.update(season);
      const sequence = (await repos.simulationEvents.findByDay(day.id)).filter((e) => e.phase === phase).length;
      await repos.simulationEvents.createMany(
        events.map((e, i) => SimulationEvent.create({ seasonId: season.id, dayId: day.id, phase, sequence: sequence + i + 1, ...e })),
      );
      return readGameState(repos, season.id);
    });
  }

  /** Quem os traidores mataram ontem (citado nas conversas do café). */
  private async lastVictim(repos: Repositories, season: Season, day: Day, active: SimPlayer[], everyone: SimPlayer[]): Promise<SimPlayer | undefined> {
    const yesterday = await repos.days.findBySeasonAndNumber(season.id, day.number - 1);
    const murder = yesterday ? (await repos.traitorMeetings.findByDay(yesterday.id))?.murder : null;
    if (murder?.outcome !== MurderOutcome.SUCCESS || active.some((p) => p.id === murder.targetId)) return undefined;
    return everyone.find((p) => p.id === murder.targetId);
  }
}
