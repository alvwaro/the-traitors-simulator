import type { SeasonMode } from '../../../domain/enums';
import { cx } from '../../../lib/cx';
import styles from './ModePicker.module.css';

const OPTIONS: { value: SeasonMode; title: string; text: string }[] = [
  {
    value: 'MANUAL',
    title: 'Manual',
    text: 'Você registra tudo: traidores, votos, missões, assassinatos.',
  },
  {
    value: 'AUTOMATIC',
    title: 'Automática',
    text: 'A simulação decide com base nos comportamentos e relacionamentos. Você só assiste e avança.',
  },
  {
    value: 'PLAYER',
    title: 'Jogador',
    text: 'Você entra no castelo: conversa, vota e pode ser sorteado(a) traidor(a). Só vê o que um participante veria.',
  },
];

/** Escolha entre temporada manual e automática. */
export function ModePicker({
  value,
  onChange,
  disabled,
  withPlayer = true,
}: Readonly<{
  value: SeasonMode;
  onChange: (mode: SeasonMode) => void;
  disabled?: boolean;
  /** O modo Jogador só pode ser escolhido na criação. */
  withPlayer?: boolean;
}>) {
  return (
    <div className={styles.options} role="radiogroup" aria-label="Modo da temporada">
      {OPTIONS.filter((o) => withPlayer || o.value !== 'PLAYER').map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          className={cx(styles.option, value === option.value && styles.on)}
          onClick={() => onChange(option.value)}
        >
          <span className={styles.title}>{option.title}</span>
          <span className={styles.text}>{option.text}</span>
        </button>
      ))}
    </div>
  );
}
