import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { GameStateOutput, HumanDecision, SimulateInput } from '../../dtos/GameDTOs';
import { Day, SimulationEvent } from '../../../domain/entities';
import { GamePhase, RoundTableKind, SeasonStatus } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { editionFor, gameRng, SimulationEngine, SimulationFlags } from '../../../domain/simulation';
import { loadActiveGame } from '../../services/gameGuards';
import { readGameState } from '../../services/gameState';
import { activeSim, ensureRelationships, moneyFormatter } from '../../services/simulation';
import { PhaseRecorders } from './strategies/PhaseSimulation';
import { PHASE_SIMULATIONS } from './strategies/phases';
import { simulationModeFor } from './strategies/SimulationMode';

export type { PhaseRecorders } from './strategies/PhaseSimulation';

/** Limite de segurança do "simular até o fim". */
const MAX_STEPS = 500;

/**
 * Temporada automática (ou modo Jogador): decide e registra a fase atual (votos, assassinato, missão...),
 * grava a narrativa e atualiza os relacionamentos. Com untilEnd, simula e avança até a final.
 *
 * Duas estratégias se combinam: a da fase (o que acontece em cada momento do dia, ver `strategies/phases`)
 * e a do modo (de onde vêm as decisões: da simulação ou do usuário, ver `strategies/SimulationMode`).
 */
export class SimulatePhaseUseCase implements IUseCase<SimulateInput, GameStateOutput> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly recorders: PhaseRecorders,
  ) {}

  async execute(input: SimulateInput): Promise<GameStateOutput> {
    if (!input.untilEnd) {
      return this.uow.run(async (repos) => {
        await this.simulate(repos, input.seasonId, input.decision ?? {});
        return readGameState(repos, input.seasonId);
      });
    }

    for (let step = 0; step < MAX_STEPS; step++) {
      // Uma transação por fase: se algo falhar, o que já foi simulado fica salvo.
      const state = await this.uow.run(async (repos) => {
        const { season, day, phase } = await loadActiveGame(repos, input.seasonId);
        const human = (await repos.players.findBySeason(season.id)).find((p) => p.isHuman);
        if (human?.isActive()) throw new DomainError('Você ainda está no jogo: cada decisão é sua, fase por fase');
        if (!(await repos.simulationEvents.existsFor(day.id, phase))) await this.simulate(repos, input.seasonId, {});
        return this.recorders.advance.record(repos, { seasonId: input.seasonId });
      });
      if (state.season.status === SeasonStatus.FINISHED) return state;
    }
    throw new DomainError('A simulação passou do limite de fases sem terminar');
  }

  private async simulate(repos: Repositories, seasonId: string, decision: HumanDecision): Promise<void> {
    const { season, day, phase } = await loadActiveGame(repos, seasonId);
    if (!season.isAutomatic()) throw new DomainError('Esta temporada é manual: registre as fases pelos formulários');
    if (phase === GamePhase.FINALE) throw new DomainError('A temporada já terminou');

    const flags: SimulationFlags = { ...(season.simState as SimulationFlags) };
    const offer = flags.pendingOffer?.day === day.number ? flags.pendingOffer : undefined;
    // Empate esperando o voto do jogador: a mesa continua de onde parou.
    const tie = flags.pendingRevote?.day === day.number;
    if (await repos.simulationEvents.existsFor(day.id, phase)) {
      const finalOpen = phase === GamePhase.ENDGAME_ROUND_TABLE && season.isPlayerMode() && !(await this.finalDecided(repos, day));
      if (!finalOpen && !offer && !tie) throw new DomainError('Esta fase já foi simulada; avance para a próxima');
    }

    const rng = gameRng;
    const state = await ensureRelationships(repos, season.id, rng);
    const mode = simulationModeFor(season, state);

    const phrases = (await repos.phrases.findAll()).map((p) => p.toJSON());
    const engine = new SimulationEngine({
      rng,
      matrix: state.matrix,
      everyone: state.sim,
      activeIds: activeSim(state).map((p) => p.id),
      phrases,
      money: moneyFormatter(season.currency),
      day: day.number,
      chaos: season.chaos / 100,
      flags,
      humanId: state.players.find((p) => p.isHuman)?.id,
      coffins: editionFor(season.missionPool).coffins,
      withdrawals: season.withdrawals,
    });

    const strategy = PHASE_SIMULATIONS.get(phase);
    if (!strategy) throw new DomainError('Não há o que simular neste momento');
    mode.prepare(engine, state.matrix, day, phase);
    await strategy.run({ repos, recorders: this.recorders, season, day, state, engine, flags, offer, decision, mode });

    await repos.relationships.saveMany(season.id, state.matrix.changed());
    // Recarrega: registrar a fase pode ter mudado a temporada (final, vencedores...).
    const current = await repos.seasons.findById(season.id, { forUpdate: true });
    if (current) {
      current.recordSimState({ ...engine.flags, pendingOffer: flags.pendingOffer });
      await repos.seasons.update(current);
    }
    const existing = (await repos.simulationEvents.findByDay(day.id)).filter((e) => e.phase === phase).length;
    await repos.simulationEvents.createMany(
      engine.events.map((e, i) => SimulationEvent.create({ seasonId: season.id, dayId: day.id, phase, sequence: existing + i + 1, ...e })),
    );
  }

  private async finalDecided(repos: Repositories, day: Day): Promise<boolean> {
    const tables = (await repos.roundTables.findByDay(day.id)).filter((t) => t.kind === RoundTableKind.ENDGAME);
    return !!tables.at(-1)?.isEndgameUnanimous();
  }
}
