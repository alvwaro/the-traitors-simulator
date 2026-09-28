import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { HomeLayout } from '../features/home/HomeLayout';
import { MyAreaPage } from '../features/home/MyAreaPage';
import { PublicAreaPage } from '../features/home/PublicAreaPage';
import { LibraryLayout } from '../features/library/pages/LibraryLayout';
import { CastsPage } from '../features/library/pages/CastsPage';
import { BehaviorsPage } from '../features/library/pages/BehaviorsPage';
import { CharactersPage } from '../features/library/pages/CharactersPage';
import { PhrasesPage } from '../features/library/pages/PhrasesPage';
import { NewSeasonPage } from '../features/seasons/pages/NewSeasonPage';
import { SeasonPage } from '../features/seasons/pages/SeasonPage';
import { HistoryPage } from '../features/history/pages/HistoryPage';
import { GuidePage } from '../features/guide/GuidePage';
import { NotFoundPage } from './NotFoundPage';
import { RequireAuth } from './RequireAuth';

/** As rotas do site (os testes montam as mesmas rotas num roteador em memória). */
export const routes: RouteObject[] = [
  // porta de entrada: só o login, sem o site por trás
  { path: '/entrar', element: <LoginPage /> },
  {
    // todo o resto exige estar logado
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        // página inicial: Castelo (oficial), Fãs e Minha Área
        element: <HomeLayout />,
        children: [
          { path: '/', element: <PublicAreaPage area="OFFICIAL" /> },
          { path: '/fas', element: <PublicAreaPage area="FAN" /> },
          { path: '/minha-area', element: <MyAreaPage /> },
        ],
      },
      {
        path: '/biblioteca',
        element: <LibraryLayout />,
        children: [
          { index: true, element: <CastsPage /> },
          { path: 'personagens', element: <CharactersPage /> },
          { path: 'comportamentos', element: <BehaviorsPage /> },
          { path: 'frases', element: <PhrasesPage /> },
        ],
      },
      { path: '/guia', element: <GuidePage /> },
      { path: '/guia/:pool', element: <GuidePage /> },
      { path: '/temporadas/nova', element: <NewSeasonPage /> },
      { path: '/temporadas/:seasonId', element: <SeasonPage /> },
      { path: '/temporadas/:seasonId/cronica', element: <HistoryPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
