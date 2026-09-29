import { useState, type SubmitEvent } from 'react';
import { TagPicker } from '../../../components/behavior/BehaviorTags';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { IdentityFields } from '../../../components/player/IdentityFields';
import type { Behavior, Character } from '../../../domain/models';
import type { CharacterInput } from '../../../services/api/CharacterService';
import styles from './Library.module.css';
import { fireAndForget } from '../../../lib/async';

interface CharacterFormProps {
  initial?: Character;
  behaviors: Behavior[];
  pending?: boolean;
  submitLabel: string;
  onSubmit: (input: CharacterInput) => Promise<boolean>;
  onCancel?: () => void;
}

/** Cadastro/edição de personagem com prévia do retrato e tags de personalidade. */
export function CharacterForm({ initial, behaviors, pending, submitLabel, onSubmit, onCancel }: Readonly<CharacterFormProps>) {
  const [name, setName] = useState(initial?.name ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [behaviorIds, setBehaviorIds] = useState<string[]>(initial?.behaviorIds ?? []);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const ok = await onSubmit({ name: name.trim(), imageUrl: imageUrl.trim() || null, behaviorIds });
    if (ok && !initial) {
      setName('');
      setImageUrl('');
      setBehaviorIds([]);
    }
  }

  return (
    <form className={styles.characterForm} onSubmit={fireAndForget(handleSubmit)}>
      <Portrait name={name || 'Novo personagem'} imageUrl={imageUrl.trim() || null} size="md" />
      <div className={styles.formFields}>
        <IdentityFields name={name} imageUrl={imageUrl} onName={setName} onImageUrl={setImageUrl} namePlaceholder="Ex.: Lady Morag" />
        <div className={styles.tagField}>
          <span className={styles.fieldLabel}>Comportamentos</span>
          <TagPicker behaviors={behaviors} value={behaviorIds} onChange={setBehaviorIds} />
          <span className={styles.fieldHint}>Usados só nas temporadas automáticas.</span>
        </div>
        <div className={styles.formActions}>
          <Button type="submit" pending={pending} disabled={!name.trim()}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="quiet" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
