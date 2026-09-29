import { useMemo, useState } from 'react';
import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import type { Player, Relationship, Relationships } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import type { RelationshipPatch } from '../../../services/api/SimulationService';
import { FeelingMeters, FeelingsEditor, NEUTRAL_FEELINGS, type Feelings } from './FeelingsEditor';
import styles from './Simulation.module.css';

interface RelationshipDetailProps {
  seasonId: string;
  player: Player;
  players: Player[];
  relationships: Relationship[];
  editable?: boolean;
  onChanged: (data: Relationships) => void;
  onClose: () => void;
}

/** O que um jogador sente por cada um (e o contrário), com ajuste manual. */
export function RelationshipDetail({ seasonId, player, players, relationships, editable, onChanged, onClose }: Readonly<RelationshipDetailProps>) {
  const [editing, setEditing] = useState<{ from: Player; to: Player } | null>(null);
  const others = players.filter((p) => p.id !== player.id && p.status === 'ACTIVE');
  const lookup = useMemo(() => new Map(relationships.map((r) => [`${r.fromId}>${r.toId}`, r])), [relationships]);
  const feeling = (from: string, to: string) => lookup.get(`${from}>${to}`) ?? { fromId: from, toId: to, ...NEUTRAL_FEELINGS };

  const outgoing = [...others].sort((a, b) => feeling(player.id, b.id).trust - feeling(player.id, a.id).trust);

  return (
    <section className={styles.detail}>
      <header className={styles.detailHead}>
        <Portrait name={player.name} imageUrl={player.imageUrl} size="sm" hideName />
        <div>
          <h3 className={styles.detailTitle}>{player.name}</h3>
          <p className={styles.muted}>À esquerda, o que {player.name} sente; à direita, o que sentem por {player.name}.</p>
        </div>
        <Button variant="quiet" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </header>

      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Jogador</th>
            <th scope="col">Confia</th>
            <th scope="col">Gosta</th>
            <th scope="col">Odeia</th>
            <th scope="col" className={styles.divider}>Confiam</th>
            <th scope="col">Gostam</th>
            <th scope="col">Odeiam</th>
          </tr>
        </thead>
        <tbody>
          {outgoing.map((other) => {
            const out = feeling(player.id, other.id);
            const back = feeling(other.id, player.id);
            return (
              <tr key={other.id}>
                <th scope="row">
                  <span className={styles.playerCell}>
                    <Portrait name={other.name} imageUrl={other.imageUrl} size="xs" hideName />
                    <span className={styles.playerText}>
                      <span className={styles.playerName}>{other.name}</span>
                      {out.allied && <span className={styles.allies}>Aliança</span>}
                    </span>
                  </span>
                </th>
                <FeelingCells feeling={out} onEdit={editable ? () => setEditing({ from: player, to: other }) : undefined} />
                <FeelingCells feeling={back} divider onEdit={editable ? () => setEditing({ from: other, to: player }) : undefined} />
              </tr>
            );
          })}
        </tbody>
      </table>

      {editing && (
        <EditFeelingModal
          seasonId={seasonId}
          from={editing.from}
          to={editing.to}
          initial={feeling(editing.from.id, editing.to.id)}
          onClose={() => setEditing(null)}
          onSaved={(data) => {
            setEditing(null);
            onChanged(data);
          }}
        />
      )}
    </section>
  );
}

/** Confiança, simpatia e ódio de um sentido da relação; clicável quando dá para ajustar. */
function FeelingCells({ feeling, divider, onEdit }: Readonly<{ feeling: Feelings; divider?: boolean; onEdit?: () => void }>) {
  const Tag = onEdit ? 'button' : 'div';
  return (
    <td colSpan={3} className={divider ? styles.divider : undefined}>
      <Tag type={onEdit ? 'button' : undefined} className={styles.feelings} onClick={onEdit} title={onEdit ? 'Ajustar' : undefined}>
        <FeelingMeters feelings={feeling} />
      </Tag>
    </td>
  );
}

function EditFeelingModal({
  seasonId,
  from,
  to,
  initial,
  onClose,
  onSaved,
}: Readonly<{
  seasonId: string;
  from: Player;
  to: Player;
  initial: Feelings;
  onClose: () => void;
  onSaved: (data: Relationships) => void;
}>) {
  const { simulation } = useServices();
  const save = useAction((patch: RelationshipPatch) => simulation.updateRelationship(seasonId, patch), { success: 'Relacionamento ajustado' });

  async function handleSave(feelings: Feelings) {
    const data = await save.run({ fromId: from.id, toId: to.id, ...feelings });
    if (data) onSaved(data);
  }

  return <FeelingsEditor from={from} to={to} initial={initial} pending={save.pending} onClose={onClose} onSave={handleSave} />;
}
