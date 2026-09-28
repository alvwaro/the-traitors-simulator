import type { ReactNode } from 'react';
import type { Player } from '../../domain/models';
import { Portrait } from './Portrait';
import styles from './PhotoWall.module.css';

/** Quantos retratos cabem em cada linha da parede. */
export const PER_ROW = 5;

interface PhotoWallProps {
  players: Player[];
  size?: 'sm' | 'md' | 'lg';
  caption?: (player: Player) => ReactNode;
  eager?: boolean;
}

/**
 * Divide o elenco em linhas preenchidas de baixo para cima:
 * a linha incompleta fica em cima (ex.: 17 jogadores → 2 / 5 / 5 / 5).
 */
function rowsBottomUp<T>(items: T[], perRow: number): T[][] {
  const first = items.length % perRow || perRow;
  const rows = [items.slice(0, first)];
  for (let i = first; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

/** Parede de fotos com todo o elenco; eliminados ficam marcados com o X. */
export function PhotoWall({ players, size = 'md', caption, eager }: Readonly<PhotoWallProps>) {
  return (
    <div className={styles.wall}>
      {rowsBottomUp(players, PER_ROW).map((row, i) => (
        <div key={i} className={styles.row}>
          {row.map((p) => (
            <Portrait
              key={p.id}
              name={p.name}
              imageUrl={p.imageUrl}
              status={p.status}
              size={size}
              caption={caption?.(p)}
              eager={eager}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
