import { Outlet } from 'react-router-dom';
import { TabNav } from '../../components/layout/TabNav';

const TABS = [
  { to: '/', label: 'Castelo · Área Oficial', end: true },
  { to: '/fas', label: 'Área de Fãs' },
  { to: '/minha-area', label: 'Minha Área' },
];

/** Página inicial em três áreas: a oficial (donos do site), a dos fãs e a de quem está logado. */
export function HomeLayout() {
  return (
    <>
      <TabNav tabs={TABS} label="Áreas do site" />
      <Outlet />
    </>
  );
}
