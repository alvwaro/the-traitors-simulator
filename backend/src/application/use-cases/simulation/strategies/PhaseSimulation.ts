import { Day, Season } from '../../../../domain/entities';
import { GamePhase } from '../../../../domain/enums';
import { HumanOffer, SimulationEngine, SimulationFlags } from '../../../../domain/simulation';
import { HumanDecision } from '../../../dtos/GameDTOs';
import { Repositories } from '../../../ports/IUnitOfWork';
import { SimulationState } from '../../../services/simulation';
import { AdvancePhaseUseCase } from '../../game/AdvancePhaseUseCase';
import { StartEndgameUseCase } from '../../game/StartEndgameUseCase';
import { RegisterEndgameRoundTableUseCase } from '../../phases/RegisterEndgameRoundTableUseCase';
import { RegisterMissionUseCase } from '../../phases/RegisterMissionUseCase';
import { RegisterRoundTableUseCase } from '../../phases/RegisterRoundTableUseCase';
import { RegisterTraitorsMeetingUseCase } from '../../phases/RegisterTraitorsMeetingUseCase';
import { SelectTraitorsUseCase } from '../../phases/SelectTraitorsUseCase';
import { SimulationMode } from './SimulationMode';

/** Casos de uso de registro reaproveitados: a simulação passa pelas mesmas regras do modo manual. */
export interface PhaseRecorders {
  selectTraitors: SelectTraitorsUseCase;
  mission: RegisterMissionUseCase;
  roundTable: RegisterRoundTableUseCase;
  traitorsMeeting: RegisterTraitorsMeetingUseCase;
  endgameRoundTable: RegisterEndgameRoundTableUseCase;
  startEndgame: StartEndgameUseCase;
  advance: AdvancePhaseUseCase;
}

/** Tudo que uma fase precisa para ser simulada e registrada. */
export interface PhaseContext {
  repos: Repositories;
  recorders: PhaseRecorders;
  season: Season;
  day: Day;
  state: SimulationState;
  engine: SimulationEngine;
  /** Memória entre fases (cópia): a fase pode deixar um convite dos traidores pendente. */
  flags: SimulationFlags;
  /** Convite dos traidores esperando a resposta do jogador. */
  offer?: HumanOffer;
  decision: HumanDecision;
  /** Temporada automática ou com o jogador: de onde vêm as decisões dele. */
  mode: SimulationMode;
}

/**
 * Strategy: como cada momento do dia é simulado e registrado.
 * O caso de uso escolhe a estratégia pela fase atual e não conhece os detalhes de nenhuma.
 */
export interface PhaseSimulation {
  readonly phase: GamePhase;
  run(ctx: PhaseContext): Promise<void>;
}
