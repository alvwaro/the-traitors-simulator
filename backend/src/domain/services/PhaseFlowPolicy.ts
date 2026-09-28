import { GamePhase } from '../enums';
import { DomainError } from '../errors/DomainError';

export interface PhasePosition {
  day: number;
  phase: GamePhase;
}

/**
 * Regra de sequência das fases.
 *
 *   Dia 1:   ARRIVAL → TRAITOR_SELECTION → MISSION → TRAITORS_MEETING   (sem mesa redonda)
 *   Dia 2+:  BREAKFAST → MISSION → ROUND_TABLE → TRAITORS_MEETING
 *   Final:   BREAKFAST → MISSION → ENDGAME_ROUND_TABLE → FINALE
 */
export class PhaseFlowPolicy {
  private static readonly FIRST_DAY = [GamePhase.ARRIVAL, GamePhase.TRAITOR_SELECTION, GamePhase.MISSION, GamePhase.TRAITORS_MEETING];
  private static readonly REGULAR_DAY = [GamePhase.BREAKFAST, GamePhase.MISSION, GamePhase.ROUND_TABLE, GamePhase.TRAITORS_MEETING];
  private static readonly ENDGAME_DAY = [GamePhase.BREAKFAST, GamePhase.MISSION, GamePhase.ENDGAME_ROUND_TABLE, GamePhase.FINALE];

  initial(): PhasePosition {
    return { day: 1, phase: GamePhase.ARRIVAL };
  }

  phasesOf(day: number, isEndgame: boolean): GamePhase[] {
    if (day === 1) return PhaseFlowPolicy.FIRST_DAY;
    return isEndgame ? PhaseFlowPolicy.ENDGAME_DAY : PhaseFlowPolicy.REGULAR_DAY;
  }

  next(current: PhasePosition, isEndgame: boolean): PhasePosition {
    if (current.phase === GamePhase.FINALE) throw new DomainError('A temporada já terminou');

    const phases = this.phasesOf(current.day, isEndgame);
    const index = phases.indexOf(current.phase);
    if (index === -1) {
      // Final iniciada depois da mesa redonda do dia: a noite ainda acontece e a final começa amanhã.
      if (isEndgame && current.phase === GamePhase.ROUND_TABLE) return { day: current.day, phase: GamePhase.TRAITORS_MEETING };
      if (isEndgame && current.phase === GamePhase.TRAITORS_MEETING) return { day: current.day + 1, phase: GamePhase.BREAKFAST };
      throw new DomainError(`Fase ${current.phase} não pertence ao dia ${current.day}`);
    }

    if (index < phases.length - 1) return { day: current.day, phase: phases[index + 1] };
    return { day: current.day + 1, phase: this.phasesOf(current.day + 1, isEndgame)[0] };
  }
}
