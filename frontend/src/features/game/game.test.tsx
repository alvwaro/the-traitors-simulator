import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeApi, fixtures, type Snapshot } from '../../test/fakeApi';
import { exercise } from '../../test/exercise';
import { renderApp, settled } from '../../test/render';

/** Abre a temporada na foto gravada e confere que a tela montou sem erro. */
async function open(snapshot: Snapshot) {
  const api = new FakeApi();
  api.snapshot = snapshot;
  const view = renderApp(`/temporadas/${snapshot.details.id}`, api);
  await settled();
  expect(screen.queryByText(/Algo deu errado|Rota não gravada/i)).not.toBeInTheDocument();
  return view;
}

describe('tela do jogo em cada momento gravado', () => {
  it.each(fixtures.games.manual.map((s) => [s.label, s] as const))('manual · %s', async (_, snapshot) => {
    await open(snapshot);
    expect(document.body.textContent).toBeTruthy();
  });

  it.each(fixtures.games.automatic.map((s) => [s.label, s] as const))('automática · %s', async (_, snapshot) => {
    await open(snapshot);
  });

  it.each(fixtures.games.player.map((s, i) => [`${i} ${s.label}`, s] as const))('jogador · %s', async (_, snapshot) => {
    await open(snapshot);
  });
});

describe('usando a tela do jogo', { timeout: 90_000 }, () => {
  const samples = [...fixtures.games.manual, ...fixtures.games.automatic, ...fixtures.games.player];
  it.each(samples.map((s, i) => [`${i} ${s.details.id.slice(0, 4)} ${s.label}`, s] as const))('clica em tudo · %s', async (_, snapshot) => {
    const { user, api } = await open(snapshot);
    await exercise(user, { maxClicks: 30 });
    expect(api.calls.length).toBeGreaterThan(0);
  });
});
