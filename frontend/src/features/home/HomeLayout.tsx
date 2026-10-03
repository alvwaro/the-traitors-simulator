import { Outlet } from 'react-router-dom';
import { TabNav } from '../../components/layout/TabNav';

const TABS = [
  { to: '/', label: 'Temporadas Oficiais', end: true },
  { to: '/fas', label: 'Área de Fãs' },
];

/** Página inicial em duas áreas: as temporadas oficiais (montadas pelos donos do site) e a dos fãs. O que é seu fica na biblioteca. */
export function HomeLayout() {
  return (
    <>
      <TabNav tabs={TABS} label="Áreas do site" />
      <Outlet />
    </>
  );
}
