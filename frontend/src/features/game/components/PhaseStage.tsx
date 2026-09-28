import { Panel } from '../../../components/ui/Panel';
import type { ReactElement } from 'react';
import { GamePhase, type SeasonMode } from '../../../domain/enums';
import { phaseLabel } from '../../../domain/labels';
import { useGame } from '../context/GameContext';
import { phaseComponents } from '../phases';
import { AutoPhase } from '../auto/AutoPhase';
import { PlayerPhase } from '../player/PlayerPhase';

/** Temporadas simuladas têm uma tela só; as manuais, um formulário por fase. */
const MODE_COMPONENTS: Partial<Record<SeasonMode, () => ReactElement | null>> = { PLAYER: PlayerPhase, AUTOMATIC: AutoPhase };

const SINISTER: GamePhase[] = [GamePhase.TRAITOR_SELECTION, GamePhase.TRAITORS_MEETING, GamePhase.ENDGAME_ROUND_TABLE, GamePhase.FINALE];

/** Palco da fase atual: escolhe o componente certo no registro de fases. */
export function PhaseStage() {
  const { state } = useGame();
  if (!state.phase) return null;

  // Temporada automática: a simulação decide e a tela só narra.
  const PhaseComponent = MODE_COMPONENTS[state.season.mode] ?? phaseComponents[state.phase];
  return (
    <Panel tone={SINISTER.includes(state.phase) ? 'blood' : 'stone'} title={phaseLabel[state.phase]}>
      <PhaseComponent />
    </Panel>
  );
}
