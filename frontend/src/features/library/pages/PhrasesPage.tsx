import { useMemo, useState } from 'react';
import { useAuth } from '../../../app/auth';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import { PhrasePhase } from '../../../domain/enums';
import { phrasePhaseLabel, phraseToneLabel } from '../../../domain/labels';
import type { Phrase } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import { cx } from '../../../lib/cx';
import type { PhraseInput } from '../../../services/api/PhraseService';
import { PhraseForm } from '../components/PhraseForm';
import { PhraseText } from '../components/PhraseText';
import libraryStyles from './LibraryPage.module.css';
import styles from '../components/Phrases.module.css';
import { fireAndForget } from '../../../lib/async';

/** Frases das conversas: um momento do jogo por vez, com teor e comportamento de cada uma. */
export function PhrasesPage() {
  const { isOwner } = useAuth();
  const services = useServices();
  const list = useResource(() => services.phrases.list(), []);
  const behaviors = useResource(() => services.behaviors.list(), []);
  const [phase, setPhase] = useState<PhrasePhase>('BREAKFAST');
  const [editing, setEditing] = useState<Phrase | null>(null);

  const create = useAction((input: PhraseInput) => services.phrases.create(input), { success: 'Frase salva' });
  const update = useAction((id: string, input: PhraseInput) => services.phrases.update(id, input), { success: 'Frase atualizada' });
  const remove = useAction(async (id: string) => { await services.phrases.remove(id); return true; }, { success: 'Frase excluída' });

  const behaviorName = useMemo(() => new Map((behaviors.data ?? []).map((b) => [b.id, b.name])), [behaviors.data]);

  const error = list.error ?? behaviors.error;
  if (error) return <ErrorState error={error} onRetry={() => { list.reload(); behaviors.reload(); }} />;
  if (!list.data || !behaviors.data) return <Loading />;

  const items = list.data.filter((p) => p.phase === phase);

  async function handleCreate(input: PhraseInput) {
    const ok = !!(await create.run(input));
    if (ok) {
      setPhase(input.phase);
      list.reload();
    }
    return ok;
  }

  async function handleUpdate(input: PhraseInput) {
    if (!editing) return false;
    const ok = !!(await update.run(editing.id, input));
    if (ok) {
      setEditing(null);
      list.reload();
    }
    return ok;
  }

  async function handleDelete(id: string) {
    if (await remove.run(id)) {
      if (editing?.id === id) setEditing(null);
      list.reload();
    }
  }

  return (
    <div className={libraryStyles.stack}>
      {isOwner && (
      <Panel title={editing ? 'Editar frase' : 'Nova frase'}>
        {editing ? (
          <PhraseForm key={editing.id} initial={editing} behaviors={behaviors.data} pending={update.pending} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
        ) : (
          <PhraseForm key={phase} defaultPhase={phase} behaviors={behaviors.data} pending={create.pending} onSubmit={handleCreate} />
        )}
      </Panel>
      )}

      <section>
        <div className={styles.filters} role="tablist" aria-label="Momento do jogo">
          {Object.values(PhrasePhase).map((value) => {
            const count = list.data!.filter((p) => p.phase === value).length;
            return (
              <button key={value} type="button" role="tab" aria-selected={phase === value} className={cx(styles.filter, phase === value && styles.filterOn)} onClick={() => setPhase(value)}>
                {phrasePhaseLabel[value]} <span className={styles.filterCount}>{count}</span>
              </button>
            );
          })}
        </div>

        {items.length === 0 ? (
          <EmptyState title="Nenhuma frase neste momento" />
        ) : (
          <ul className={styles.list}>
            {items.map((p) => (
              <li key={p.id} className={cx(styles.item, editing?.id === p.id && styles.itemEditing)}>
                <div className={styles.itemBody}>
                  <div className={styles.badges}>
                    <span className={cx(styles.badge, styles[`tone-${p.tone}`])}>{phraseToneLabel[p.tone]}</span>
                    {p.behaviorId && <span className={styles.behaviorBadge}>{behaviorName.get(p.behaviorId) ?? '?'}</span>}
                  </div>
                  <PhraseText text={p.text} />
                </div>
                {isOwner && (
                  <div className={styles.itemActions}>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      Editar
                    </Button>
                    <Button variant="danger" size="sm" onClick={fireAndForget(() => handleDelete(p.id))}>
                      Excluir
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
