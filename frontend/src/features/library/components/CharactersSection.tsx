import { useMemo, useState } from 'react';
import { useServices } from '../../../app/services';
import { TagChips } from '../../../components/behavior/BehaviorTags';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Form';
import { ConfirmModal } from '../../../components/ui/Modal';
import { Ornament } from '../../../components/ui/Ornament';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState } from '../../../components/ui/States';
import { behaviorNames } from '../../../domain/behaviors';
import type { Behavior, Character } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import type { CharacterInput } from '../../../services/api/CharacterService';
import { CharacterForm } from './CharacterForm';
import styles from './Library.module.css';
import { PublishModal } from '../../publications/PublishModal';
import { useMyPublications } from '../../publications/useMyPublications';

interface CharactersSectionProps {
  characters: Character[];
  behaviors: Behavior[];
  onChanged: () => void;
}

export function CharactersSection({ characters, behaviors, onChanged }: Readonly<CharactersSectionProps>) {
  const { characters: service } = useServices();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState<Character | null>(null);
  const [publishing, setPublishing] = useState<Character | null>(null);
  const mine = useMyPublications();

  const create = useAction((input: CharacterInput) => service.create(input), { success: (c) => `${c.name} entrou para a biblioteca` });
  const update = useAction((id: string, input: CharacterInput) => service.update(id, input), { success: 'Personagem atualizado' });
  const remove = useAction(async (id: string) => { await service.remove(id); return true; }, { success: 'Personagem removido da biblioteca' });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return characters;
    return characters.filter((c) => c.name.toLowerCase().includes(term) || behaviorNames(c.behaviorIds, behaviors).some((n) => n.toLowerCase().includes(term)));
  }, [characters, behaviors, search]);

  async function handleCreate(input: CharacterInput) {
    const created = await create.run(input);
    if (created) onChanged();
    return !!created;
  }

  async function handleUpdate(input: CharacterInput) {
    if (!editing) return false;
    const updated = await update.run(editing.id, input);
    if (updated) {
      setEditing(null);
      onChanged();
    }
    return !!updated;
  }

  async function handleDelete() {
    if (!deleting) return;
    const ok = !!(await remove.run(deleting.id));
    setDeleting(null);
    if (ok) {
      setEditing(null);
      onChanged();
    }
  }

  return (
    <Panel>
      {editing ? (
        <>
          <p className={styles.editing}>Editando {editing.name}</p>
          <CharacterForm key={editing.id} initial={editing} behaviors={behaviors} submitLabel="Salvar alterações" pending={update.pending} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
          <div className={styles.dangerRow}>
            <Button variant="ghost" size="sm" onClick={() => setPublishing(editing)}>
              {mine.find('CHARACTER', editing.id) ? 'Publicação' : 'Publicar personagem'}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleting(editing)}>
              Remover da biblioteca
            </Button>
          </div>
        </>
      ) : (
        <CharacterForm behaviors={behaviors} submitLabel="Salvar personagem" pending={create.pending} onSubmit={handleCreate} />
      )}

      <Ornament label={`${characters.length} personagens`} />

      {characters.length > 0 && (
        <Input className={styles.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar pelo nome ou comportamento" aria-label="Procurar personagem" />
      )}

      {visible.length ? (
        <PortraitGrid
          items={visible}
          selectedIds={editing ? [editing.id] : []}
          onToggle={(id) => setEditing(characters.find((c) => c.id === id) ?? null)}
          caption={(c) => <TagChips names={behaviorNames(c.behaviorIds, behaviors).slice(0, 3)} />}
        />
      ) : (
        <EmptyState title={characters.length ? 'Ninguém encontrado' : 'A galeria está vazia'} />
      )}

      <ConfirmModal open={!!deleting} title="Remover personagem" onClose={() => setDeleting(null)} confirmLabel="Remover" danger pending={remove.pending} onConfirm={handleDelete}>
        <p>
          {deleting?.name} sairá da biblioteca e de todos os casts. Jogadores já registrados em temporadas continuam existindo.
        </p>
      </ConfirmModal>
      <PublishModal
        target={publishing ? { kind: 'CHARACTER', id: publishing.id, name: publishing.name } : null}
        current={publishing ? mine.find('CHARACTER', publishing.id) : null}
        onClose={() => setPublishing(null)}
        onDone={mine.reload}
      />
    </Panel>
  );
}
