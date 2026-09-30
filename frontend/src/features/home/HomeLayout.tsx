import { Outlet } from 'react-router-dom';
import { TabNav } from '../../components/layout/TabNav';

const TABS = [
  { to: '/', label: 'Castelo · Temporadas Oficiais', end: true },
  { to: '/fas', label: 'Área de Fãs' },
  { to: '/minha-area', label: 'Minha Área' },
];

/** Página inicial em três áreas: as temporadas oficiais (montadas pelos donos do site), a dos fãs e a de quem está logado. */
export function HomeLayout() {
  return (
    <>
      <TabNav tabs={TABS} label="Áreas do site" />
      <Outlet />
    </>
  );
}
