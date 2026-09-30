import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Form';
import type { Character } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { cx } from '../../../lib/cx';
import styles from './Library.module.css';

interface CastPhotoPickerProps {
  castId: string;
  character: Character;
  /** A foto que o personagem usa neste cast agora. */
  current: string | null;
  onChanged: () => void;
}

/** Qual foto o personagem usa só neste cast: a principal, uma da galeria ou um link. */
export function CastPhotoPicker({ castId, character, current, onChanged }: Readonly<CastPhotoPickerProps>) {
  const { casts } = useServices();
  const [custom, setCustom] = useState('');
  const save = useAction((imageUrl: string | null) => casts.memberPhoto(castId, character.id, imageUrl), { success: 'Foto do cast atualizada' });
  const options = [
    ...(character.imageUrl ? [{ url: character.imageUrl, label: 'Principal' }] : []),
    ...(character.photos ?? []).map((p) => ({ url: p.url, label: p.label ?? 'Foto' })),
  ];

  async function choose(url: string | null) {
    // A principal não precisa ficar gravada no cast: null volta a usá-la.
    const value = url === character.imageUrl ? null : url;
    if (await save.run(value)) onChanged();
  }

  return (
    <div className={styles.tagField}>
      <span className={styles.fieldLabel}>Foto neste cast</span>
      <div className={styles.photoChoices}>
        {options.map((o) => (
          <button
            key={o.url}
            type="button"
            className={cx(styles.photoChoice, o.url === current && styles.photoChoiceOn)}
            onClick={() => choose(o.url)}
            disabled={save.pending}
            aria-pressed={o.url === current}
          >
            <img src={o.url} alt="" loading="lazy" />
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.photoRow}>
        <Input type="url" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Outro link só para este cast" aria-label="Link de outra foto para este cast" />
        <Button variant="ghost" size="sm" disabled={!custom.trim() || save.pending} onClick={() => choose(custom.trim())}>
          Usar
        </Button>
      </div>
    </div>
  );
}
