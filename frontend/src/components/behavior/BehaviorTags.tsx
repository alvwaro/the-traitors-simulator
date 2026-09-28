import type { Behavior } from '../../domain/models';
import { summarizeEffects } from '../../domain/behaviors';
import { cx } from '../../lib/cx';
import styles from './BehaviorTags.module.css';

/** Tags de personalidade (só leitura). */
export function TagChips({ names, className }: Readonly<{ names: readonly string[]; className?: string }>) {
  if (names.length === 0) return null;
  return (
    <ul className={cx(styles.chips, className)}>
      {names.map((name) => (
        <li key={name} className={styles.chip}>
          {name}
        </li>
      ))}
    </ul>
  );
}

interface TagPickerProps {
  behaviors: readonly Behavior[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
}

/** Liga e desliga tags de personalidade; o efeito de cada uma aparece ao passar o mouse. */
export function TagPicker({ behaviors, value, onChange }: Readonly<TagPickerProps>) {
  if (behaviors.length === 0) return <p className={styles.empty}>Nenhum comportamento cadastrado.</p>;
  return (
    <div className={styles.picker} role="group" aria-label="Comportamentos">
      {behaviors.map((b) => {
        const on = value.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            className={cx(styles.option, on && styles.on)}
            aria-pressed={on}
            title={[b.description, summarizeEffects(b.effects)].filter(Boolean).join('\n')}
            onClick={() => onChange(on ? value.filter((id) => id !== b.id) : [...value, b.id])}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
