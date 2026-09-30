import { useState, type SubmitEvent } from 'react';
import { TagPicker } from '../../../components/behavior/BehaviorTags';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { Field, Select } from '../../../components/ui/Form';
import { IdentityFields } from '../../../components/player/IdentityFields';
import type { Behavior, Character } from '../../../domain/models';
import type { CharacterInput } from '../../../services/api/CharacterService';
import { cleanPhotos, PhotosField } from './PhotosField';
import styles from './Library.module.css';
import { fireAndForget } from '../../../lib/async';

interface CharacterFormProps {
  initial?: Character;
  behaviors: Behavior[];
  pending?: boolean;
  submitLabel: string;
  onSubmit: (input: CharacterInput) => Promise<boolean>;
  onCancel?: () => void;
  /** Casts para escolher onde o personagem novo entra (sem a lista, o campo não aparece). */
  casts?: readonly { id: string; name: string }[];
  /** Cast já escolhido ao abrir o formulário ('' = sem cast). */
  defaultCastId?: string;
}

/** Cadastro/edição de personagem com prévia do retrato e tags de personalidade. */
export function CharacterForm({ initial, behaviors, pending, submitLabel, onSubmit, onCancel, casts, defaultCastId = '' }: Readonly<CharacterFormProps>) {
  const [name, setName] = useState(initial?.name ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [behaviorIds, setBehaviorIds] = useState<string[]>(initial?.behaviorIds ?? []);
  const [photos, setPhotos] = useState(initial?.photos ?? []);
  const [castId, setCastId] = useState(defaultCastId);
  const choosesCast = !initial && !!casts;

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const ok = await onSubmit({ name: name.trim(), imageUrl: imageUrl.trim() || null, behaviorIds, photos: cleanPhotos(photos), ...(choosesCast || defaultCastId ? { castId: castId || null } : {}) });
    if (ok && !initial) {
      setName('');
      setImageUrl('');
      setBehaviorIds([]);
      setPhotos([]);
    }
  }

  return (
    <form className={styles.characterForm} onSubmit={fireAndForget(handleSubmit)}>
      <Portrait name={name || 'Novo personagem'} imageUrl={imageUrl.trim() || null} size="md" />
      <div className={styles.formFields}>
        <IdentityFields name={name} imageUrl={imageUrl} onName={setName} onImageUrl={setImageUrl} namePlaceholder="Ex.: Lady Morag" />
        <PhotosField value={photos} onChange={setPhotos} />
        {choosesCast && (
          <Field label="Cast" hint="O personagem entra no fim do elenco. Sem cast, ele fica em “Personagens sem cast”.">
            {(id) => (
              <Select id={id} value={castId} onChange={(e) => setCastId(e.target.value)}>
                <option value="">Personagens sem cast</option>
                {casts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
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
