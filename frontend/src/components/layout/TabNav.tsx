import { NavLink } from 'react-router-dom';
import { cx } from '../../lib/cx';
import styles from './TabNav.module.css';

export interface TabLink {
  to: string;
  label: string;
  /** Só ativa na rota exata (a aba "índice"). */
  end?: boolean;
}

/** Abas de navegação entre sub-rotas (Biblioteca, áreas da página inicial). */
export function TabNav({ tabs, label }: Readonly<{ tabs: readonly TabLink[]; label: string }>) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => cx(styles.tab, isActive && styles.active)}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
