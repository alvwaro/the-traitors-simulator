import { Outlet } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { TabNav } from '../../../components/layout/TabNav';
import styles from './LibraryPage.module.css';

const TABS = [
  { to: '/biblioteca', label: 'Casts', end: true },
  { to: '/biblioteca/personagens', label: 'Personagens' },
  { to: '/biblioteca/comportamentos', label: 'Comportamentos' },
  { to: '/biblioteca/frases', label: 'Frases' },
];

/** Biblioteca da Minha Área: casts e personagens seus; comportamentos e frases do site. */
export function LibraryLayout() {
  return (
    <div className={styles.page}>
      <PageHeader title="Biblioteca" />
      <TabNav tabs={TABS} label="Seções da biblioteca" />
      <Outlet />
    </div>
  );
}
