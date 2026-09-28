import { Panel } from '../../../components/ui/Panel';
import { useGame } from '../context/GameContext';
import { PhaseNotes } from '../phases/shared/PhaseNotes';
import { ManagerTools } from './ManagerTools';
import { Roster } from './Roster';
import styles from './GameView.module.css';

/** Tudo que não é a simulação em si: anotações da fase (só na temporada manual), elenco e ferramentas. */
export function InfoSection() {
  const { state } = useGame();
  return (
    <div className={styles.info}>
      {state.season.mode === 'MANUAL' && state.phase && state.phase !== 'FINALE' && (
        <Panel title="Anotações">
          <PhaseNotes />
        </Panel>
      )}
      <Roster />
      {(!state.player || state.player.spectator) && <ManagerTools />}
    </div>
  );
}
