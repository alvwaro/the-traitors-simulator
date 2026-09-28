import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Panel.module.css';

interface PanelProps {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  tone?: 'stone' | 'blood';
  className?: string;
  children: ReactNode;
}

/** Moldura dupla usada em todas as seções. */
export function Panel({ title, eyebrow, actions, tone = 'stone', className, children }: Readonly<PanelProps>) {
  return (
    <section className={cx(styles.panel, tone === 'blood' && styles.blood, className)}>
      {(title || actions) && (
        <header className={styles.header}>
          <div>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            {title && <h2 className={styles.title}>{title}</h2>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
