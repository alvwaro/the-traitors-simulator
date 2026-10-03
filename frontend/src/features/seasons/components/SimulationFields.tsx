import { Link } from 'react-router-dom';
import { Check, Field, Select } from '../../../components/ui/Form';
import { chaosLabel, missionPoolLabel } from '../../../domain/labels';
import type { MissionPool } from '../../../domain/models';
import styles from './ModePicker.module.css';

export interface SimulationDraft {
  chaos: number;
  missionPool: MissionPool;
  withdrawals: boolean;
  /** Chance (0 a 100) de os escudos de uma missão ficarem misteriosos. */
  hiddenShieldChance: number;
}

/** Como a simulação aparece na tela (pode mudar a qualquer momento, sem mudar o jogo). */
export interface DisplayDraft {
  drama: boolean;
  showPhrases: boolean;
}

export const DEFAULT_DISPLAY: DisplayDraft = { drama: false, showPhrases: true };

/** As opções de exibição de uma temporada (as que ela não tiver gravadas ficam no padrão). */
export function displayOf(season: { drama?: boolean; showPhrases?: boolean }): DisplayDraft {
  return { drama: season.drama ?? DEFAULT_DISPLAY.drama, showPhrases: season.showPhrases ?? DEFAULT_DISPLAY.showPhrases };
}

/**
 * Drama (só no modo Jogador): os votos, quem desce para o café e o resto de cada momento aparecem um de cada vez.
 * Desativar frases: as falas da biblioteca somem da narrativa (no modo Jogador, ficam só as que envolvem você).
 */
export function DisplayFields({ value, onChange, playerMode }: Readonly<{ value: DisplayDraft; onChange: (value: DisplayDraft) => void; playerMode: boolean }>) {
  return (
    <div className={styles.simulation}>
      {playerMode && (
        <Check
          label="Drama: os acontecimentos aparecem um de cada vez (votos, quem desce para o café...) e você avança quando quiser"
          checked={value.drama}
          onChange={(e) => onChange({ ...value, drama: e.target.checked })}
        />
      )}
      <Check
        label={playerMode ? 'Desativar frases: só aparecem as falas que envolvem você' : 'Desativar frases: a narrativa fica só com o que importa (eliminações, votos, missões)'}
        checked={!value.showPhrases}
        onChange={(e) => onChange({ ...value, showPhrases: !e.target.checked })}
      />
    </div>
  );
}

/** O que a chance de escudo misterioso significa. */
function hiddenShieldLabel(chance: number): string {
  if (chance === 0) return 'Sempre mostra quem ganhou escudo';
  if (chance === 100) return 'Sempre esconde quem ganhou escudo';
  return `Em ${chance}% das missões, quem ganhou escudo fica em segredo`;
}

const POOL_GROUPS: readonly { label: string; pools: readonly MissionPool[] }[] = [
  { label: 'Estados Unidos', pools: ['US_S1', 'US_S2', 'US_S3', 'US_S4'] },
  { label: 'Reino Unido', pools: ['UK_S1', 'UK_S2', 'UK_S3'] },
  { label: 'Misturado', pools: ['MIX'] },
];

/**
 * Loucura (0% a 100%), de qual temporada do programa vêm as missões, escudos misteriosos e se há desistências.
 * Só valem nas temporadas automáticas.
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
      <Field
        label="Temporada do programa"
        hint={
          <>
            Missões, valores e reviravoltas mudam entre EUA e Reino Unido. As missões seguem a ordem em que foram ao ar; depois da última, voltam como revanche.{' '}
            <Link to={`/guia/${value.missionPool}`}>Ver no guia</Link>
          </>
        }
      >
        {(id) => (
          <Select id={id} value={value.missionPool} onChange={(e) => onChange({ ...value, missionPool: e.target.value as MissionPool })}>
            {POOL_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.pools.map((pool) => (
                  <option key={pool} value={pool}>
                    {missionPoolLabel[pool]}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        )}
      </Field>
      <label className={styles.chaos}>
        <span className={styles.chaosHead}>
          <span className={styles.chaosTitle}>Escudo misterioso</span>
          <strong className={styles.chaosValue}>{value.hiddenShieldChance}%</strong>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.hiddenShieldChance}
          onChange={(e) => onChange({ ...value, hiddenShieldChance: Number(e.target.value) })}
          aria-label="Chance de escudo misterioso"
        />
        <span className={styles.chaosHint}>{hiddenShieldLabel(value.hiddenShieldChance)}. Escudo em segredo aparece como “?” na simulação.</span>
      </label>
      <Check
        label="Permitir desistências (alguém pode deixar o castelo por motivos pessoais)"
        checked={value.withdrawals}
        onChange={(e) => onChange({ ...value, withdrawals: e.target.checked })}
      />
    </div>
  );
}
