import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import type { Cast } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import type { CastInput } from '../../../services/api/CastService';
import { CastCard } from '../components/CastCard';
import { CastDetail } from '../components/CastDetail';
import { CastEditor } from '../components/CastEditor';
import cardStyles from '../components/Library.module.css';
import styles from './LibraryPage.module.css';
import { fireAndForget } from '../../../lib/async';
import { PublishModal } from '../../publications/PublishModal';
import { useMyPublications } from '../../publications/useMyPublications';
import { MIN_PLAYERS_TO_START } from '../../../domain/rules';

/** Casts salvos como cartões com capa; o elenco só aparece ao editar. */
export function CastsPage() {
  const services = useServices();
  const characters = useResource(() => services.characters.list(), []);
  const casts = useResource(() => services.casts.list(), []);
  const mine = useMyPublications();
  const [publishing, setPublishing] = useState<Cast | null>(null);
  const [editing, setEditing] = useState<Cast | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Cast | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const create = useAction((input: CastInput) => services.casts.create(input), { success: (c) => `Cast "${c.name}" salvo` });
  const update = useAction((id: string, input: CastInput) => services.casts.update(id, input), { success: 'Cast atualizado' });
  const remove = useAction(async (id: string) => { await services.casts.remove(id); return true; }, { success: 'Cast removido' });

  const error = characters.error ?? casts.error;
  if (error) return <ErrorState error={error} onRetry={() => { characters.reload(); casts.reload(); }} />;
  if (!characters.data || !casts.data) return <Loading />;

  async function handleSubmit(input: CastInput) {
    const ok = editing === 'new' ? !!(await create.run(input)) : !!(editing && (await update.run(editing.id, input)));
    if (ok) {
      setEditing(null);
      casts.reload();
    }
    return ok;
  }

  async function handleDelete() {
    if (!deleting) return;
    const ok = !!(await remove.run(deleting.id));
    setDeleting(null);
    if (ok) casts.reload();
  }

  if (editing) {
    return (
      <Panel title={editing === 'new' ? 'Novo cast' : `Editar ${editing.name}`}>
        <CastEditor
          key={editing === 'new' ? 'new' : editing.id}
          characters={characters.data}
          initial={editing === 'new' ? undefined : editing}
          pending={create.pending || update.pending}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />
      </Panel>
    );
  }

  const viewing = casts.data.find((c) => c.id === viewingId);
  if (viewing) {
    return (
      <CastDetail
        cast={viewing}
        onBack={() => setViewingId(null)}
        onEdit={() => { setViewingId(null); setEditing(viewing); }}
        onChanged={() => { casts.reload(); characters.reload(); }}
      />
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.count}>{casts.data.length === 1 ? '1 cast' : `${casts.data.length} casts`}</p>
        <Button onClick={() => setEditing('new')} disabled={!characters.data.length}>
          Novo cast
        </Button>
      </div>

      {casts.data.length === 0 ? (
        <EmptyState title="Nenhum cast salvo">{characters.data.length ? 'Monte um grupo de personagens para começar temporadas mais rápido.' : 'Cadastre personagens primeiro.'}</EmptyState>
      ) : (
        <div className={cardStyles.castGrid}>
          {casts.data.map((cast) => (
            <CastCard
              key={cast.id}
              cast={cast}
              published={!!mine.find('CAST', cast.id)}
              onOpen={() => setViewingId(cast.id)}
              onEdit={() => setEditing(cast)}
              onDelete={() => setDeleting(cast)}
              onPublish={() => setPublishing(cast)}
            />
          ))}
        </div>
      )}

      <PublishModal
        target={publishing ? { kind: 'CAST', id: publishing.id, name: publishing.name } : null}
        current={publishing ? mine.find('CAST', publishing.id) : null}
        blockedReason={publishing && publishing.characters.length < MIN_PLAYERS_TO_START ? `Um cast publicado precisa de pelo menos ${MIN_PLAYERS_TO_START} personagens.` : null}
        onClose={() => setPublishing(null)}
        onDone={mine.reload}
      />

      <Modal
        open={!!deleting}
        title="Remover cast"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" pending={remove.pending} onClick={fireAndForget(handleDelete)}>
              Remover
            </Button>
          </>
        }
      >
        <p>O cast "{deleting?.name}" será apagado. Os personagens continuam na biblioteca.</p>
      </Modal>
    </>
  );
}
