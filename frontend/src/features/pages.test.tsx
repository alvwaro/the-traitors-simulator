import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeApi, fanSeason, fixtures, officialSeason } from '../test/fakeApi';
import { exercise, fillEverything } from '../test/exercise';
import { renderApp, settled } from '../test/render';

/** Abre a rota, espera carregar, preenche os campos e clica em tudo o que dá. */
async function visit(path: string, setup: (api: FakeApi) => void = () => {}) {
  const api = new FakeApi();
  setup(api);
  const view = renderApp(path, api);
  await settled();
  await fillEverything(view.user);
  await exercise(view.user, { maxClicks: 40 });
  return view;
}

const ROUTES = [
  '/',
  '/fas',
  `/publicacoes/${officialSeason('US').id}`,
  `/publicacoes/${fanSeason().id}`,
  '/fas/temporadas',
  '/fas/personagens',
  '/oficial/temporadas',
  '/minha-area',
  '/biblioteca',
  '/biblioteca/casts/sem-cast',
  `/participantes/${fixtures.characters[0].id}`,
  '/biblioteca/personagens',
  '/biblioteca/comportamentos',
  '/biblioteca/frases',
  '/temporadas/nova',
  '/guia',
  '/guia/UK_S2',
  '/guia/MIX',
  '/rota-que-nao-existe',
];

describe('páginas do site', { timeout: 120_000 }, () => {
  it.each(ROUTES)('usa a página %s como fã', async (path) => {
    const { api } = await visit(path);
    expect(api.calls.length).toBeGreaterThan(0);
  });

  it.each(ROUTES)('usa a página %s como dono do site', async (path) => {
    await visit(path, (api) => {
      api.user = fixtures.owner.user;
    });
  });

  it.each(ROUTES.slice(0, 8))('mostra os erros da API em %s', async (path) => {
    await visit(path, (api) => {
      api.fail = true;
    });
  });

  it('mostra a crônica inteira da temporada', async () => {
    const { user } = await visit(`/temporadas/${fixtures.games.automatic[0].details.id}/cronica`, (api) => {
      api.snapshot = fixtures.games.automatic.at(-1)!;
      api.history = fixtures.fullHistory;
    });
    await exercise(user, { maxClicks: 60 });
    expect(document.body.textContent).toMatch(/Dia/i);
  });

  it('abre o cadastro de temporada vindo de um cast', async () => {
    await visit(`/temporadas/nova?cast=${fixtures.cast.id}`);
  });

  it('entra, cadastra e sai', async () => {
    const api = new FakeApi();
    api.user = null;
    const view = renderApp('/biblioteca', api);
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/entrar'));
    await fillEverything(view.user, 'visitante123');
    await exercise(view.user, { maxClicks: 10 });
    expect(api.calls.some((c) => c.path.startsWith('/auth/'))).toBe(true);
  });
});
