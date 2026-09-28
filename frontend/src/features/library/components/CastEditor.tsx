import { useMemo, useState, type SubmitEvent } from 'react';
import { PortraitGrid, toggleIn } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { Field, FormRow, Input, TextArea } from '../../../components/ui/Form';
import type { Cast, Character } from '../../../domain/models';
import { initials } from '../../../lib/format';
import type { CastInput } from '../../../services/api/CastService';
import styles from './Library.module.css';
import { fireAndForget } from '../../../lib/async';

interface CastEditorProps {
  characters: Character[];
  initial?: Cast;
  pending?: boolean;
  onSubmit: (input: CastInput) => Promise<boolean>;
  onCancel?: () => void;
}

/** Monta um cast: capa opcional e personagens da galeria (a ordem do clique é a ordem do elenco). */
export function CastEditor({ characters, initial, pending, onSubmit, onCancel }: Readonly<CastEditorProps>) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [selected, setSelected] = useState<string[]>(initial?.characterIds ?? []);
  const [search, setSearch] = useState('');
  const [brokenCover, setBrokenCover] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? characters.filter((c) => c.name.toLowerCase().includes(term)) : characters;
  }, [characters, search]);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    await onSubmit({ name: name.trim(), description: description.trim() || null, imageUrl: imageUrl.trim() || null, characterIds: selected });
  }

  const cover = imageUrl.trim();

  return (
    <form className={styles.castEditor} onSubmit={fireAndForget(handleSubmit)}>
      <div className={styles.castEditorHead}>
        <div className={styles.coverPreview}>
          {cover && !brokenCover ? <img src={cover} alt="" onError={() => setBrokenCover(true)} /> : <span className={styles.coverCrest}>{initials(name || 'Cast')}</span>}
        </div>
        <div className={styles.formFields}>
          <FormRow>
            <Field label="Nome do cast">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Ex.: Elenco das Highlands" />}</Field>
            <Field label="Foto de capa (opcional)">
              {(id) => (
                <Input
                  id={id}
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setBrokenCover(false);
                  }}
                  placeholder="https://"
                />
              )}
            </Field>
          </FormRow>
          <Field label="Descrição">{(id) => <TextArea id={id} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Opcional" />}</Field>
        </div>
      </div>

      <div className={styles.selectionBar}>
        <p className={styles.selectionInfo}>
          {selected.length} de {characters.length} escolhidos
          {characters.length > 0 && (
            <>
              {' · '}
              <button type="button" className={styles.inlineLink} onClick={() => setSelected(selected.length === characters.length ? [] : characters.map((c) => c.id))}>
                {selected.length === characters.length ? 'limpar' : 'escolher todos'}
              </button>
            </>
          )}
        </p>
        <Input className={styles.searchSmall} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar" aria-label="Procurar personagem" />
      </div>
      <PortraitGrid items={visible} size="sm" selectedIds={selected} onToggle={(id) => setSelected((list) => toggleIn(list, id))} />

      <div className={styles.formActions}>
        <Button type="submit" pending={pending} disabled={!name.trim()}>
          {initial ? 'Salvar cast' : 'Criar cast'}
        </Button>
        {onCancel && (
          <Button variant="quiet" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
