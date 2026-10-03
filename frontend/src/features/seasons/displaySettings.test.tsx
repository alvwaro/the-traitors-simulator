import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeApi, findSnapshot, fixtures, type Snapshot } from '../../test/fakeApi';
import { renderApp, settled } from '../../test/render';

/** A última escrita feita na API com esse método e caminho. */
function sent(api: FakeApi, method: string, path: RegExp) {
  return api.calls.filter((c) => c.method === method && path.test(c.path)).at(-1)?.body;
}

const drama = (root: HTMLElement = document.body) => within(root).queryByRole('checkbox', { name: /^Drama:/ });
const phrases = (root: HTMLElement = document.body) => within(root).queryByRole('checkbox', { name: /^Desativar frases/ });

async function openSeason(snapshot: Snapshot) {
  const api = new FakeApi();
  api.snapshot = snapshot;
  const view = renderApp(`/temporadas/${snapshot.details.id}`, api);
  await settled();
  return { ...view, api };
}

describe('drama e frases (como a simulação aparece na tela)', () => {
  it('na criação: drama só no modo Jogador; desativar frases em qualquer temporada simulada', async () => {
    const api = new FakeApi();
    const { user } = renderApp(`/temporadas/nova?cast=${fixtures.cast.id}`, api);
    await settled();
    // Manual: a tela não narra nada, então nada disso aparece.
    expect(drama()).not.toBeInTheDocument();
    expect(phrases()).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Automática/ }));
    expect(drama()).not.toBeInTheDocument();
    expect(phrases()).toHaveAccessibleName(/a narrativa fica só com o que importa/);

    await user.click(screen.getByRole('radio', { name: /^Jogador/ }));
    expect(phrases()).toHaveAccessibleName(/só aparecem as falas que envolvem você/);
    expect(drama()).not.toBeChecked();
    expect(phrases()).not.toBeChecked();
    await user.click(drama()!);
    await user.click(phrases()!);
    await user.type(screen.getByLabelText('Nome'), 'Com drama');
    await user.type(screen.getByLabelText('Seu nome no jogo'), 'Eu');
    await user.click(screen.getByRole('button', { name: 'Criar temporada' }));
    await waitFor(() => expect(sent(api, 'POST', /^\/seasons$/)).toMatchObject({ mode: 'PLAYER', drama: true, showPhrases: false }));
  });

  it('a temporada automática não manda drama, mesmo marcado antes de trocar de modo', async () => {
    const api = new FakeApi();
    const { user } = renderApp(`/temporadas/nova?cast=${fixtures.cast.id}`, api);
    await settled();
    await user.click(screen.getByRole('radio', { name: /^Jogador/ }));
    await user.click(drama()!);
    await user.click(screen.getByRole('radio', { name: /^Automática/ }));
    await user.type(screen.getByLabelText('Nome'), 'Sem drama');
    await user.click(screen.getByRole('button', { name: 'Criar temporada' }));
    await waitFor(() => expect(sent(api, 'POST', /^\/seasons$/)).toMatchObject({ mode: 'AUTOMATIC', drama: false, showPhrases: true }));
  });

  it('antes do início, nas configurações da temporada', async () => {
    const snapshot = structuredClone(findSnapshot(fixtures.games.player, (s) => s.state.season.status === 'SETUP'));
    const { user, api } = await openSeason(snapshot);
    await user.click(phrases()!);
    await user.click(drama()!);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(sent(api, 'PATCH', /^\/seasons\/[^/]+$/)).toMatchObject({ drama: true, showPhrases: false }));
  });

  it('no meio do jogo, pelo "editar": o prêmio fica travado, mas drama e frases mudam', async () => {
    const snapshot = structuredClone(findSnapshot(fixtures.games.player, (s) => s.state.season.status === 'IN_PROGRESS' && !s.state.player?.need));
    Object.assign(snapshot.state.season, { drama: true, showPhrases: false });
    const { user, api } = await openSeason(snapshot);
    await user.click(screen.getByRole('button', { name: 'editar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/O prêmio não pode mais ser alterado/)).toBeInTheDocument();
    expect(drama(dialog)).toBeChecked();
    expect(phrases(dialog)).toBeChecked();
    await user.click(drama(dialog)!);
    await user.click(phrases(dialog)!);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(sent(api, 'PATCH', /^\/seasons\/[^/]+$/)).toEqual({ name: snapshot.state.season.name, drama: false, showPhrases: true }));
  });

  it('a temporada manual edita só o nome (e o prêmio antes do início)', async () => {
    const snapshot = structuredClone(fixtures.games.manual.find((s) => s.state.season.status === 'IN_PROGRESS')!);
    const { user, api } = await openSeason(snapshot);
    await user.click(screen.getByRole('button', { name: 'editar' }));
    const dialog = await screen.findByRole('dialog');
    expect(drama(dialog)).not.toBeInTheDocument();
    expect(phrases(dialog)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(sent(api, 'PATCH', /^\/seasons\/[^/]+$/)).toEqual({ name: snapshot.state.season.name }));
  });
});
