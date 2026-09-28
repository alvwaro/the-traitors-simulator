import { GamePhase } from './enums';

// Mesma regra do PhaseFlowPolicy do backend, usada só para exibição.
const FIRST_DAY: GamePhase[] = [GamePhase.ARRIVAL, GamePhase.TRAITOR_SELECTION, GamePhase.MISSION, GamePhase.TRAITORS_MEETING];
const REGULAR_DAY: GamePhase[] = [GamePhase.BREAKFAST, GamePhase.MISSION, GamePhase.ROUND_TABLE, GamePhase.TRAITORS_MEETING];
const ENDGAME_DAY: GamePhase[] = [GamePhase.BREAKFAST, GamePhase.MISSION, GamePhase.ENDGAME_ROUND_TABLE, GamePhase.FINALE];

export function phasesOfDay(day: number, isEndgame: boolean): GamePhase[] {
  if (day === 1) return FIRST_DAY;
  return isEndgame ? ENDGAME_DAY : REGULAR_DAY;
}

/** Fases do dia atual para a trilha, considerando final iniciada no meio do dia. */
export function trackFor(day: number, phase: GamePhase, isEndgame: boolean): GamePhase[] {
  const phases = phasesOfDay(day, isEndgame);
  return phases.includes(phase) ? phases : phasesOfDay(day, false);
}

export function nextPhase(day: number, phase: GamePhase, isEndgame: boolean): { day: number; phase: GamePhase } | null {
  if (phase === GamePhase.FINALE) return null;
  const phases = phasesOfDay(day, isEndgame);
  const index = phases.indexOf(phase);
  if (index === -1) {
    if (isEndgame && phase === GamePhase.ROUND_TABLE) return { day, phase: GamePhase.TRAITORS_MEETING };
    return { day: day + 1, phase: GamePhase.BREAKFAST };
  }
  if (index < phases.length - 1) return { day, phase: phases[index + 1] };
  return { day: day + 1, phase: phasesOfDay(day + 1, isEndgame)[0] };
}
