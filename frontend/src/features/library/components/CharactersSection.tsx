import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { TagChips } from '../../../components/behavior/BehaviorTags';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { ButtonLink } from '../../../components/ui/ButtonLink';
import { Input } from '../../../components/ui/Form';
import { ConfirmModal } from '../../../components/ui/Modal';
import { Ornament } from '../../../components/ui/Ornament';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState } from '../../../components/ui/States';
import { behaviorNames } from '../../../domain/behaviors';
import type { Behavior, Cast, Character } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import type { CharacterInput } from '../../../services/api/CharacterService';
import { CardCover } from './CardCover';
import { CastPhotoPicker } from './CastPhotoPicker';
import { CharacterForm } from './CharacterForm';
import { castPath, NO_CAST_NAME, uncast } from './castGroups';
import styles from './Library.module.css';
import { PublishModal } from '../../publications/PublishModal';
import { useMyPublications } from '../../publications/useMyPublications';

interface CharactersSectionProps {
  characters: Character[];
  behaviors: Behavior[];
  casts: Cast[];
  onChanged: () => void;
  /**
   * Só um grupo (a página de um cast): o formulário cria direto nele e a lista não tem seções.
   * `null` é o grupo "Personagens sem cast".
   */
  scope?: { castId: string | null };
}

interface Group {
  key: string;
  cast: Cast | null;
  title: string;
  to: string;
  /** Os personagens como aparecem no grupo (no cast, com a foto escolhida para ele). */
  items: Character[];
}

const count = (n: number) => (n === 1 ? '1 personagem' : `${n} personagens`);

/**
 * Personagens separados por cast (na ordem do elenco) e, no fim, os que não estão em nenhum.
 * Cada cast é um retângulo com capa e informações; os retratos só carregam quando ele é expandido.
 */
export function CharactersSection({ characters, behaviors, casts, onChanged, scope }: Readonly<CharactersSectionProps>) {
  const { characters: service } = useServices();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState<Character | null>(null);
  const [publishing, setPublishing] = useState<Character | null>(null);
  const mine = useMyPublications();

  const create = useAction((input: CharacterInput) => service.create(input), { success: (c) => `${c.name} entrou para a biblioteca` });
  const update = useAction((id: string, input: CharacterInput) => service.update(id, input), { success: 'Personagem atualizado' });
  const remove = useAction(async (id: string) => { await service.remove(id); return true; }, { success: 'Personagem removido da biblioteca' });

  const groups = useMemo<Group[]>(() => {
    const all: Group[] = [
      ...casts.map((cast) => ({ key: cast.id, cast, title: cast.name, to: castPath(cast.id), items: cast.characters })),
      { key: 'none', cast: null, title: NO_CAST_NAME, to: castPath(null), items: uncast(characters, casts) },
    ];
    if (scope) return all.filter((g) => g.key === (scope.castId ?? 'none'));
    return all.filter((g) => g.cast || g.items.length > 0);
  }, [characters, casts, scope]);

  const term = search.trim().toLowerCase();
  const matches = (c: Character) => !term || c.name.toLowerCase().includes(term) || behaviorNames(c.behaviorIds, behaviors).some((n) => n.toLowerCase().includes(term));
  const visible = groups.map((g) => ({ ...g, items: g.items.filter(matches) })).filter((g) => !term || g.items.length > 0);
  const total = scope ? (groups[0]?.items.length ?? 0) : characters.length;
  let emptyTitle = 'A galeria está vazia';
  if (total) emptyTitle = 'Ninguém encontrado';
  else if (scope) emptyTitle = 'Ninguém neste cast ainda';

  const scopedCast = scope?.castId ? casts.find((c) => c.id === scope.castId) : undefined;
  const castPhoto = (id: string) => scopedCast?.characters.find((c) => c.id === id)?.imageUrl ?? null;

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  const grid = (items: Character[]) => (
    <PortraitGrid
      items={items}
      selectedIds={editing ? [editing.id] : []}
      onToggle={(id) => setEditing(characters.find((c) => c.id === id) ?? null)}
      caption={(c) => <TagChips names={behaviorNames(c.behaviorIds, behaviors).slice(0, 3)} />}
    />
  );

  function groupCard(g: Group) {
    // Procurando, os casts com resultado se abrem sozinhos.
    const expanded = open.has(g.key) || !!term;
    return (
      <article key={g.key} className={`${styles.groupCard} ${styles.castGroup}`} aria-label={g.title}>
        <CardCover name={g.title} imageUrl={g.cast?.imageUrl ?? null} label={`Abrir ${g.title}`} onOpen={() => navigate(g.to)} />
        <div className={styles.castBody}>
          <h3 className={styles.castName}>
            <Link to={g.to} className={styles.castOpen}>
              {g.title}
            </Link>
          </h3>
          <p className={styles.castMeta}>{count(g.items.length)}</p>
          {g.cast?.description && <p className={styles.castDescription}>{g.cast.description}</p>}
          <div className={styles.castActions}>
            {g.items.length > 0 && (
              <button type="button" className={styles.inlineLink} aria-expanded={expanded} onClick={() => toggle(g.key)}>
                {expanded ? 'Recolher' : 'Expandir'}
              </button>
            )}
            <Link to={g.to} className={styles.inlineLink}>
              Abrir cast
            </Link>
            {g.cast && (
              <Link to={`/temporadas/nova?cast=${g.cast.id}`} className={styles.inlineLink}>
                Nova temporada
              </Link>
            )}
          </div>
        </div>
        {expanded && g.items.length > 0 && <div className={styles.groupExpanded}>{grid(g.items)}</div>}
      </article>
    );
  }

  // Dentro da página de um cast já existe um painel em volta.
  const Frame = scope ? 'div' : Panel;
  return (
    <Frame>
      {editing ? (
        <>
          <p className={styles.editing}>Editando {editing.name}</p>
          <CharacterForm key={editing.id} initial={editing} behaviors={behaviors} submitLabel="Salvar alterações" pending={update.pending} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
          {scopedCast && <CastPhotoPicker key={`photo-${editing.id}`} castId={scopedCast.id} character={editing} current={castPhoto(editing.id)} onChanged={onChanged} />}
          <div className={styles.dangerRow}>
            <ButtonLink to={`/participantes/${editing.id}`} variant="ghost" size="sm">
              Página do participante
            </ButtonLink>
            <Button variant="ghost" size="sm" onClick={() => setPublishing(editing)}>
              {mine.find('CHARACTER', editing.id) ? 'Publicação' : 'Publicar personagem'}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleting(editing)}>
              Remover da biblioteca
            </Button>
          </div>
        </>
      ) : (
        <CharacterForm
          key={scope ? (scope.castId ?? 'none') : 'all'}
          behaviors={behaviors}
          submitLabel={scope?.castId ? 'Salvar no cast' : 'Salvar personagem'}
          pending={create.pending}
          onSubmit={handleCreate}
          casts={scope ? undefined : casts}
          defaultCastId={scope?.castId ?? ''}
        />
      )}

      <Ornament label={count(total)} />

      {total > 0 && (
        <Input className={styles.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar pelo nome ou comportamento" aria-label="Procurar personagem" />
      )}

      {(scope ? visible.every((g) => g.items.length === 0) : visible.length === 0) && <EmptyState title={emptyTitle} />}

      {scope ? visible.map((g) => g.items.length > 0 && <div key={g.key}>{grid(g.items)}</div>) : visible.map(groupCard)}

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
    </Frame>
  );
}
