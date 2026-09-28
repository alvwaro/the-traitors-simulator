import { Field, Select } from '../../../components/ui/Form';
import { chaosLabel, missionPoolLabel } from '../../../domain/labels';
import type { MissionPool } from '../../../domain/models';
import styles from './ModePicker.module.css';

export interface SimulationDraft {
  chaos: number;
  missionPool: MissionPool;
}

/**
 * Loucura (0% a 100%) e de qual temporada vêm as missões. Só valem nas temporadas automáticas.
 * Loucura 0%: todos seguem o comportamento esperado; 100%: toda decisão sai no acaso.
 */
export function SimulationFields({ value, onChange }: Readonly<{ value: SimulationDraft; onChange: (value: SimulationDraft) => void }>) {
  return (
    <div className={styles.simulation}>
      <label className={styles.chaos}>
        <span className={styles.chaosHead}>
          <span className={styles.chaosTitle}>Loucura</span>
          <strong className={styles.chaosValue}>{value.chaos}%</strong>
        </span>
        <input type="range" min={0} max={100} step={5} value={value.chaos} onChange={(e) => onChange({ ...value, chaos: Number(e.target.value) })} />
        <span className={styles.chaosHint}>{chaosLabel(value.chaos)}. Decide se os personagens seguem o comportamento esperado ou surpreendem.</span>
      </label>
      <Field label="Missões" hint="As missões seguem a ordem em que foram ao ar; depois da última, voltam como revanche.">
        {(id) => (
          <Select id={id} value={value.missionPool} onChange={(e) => onChange({ ...value, missionPool: e.target.value as MissionPool })}>
            {Object.entries(missionPoolLabel).map(([pool, label]) => (
              <option key={pool} value={pool}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}
