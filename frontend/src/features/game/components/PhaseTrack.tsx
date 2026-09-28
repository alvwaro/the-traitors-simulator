import { phaseShortLabel } from '../../../domain/labels';
import { trackFor } from '../../../domain/phaseTrack';
import { cx } from '../../../lib/cx';
import { useGame } from '../context/GameContext';
import styles from './PhaseTrack.module.css';

/** Trilha das fases do dia, com a atual em destaque. */
export function PhaseTrack() {
  const { state } = useGame();
  if (!state.day || !state.phase) return null;

  const phases = trackFor(state.day, state.phase, state.season.status === 'ENDGAME' || state.season.status === 'FINISHED');
  const current = phases.indexOf(state.phase);

  return (
    <ol className={styles.track}>
      {phases.map((phase, index) => (
        <li key={phase} className={cx(styles.step, index < current && styles.done, index === current && styles.current)}>
          <span className={styles.index}>{index + 1}</span>
          <span className={styles.label}>{phaseShortLabel[phase]}</span>
        </li>
      ))}
    </ol>
  );
}
