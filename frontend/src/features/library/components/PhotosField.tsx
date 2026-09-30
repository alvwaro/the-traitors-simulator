import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Form';
import type { CharacterPhoto } from '../../../domain/models';
import styles from './Library.module.css';

/**
 * Fotos extras do personagem (ex.: uma por temporada). Cada cast pode usar uma delas
 * no lugar da foto principal.
 */
export function PhotosField({ value, onChange }: Readonly<{ value: CharacterPhoto[]; onChange: (photos: CharacterPhoto[]) => void }>) {
  const set = (i: number, patch: Partial<CharacterPhoto>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className={styles.tagField}>
      <span className={styles.fieldLabel}>Outras fotos</span>
      {value.map((photo, i) => (
        <div key={i} className={styles.photoRow}>
          {photo.url.trim() ? <img className={styles.photoThumb} src={photo.url} alt="" loading="lazy" /> : <span className={styles.photoThumb} aria-hidden="true" />}
          <Input type="url" value={photo.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="https://" aria-label={`Link da foto ${i + 1}`} />
          <Input value={photo.label ?? ''} onChange={(e) => set(i, { label: e.target.value })} placeholder="Legenda (ex.: EUA · 4ª temporada)" maxLength={80} aria-label={`Legenda da foto ${i + 1}`} />
          <Button variant="quiet" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Tirar
          </Button>
        </div>
      ))}
      <div>
        <Button variant="ghost" size="sm" onClick={() => onChange([...value, { url: '', label: null }])} disabled={value.length >= 20}>
          Adicionar foto
        </Button>
      </div>
      <span className={styles.fieldHint}>A mesma pessoa em temporadas diferentes: cada cast escolhe qual foto usar.</span>
    </div>
  );
}

/** Só as fotos com link preenchido, com a legenda aparada. */
export function cleanPhotos(photos: CharacterPhoto[]): CharacterPhoto[] {
  return photos.filter((p) => p.url.trim()).map((p) => ({ url: p.url.trim(), label: p.label?.trim() || null }));
}
