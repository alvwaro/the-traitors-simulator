import { useMemo, useState } from 'react';
import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { ErrorState, Loading } from '../../../components/ui/States';
import type { Cast, Character, Relationship } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import { cx } from '../../../lib/cx';
import type { CastRelationshipPatch } from '../../../services/api/CastService';
import { FeelingMeters, FeelingsEditor, NEUTRAL_FEELINGS } from '../../simulation/components/FeelingsEditor';
import styles from './CastDetail.module.css';
import { fireAndForget } from '../../../lib/async';

/**
 * Relacionamentos do cast: o que cada personagem sente pelos outros.
 * Vira o ponto de partida das temporadas automáticas criadas com este cast;
 * o que não for definido é sorteado pelos comportamentos.
 */
export function CastRelationships({ cast }: Readonly<{ cast: Cast }>) {
  const { casts } = useServices();
  const remote = useResource(() => casts.relationships(cast.id), [cast.id]);
  const [local, setLocal] = useState<Relationship[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(cast.characters[0]?.id ?? null);
  const [editing, setEditing] = useState<{ from: Character; to: Character } | null>(null);

  const loaded = remote.data?.relationships;
  const relationships = useMemo(() => local ?? loaded ?? [], [local, loaded]);
  const lookup = useMemo(() => new Map(relationships.map((r) => [`${r.fromId}>${r.toId}`, r])), [relationships]);
  const defined = (a: string, b: string) => lookup.get(`${a}>${b}`);

  if (remote.error) return <ErrorState error={remote.error} onRetry={remote.reload} />;
  if (!remote.data) return <Loading />;
  if (cast.characters.length < 2) return <p className={styles.muted}>O cast precisa de pelo menos dois personagens.</p>;

  const selected = cast.characters.find((c) => c.id === selectedId) ?? cast.characters[0];
  const others = cast.characters.filter((c) => c.id !== selected.id);
  const count = (id: string) => relationships.filter((r) => r.fromId === id).length;

  return (
    <div className={styles.relationships}>
      <p className={styles.muted}>
        Escolha um personagem e ajuste o que ele sente por cada um e o que cada um sente por ele. Pares em branco são sorteados pelos comportamentos quando a temporada é criada.
      </p>
      <div className={styles.picker}>
        {cast.characters.map((c) => (
          <button key={c.id} type="button" className={cx(styles.pickerItem, c.id === selected.id && styles.pickerOn)} onClick={() => setSelectedId(c.id)}>
            <Portrait name={c.name} imageUrl={c.imageUrl} size="xs" hideName />
            <span className={styles.pickerName}>{c.name}</span>
            {count(c.id) > 0 && <span className={styles.pickerCount}>{count(c.id)}</span>}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Personagem</th>
              <th scope="col" colSpan={3}>O que {selected.name} sente</th>
              <th scope="col" colSpan={3} className={styles.divider}>O que sente por {selected.name}</th>
            </tr>
          </thead>
          <tbody>
            {others.map((other) => (
              <tr key={other.id}>
                <th scope="row">
                  <span className={styles.who}>
                    <Portrait name={other.name} imageUrl={other.imageUrl} size="xs" hideName />
                    <span>
                      {other.name}
                      {defined(selected.id, other.id)?.allied && <span className={styles.ally}> · aliança</span>}
                    </span>
                  </span>
                </th>
                <FeelingCell value={defined(selected.id, other.id)} onEdit={() => setEditing({ from: selected, to: other })} />
                <FeelingCell value={defined(other.id, selected.id)} divider onEdit={() => setEditing({ from: other, to: selected })} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          castId={cast.id}
          from={editing.from}
          to={editing.to}
          current={defined(editing.from.id, editing.to.id)}
          onClose={() => setEditing(null)}
          onSaved={(list) => {
            setLocal(list);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function FeelingCell({ value, divider, onEdit }: Readonly<{ value: Relationship | undefined; divider?: boolean; onEdit: () => void }>) {
  return (
    <td colSpan={3} className={divider ? styles.divider : undefined}>
      <button type="button" className={styles.feelings} onClick={onEdit} title="Ajustar">
        {value ? (
          <FeelingMeters feelings={value} />
        ) : (
          <span className={styles.random}>Sorteado · definir</span>
        )}
      </button>
    </td>
  );
}

function EditModal({
  castId,
  from,
  to,
  current,
  onClose,
  onSaved,
}: Readonly<{
  castId: string;
  from: Character;
  to: Character;
  current: Relationship | undefined;
  onClose: () => void;
  onSaved: (list: Relationship[]) => void;
}>) {
  const { casts } = useServices();
  const save = useAction((patch: CastRelationshipPatch) => casts.updateRelationship(castId, patch), { success: 'Relacionamento salvo' });

  async function submit(patch: Partial<CastRelationshipPatch>) {
    const result = await save.run({ fromId: from.id, toId: to.id, ...patch });
    if (result) onSaved(result.relationships);
  }

  return (
    <FeelingsEditor
      from={from}
      to={to}
      initial={current ?? NEUTRAL_FEELINGS}
      pending={save.pending}
      onClose={onClose}
      onSave={submit}
      extra={
        current && (
          <Button variant="danger" pending={save.pending} onClick={fireAndForget(() => submit({ clear: true }))}>
            Voltar a sortear
          </Button>
        )
      }
    />
  );
}
