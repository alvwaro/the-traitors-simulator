import type { ReactNode } from 'react';
import styles from './Home.module.css';

/** Uma seção da página inicial: título, subtítulo, ação opcional e o conteúdo. */
export function HomeSection({ title, subtitle, action, children }: Readonly<{ title: string; subtitle?: string; action?: ReactNode; children: ReactNode }>) {
  return (
    <section className={styles.section} aria-label={title}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
