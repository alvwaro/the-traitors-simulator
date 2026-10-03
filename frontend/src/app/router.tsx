import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { FanAreaPage } from '../features/home/FanAreaPage';
import { FanListPage } from '../features/home/FanListPage';
import { HomeLayout } from '../features/home/HomeLayout';
import { MyAreaPage } from '../features/home/MyAreaPage';
import { OfficialSeasonsPage } from '../features/home/OfficialSeasonsPage';
import { PublishedSeasonPage } from '../features/publications/PublishedSeasonPage';
import { LibraryLayout } from '../features/library/pages/LibraryLayout';
import { CastsPage } from '../features/library/pages/CastsPage';
import { CastPage } from '../features/library/pages/CastPage';
import { BehaviorsPage } from '../features/library/pages/BehaviorsPage';
import { CharactersPage } from '../features/library/pages/CharactersPage';
import { PhrasesPage } from '../features/library/pages/PhrasesPage';
import { NewSeasonPage } from '../features/seasons/pages/NewSeasonPage';
import { SeasonPage } from '../features/seasons/pages/SeasonPage';
import { HistoryPage } from '../features/history/pages/HistoryPage';
import { GuidePage } from '../features/guide/GuidePage';
import { ParticipantPage } from '../features/participants/ParticipantPage';
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
        // página inicial: Temporadas Oficiais (EUA e Reino Unido), Fãs (com a lista completa de cada seção) e Minha Área
        element: <HomeLayout />,
        children: [
          { path: '/', element: <OfficialSeasonsPage /> },
          { path: '/fas', element: <FanAreaPage /> },
          { path: '/fas/:kind', element: <FanListPage /> },
          { path: '/minha-area', element: <MyAreaPage /> },
        ],
      },
      // as listas antigas das oficiais (/oficial/temporadas...): agora tudo cabe na página inicial
      { path: '/oficial/*', element: <Navigate to="/" replace /> },
      { path: '/publicacoes/:publicationId', element: <PublishedSeasonPage /> },
      {
        path: '/biblioteca',
        element: <LibraryLayout />,
        children: [
          { index: true, element: <CastsPage /> },
          { path: 'casts/:castId', element: <CastPage /> },
          { path: 'personagens', element: <CharactersPage /> },
          { path: 'comportamentos', element: <BehaviorsPage /> },
          { path: 'frases', element: <PhrasesPage /> },
        ],
      },
      { path: '/participantes/:characterId', element: <ParticipantPage /> },
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
