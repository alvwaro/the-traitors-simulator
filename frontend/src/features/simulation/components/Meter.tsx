import { cx } from '../../../lib/cx';
import styles from './Simulation.module.css';

export type MeterTone = 'trust' | 'suspicion' | 'liking' | 'hatred' | 'chance';

/** Barra horizontal de 0 a 100 com o valor ao lado. */
export function Meter({ value, tone, label, suffix = '' }: Readonly<{ value: number; tone: MeterTone; label: string; suffix?: string }>) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className={styles.meter} title={`${label}: ${Math.round(value)}${suffix}`}>
      <span className={styles.meterTrack} aria-hidden="true">
        <span className={cx(styles.meterFill, styles[tone])} style={{ width: `${clamped}%` }} />
      </span>
      <span className={styles.meterValue}>
        {Math.round(value)}
        {suffix}
      </span>
    </span>
  );
}
