import { Panel } from '../../../components/ui/Panel';
import { useGame } from '../context/GameContext';
import { useTelling } from '../drama/DramaContext';
import { PhaseNotes } from '../phases/shared/PhaseNotes';
import { ManagerTools } from './ManagerTools';
import { Roster } from './Roster';
import styles from './GameView.module.css';

/** Tudo que não é a simulação em si: anotações da fase (só na temporada manual), elenco e ferramentas. */
export function InfoSection() {
  const { state } = useGame();
  const telling = useTelling();
  return (
    <div className={styles.info}>
      {state.season.mode === 'MANUAL' && state.phase && state.phase !== 'FINALE' && (
        <Panel title="Anotações">
          <PhaseNotes />
        </Panel>
      )}
      {/* No drama, o elenco (com quem saiu) espera a história do momento terminar. */}
      {telling ? <p className={styles.waiting}>O elenco aparece quando a história deste momento terminar.</p> : <Roster />}
      {(!state.player || state.player.spectator) && <ManagerTools />}
    </div>
  );
}
