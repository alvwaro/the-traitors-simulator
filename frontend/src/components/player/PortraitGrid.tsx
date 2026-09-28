import type { ReactNode } from 'react';
import type { PlayerStatus } from '../../domain/enums';
import { cx } from '../../lib/cx';
import { Portrait } from './Portrait';
import styles from './PortraitGrid.module.css';

export interface PortraitItem {
  id: string;
  name: string;
  imageUrl: string | null;
  status?: PlayerStatus;
}

interface PortraitGridProps<T extends PortraitItem> {
  items: T[];
  selectedIds?: readonly string[];
  onToggle?: (id: string) => void;
  isDisabled?: (item: T) => boolean;
  caption?: (item: T) => ReactNode;
  badge?: (item: T) => ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/** Galeria de retratos; com onToggle vira um seletor (simples ou múltiplo, quem decide é o pai). */
export function PortraitGrid<T extends PortraitItem>({
  items,
  selectedIds = [],
  onToggle,
  isDisabled,
  caption,
  badge,
  size = 'md',
  className,
}: Readonly<PortraitGridProps<T>>) {
  return (
    <div className={cx(styles.grid, styles[size], className)}>
      {items.map((item) => (
        <Portrait
          key={item.id}
          name={item.name}
          imageUrl={item.imageUrl}
          status={item.status}
          size={size}
          selected={selectedIds.includes(item.id)}
          disabled={isDisabled?.(item)}
          caption={caption?.(item)}
          badge={badge?.(item)}
          onClick={onToggle ? () => onToggle(item.id) : undefined}
        />
      ))}
    </div>
  );
}

/** Helpers de seleção para usar com PortraitGrid. */
export function toggleIn(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
