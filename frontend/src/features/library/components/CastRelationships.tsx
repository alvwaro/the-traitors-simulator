import { useMemo, useState } from 'react';
import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { Check } from '../../../components/ui/Form';
import { Modal } from '../../../components/ui/Modal';
import { ErrorState, Loading } from '../../../components/ui/States';
import type { Cast, Character, Relationship } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import { cx } from '../../../lib/cx';
import type { CastRelationshipPatch } from '../../../services/api/CastService';
import { Meter } from '../../simulation/components/Meter';
import styles from './CastDetail.module.css';
import { fireAndForget } from '../../../lib/async';

const DEFAULT = { trust: 50, liking: 50, hatred: 10, allied: false };

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
          <>
            <Meter value={value.trust} tone="trust" label="Confiança" />
            <Meter value={value.liking} tone="liking" label="Simpatia" />
            <Meter value={value.hatred} tone="hatred" label="Ódio" />
          </>
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
  const start = current ?? DEFAULT;
  const [trust, setTrust] = useState(start.trust);
  const [liking, setLiking] = useState(start.liking);
  const [hatred, setHatred] = useState(start.hatred);
  const [allied, setAllied] = useState(start.allied);
  const save = useAction((patch: CastRelationshipPatch) => casts.updateRelationship(castId, patch), { success: 'Relacionamento salvo' });

  async function submit(patch: Partial<CastRelationshipPatch>) {
    const result = await save.run({ fromId: from.id, toId: to.id, ...patch });
    if (result) onSaved(result.relationships);
  }

  const slider = (label: string, value: number, set: (n: number) => void) => (
    <label className={styles.slider}>
      <span>{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => set(Number(e.target.value))} />
      <strong>{value}%</strong>
    </label>
  );

  return (
    <Modal
      open
      title={`O que ${from.name} sente por ${to.name}`}
      onClose={onClose}
      footer={
        <>
          {current && (
            <Button variant="danger" pending={save.pending} onClick={fireAndForget(() => submit({ clear: true }))}>
              Voltar a sortear
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          <Button pending={save.pending} onClick={fireAndForget(() => submit({ trust, liking, hatred, allied }))}>
            Salvar
          </Button>
        </>
      }
    >
      <div className={styles.editFields}>
        {slider('Confiança', trust, setTrust)}
        {slider('Gosta', liking, setLiking)}
        {slider('Ódio', hatred, setHatred)}
        <Check label={`Aliança entre ${from.name} e ${to.name} (vale para os dois)`} checked={allied} onChange={(e) => setAllied(e.target.checked)} />
      </div>
    </Modal>
  );
}
