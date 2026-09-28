import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './States.module.css';

export function Loading({ label = 'Acendendo as velas' }: Readonly<{ label?: string }>) {
  return (
    <div className={styles.state}>
      <span className={styles.candle} aria-hidden="true" />
      <p className={styles.text}>{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: Readonly<{ error: Error; onRetry?: () => void }>) {
  return (
    <div className={styles.state}>
      <p className={styles.title}>As portas do castelo não abriram</p>
      <p className={styles.text}>{error.message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: Readonly<{ title: string; children?: ReactNode }>) {
  return (
    <div className={styles.state}>
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.text}>{children}</div>}
    </div>
  );
}
