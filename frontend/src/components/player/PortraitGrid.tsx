import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PlayerStatus } from '../../domain/enums';
import { cx } from '../../lib/cx';
import { Portrait } from './Portrait';
import styles from './PortraitGrid.module.css';

export interface PortraitItem {
  id: string;
  name: string;
  imageUrl: string | null;
  status?: PlayerStatus;
  /** Retrato com "?" no lugar da foto (ex.: escudo escondido). */
  mystery?: boolean;
}

interface PortraitGridProps<T extends PortraitItem> {
  items: T[];
  selectedIds?: readonly string[];
  onToggle?: (id: string) => void;
  isDisabled?: (item: T) => boolean;
  caption?: (item: T) => ReactNode;
  badge?: (item: T) => ReactNode;
  /** Página que cada foto abre (ex.: a do participante); undefined = foto sem link. */
  linkTo?: (item: T) => string | undefined;
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
  linkTo,
  size = 'md',
  className,
}: Readonly<PortraitGridProps<T>>) {
  return (
    <div className={cx(styles.grid, styles[size], className)}>
      {items.map((item) => {
        const portrait = (
          <Portrait
            key={item.id}
            name={item.name}
            imageUrl={item.imageUrl}
            status={item.status}
            mystery={item.mystery}
            size={size}
            selected={selectedIds.includes(item.id)}
            disabled={isDisabled?.(item)}
            caption={caption?.(item)}
            badge={badge?.(item)}
            onClick={onToggle ? () => onToggle(item.id) : undefined}
          />
        );
        const to = linkTo?.(item);
        return to ? (
          <Link key={item.id} to={to} className={styles.link}>
            {portrait}
          </Link>
        ) : (
          portrait
        );
      })}
    </div>
  );
}

/** Helpers de seleção para usar com PortraitGrid. */
export function toggleIn(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
