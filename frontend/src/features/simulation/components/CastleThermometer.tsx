import { useMemo, useState } from 'react';
import { TagChips } from '../../../components/behavior/BehaviorTags';
import { Portrait } from '../../../components/player/Portrait';
import { Check } from '../../../components/ui/Form';
import { DaggerIcon } from '../../../components/ui/Icons';
import { behaviorNames } from '../../../domain/behaviors';
import type { Behavior, Player, Relationships } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { Meter } from './Meter';
import { RelationshipDetail } from './RelationshipDetail';
import styles from './Simulation.module.css';

type SortKey = 'banish' | 'trust' | 'suspicion' | 'murder';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'banish', label: 'Chance de banimento' },
  { key: 'suspicion', label: 'Suspeita' },
  { key: 'trust', label: 'Confiança' },
  { key: 'murder', label: 'Chance de assassinato' },
];

const REVEAL_KEY = 'traitors:revelar-papeis';

function readReveal(): boolean {
  try {
    return localStorage.getItem(REVEAL_KEY) === '1';
  } catch {
    return false;
  }
}

interface CastleThermometerProps {
  seasonId: string;
  data: Relationships;
  players: Player[];
  behaviors: Behavior[];
  /** Permite ajustar relacionamentos à mão. */
  editable?: boolean;
  /** Mostra chance de assassinato e o papel (só depois da escolha dos traidores). */
  inGame?: boolean;
  onChanged: (data: Relationships) => void;
}

/**
 * Como o castelo enxerga cada jogador: média da confiança e da suspeita de todo o elenco,
 * chance de ser banido na próxima mesa (simulando os votos) e de ser o alvo dos traidores.
 */
/** Por qual número ordenar a lista do termômetro. */
const SORT_VALUE: Record<SortKey, (s: Relationships['standings'][number]) => number> = {
  banish: (s) => s.banishChance,
  trust: (s) => s.trust,
  suspicion: (s) => s.suspicion,
  murder: (s) => s.murderChance ?? -1,
};

export function CastleThermometer({ seasonId, data, players, behaviors, editable, inGame, onChanged }: Readonly<CastleThermometerProps>) {
  const [sort, setSort] = useState<SortKey>('banish');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reveal, setReveal] = useState(readReveal);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const rows = useMemo(() => {
    const value = (s: Relationships['standings'][number]) => SORT_VALUE[sort](s);
    return [...data.standings].filter((s) => byId.has(s.playerId)).sort((a, b) => value(b) - value(a));
  }, [data.standings, sort, byId]);

  const hasTraitors = data.standings.some((s) => s.murderChance !== null);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  function toggleReveal(next: boolean) {
    setReveal(next);
    try {
      localStorage.setItem(REVEAL_KEY, next ? '1' : '0');
    } catch {
      // sem armazenamento: vale só nesta página
    }
  }

  return (
    <div className={styles.thermometer}>
      <div className={styles.controls}>
        <label className={styles.sortLabel}>
          Ordenar por
          <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.filter((s) => s.key !== 'murder' || hasTraitors).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {inGame && <Check label="Revelar traidores" checked={reveal} onChange={(e) => toggleReveal(e.target.checked)} />}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Jogador</th>
              <th scope="col">Confiança</th>
              <th scope="col">Suspeita</th>
              <th scope="col">Simpatia</th>
              <th scope="col">Ódio</th>
              <th scope="col">Banimento</th>
              {inGame && hasTraitors && <th scope="col">Assassinato</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const player = byId.get(s.playerId)!;
              const traitor = reveal && inGame && player.role === 'TRAITOR';
              return (
                <tr key={s.playerId} className={cx(selectedId === s.playerId && styles.rowSelected)}>
                  <th scope="row">
                    <button type="button" className={styles.playerCell} onClick={() => setSelectedId(selectedId === s.playerId ? null : s.playerId)}>
                      <Portrait name={player.name} imageUrl={player.imageUrl} size="xs" hideName />
                      <span className={styles.playerText}>
                        <span className={cx(styles.playerName, traitor && styles.traitorName)}>
                          {player.name} {traitor && <DaggerIcon size={12} title="Traidor(a)" />}
                        </span>
                        <TagChips names={behaviorNames(player.behaviorIds, behaviors)} className={styles.rowTags} />
                        {s.allies.length > 0 && (
                          <span className={styles.allies}>Aliado(a) de {s.allies.map((id) => byId.get(id)?.name ?? '?').join(', ')}</span>
                        )}
                      </span>
                    </button>
                  </th>
                  <td><Meter value={s.trust} tone="trust" label="Confiança média" /></td>
                  <td><Meter value={s.suspicion} tone="suspicion" label="Suspeita média" /></td>
                  <td><Meter value={s.liking} tone="liking" label="Simpatia média" /></td>
                  <td><Meter value={s.hatred} tone="hatred" label="Ódio médio" /></td>
                  <td><Meter value={s.banishChance * 100} tone="chance" label="Chance de banimento" suffix="%" /></td>
                  {inGame && hasTraitors && (
                    <td>{s.murderChance === null ? <span className={styles.na}>—</span> : <Meter value={s.murderChance * 100} tone="hatred" label="Chance de assassinato" suffix="%" />}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>
        Clique num jogador para ver o que ele sente por cada um e o que cada um sente por ele. As chances simulam 300 votações com os relacionamentos atuais.
      </p>

      {selected && (
        <RelationshipDetail
          seasonId={seasonId}
          player={selected}
          players={players}
          relationships={data.relationships}
          editable={editable}
          onChanged={onChanged}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
