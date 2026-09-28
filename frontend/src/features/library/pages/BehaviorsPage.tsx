import { useState } from 'react';
import { useAuth } from '../../../app/auth';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import { EFFECTS } from '../../../domain/behaviors';
import type { Behavior } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import type { BehaviorInput } from '../../../services/api/BehaviorService';
import { BehaviorEditor } from '../components/BehaviorEditor';
import behaviorStyles from '../components/Behaviors.module.css';
import styles from './LibraryPage.module.css';
import { fireAndForget } from '../../../lib/async';

/** Comportamentos: as tags de personalidade que movem a simulação automática. */
export function BehaviorsPage() {
  const { isOwner } = useAuth();
  const { behaviors } = useServices();
  const list = useResource(() => behaviors.list(), []);
  const [editing, setEditing] = useState<Behavior | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Behavior | null>(null);

  const create = useAction((input: BehaviorInput) => behaviors.create(input), { success: (b) => `Comportamento "${b.name}" criado` });
  const update = useAction((id: string, input: BehaviorInput) => behaviors.update(id, input), { success: 'Comportamento atualizado' });
  const remove = useAction(async (id: string) => { await behaviors.remove(id); return true; }, { success: 'Comportamento excluído' });

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  async function handleSubmit(input: BehaviorInput) {
    const ok = editing === 'new' ? !!(await create.run(input)) : !!(editing && (await update.run(editing.id, input)));
    if (ok) {
      setEditing(null);
      list.reload();
    }
    return ok;
  }

  async function handleDelete() {
    if (!deleting) return;
    const ok = !!(await remove.run(deleting.id));
    setDeleting(null);
    if (ok) {
      setEditing(null);
      list.reload();
    }
  }

  if (editing) {
    const current = editing === 'new' ? undefined : editing;
    return (
      <Panel title={current ? `Editar ${current.name}` : 'Novo comportamento'}>
        <BehaviorEditor
          key={current?.id ?? 'new'}
          initial={current}
          pending={create.pending || update.pending}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
          onDelete={current ? () => setDeleting(current) : undefined}
        />
        <DeleteModal behavior={deleting} pending={remove.pending} onCancel={() => setDeleting(null)} onConfirm={fireAndForget(handleDelete)} />
      </Panel>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.count}>
          Cada tag muda como o personagem sente os outros, como é visto e como joga.{!isOwner && ' Os comportamentos valem para todo o site: só os donos editam.'}
        </p>
        {isOwner && <Button onClick={() => setEditing('new')}>Novo comportamento</Button>}
      </div>

      {list.data.length === 0 ? (
        <EmptyState title="Nenhum comportamento" />
      ) : (
        <div className={behaviorStyles.grid}>
          {list.data.map((b) => (
            <button key={b.id} type="button" className={behaviorStyles.card} disabled={!isOwner} onClick={() => setEditing(b)}>
              <span className={behaviorStyles.cardName}>{b.name}</span>
              {b.description && <span className={behaviorStyles.cardDescription}>{b.description}</span>}
              <span className={behaviorStyles.effects}>
                {EFFECTS.filter((e) => b.effects[e.key]).map((e) => {
                  const v = b.effects[e.key]!;
                  return (
                    <span key={e.key} className={v > 0 ? behaviorStyles.effectUp : behaviorStyles.effectDown}>
                      {e.label} {v > 0 ? `+${v}` : v}
                    </span>
                  );
                })}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function DeleteModal({ behavior, pending, onCancel, onConfirm }: Readonly<{ behavior: Behavior | null; pending: boolean; onCancel: () => void; onConfirm: () => void }>) {
  return (
    <Modal
      open={!!behavior}
      title="Excluir comportamento"
      onClose={onCancel}
      footer={
        <>
          <Button variant="quiet" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" pending={pending} onClick={onConfirm}>
            Excluir
          </Button>
        </>
      }
    >
      <p>"{behavior?.name}" sai de todos os personagens e jogadores. As frases ligadas a ele passam a valer para qualquer um.</p>
    </Modal>
  );
}
