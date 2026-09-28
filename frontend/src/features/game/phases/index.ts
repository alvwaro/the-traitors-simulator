import type { ComponentType } from 'react';
import type { GamePhase } from '../../../domain/enums';
import { ArrivalPhase } from './ArrivalPhase';
import { BreakfastPhase } from './BreakfastPhase';
import { EndgameRoundTablePhase } from './EndgameRoundTablePhase';
import { FinalePhase } from './FinalePhase';
import { MissionPhase } from './MissionPhase';
import { RoundTablePhase } from './RoundTablePhase';
import { TraitorSelectionPhase } from './TraitorSelectionPhase';
import { TraitorsMeetingPhase } from './TraitorsMeetingPhase';

/**
 * Registro fase → tela. Para uma fase nova basta criar o componente e
 * adicioná-lo aqui; o PhaseStage não precisa mudar (aberto/fechado).
 */
export const phaseComponents: Record<GamePhase, ComponentType> = {
  ARRIVAL: ArrivalPhase,
  TRAITOR_SELECTION: TraitorSelectionPhase,
  BREAKFAST: BreakfastPhase,
  MISSION: MissionPhase,
  ROUND_TABLE: RoundTablePhase,
  TRAITORS_MEETING: TraitorsMeetingPhase,
  ENDGAME_ROUND_TABLE: EndgameRoundTablePhase,
  FINALE: FinalePhase,
};
