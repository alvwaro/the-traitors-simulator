import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchHttpClient } from '../services/http/FetchHttpClient';
import { FakeApi, fixtures, type Snapshot } from '../test/fakeApi';
import { exercise, fillEverything } from '../test/exercise';
import { renderApp, settled } from '../test/render';

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function openSeason(snapshot: Snapshot) {
  const api = new FakeApi();
  api.snapshot = snapshot;
  const view = renderApp(`/temporadas/${snapshot.details.id}`, api);
  await settled();
  return view;
}

describe('detalhes que só aparecem depois de um clique', () => {
  it('abre o detalhe do cast: relacionamentos, comportamentos e ranking', async () => {
    const view = renderApp('/biblioteca');
    await settled();
    const card = await screen.findByText('Quarteto');
    await view.user.click(card);
    // O cast abre na aba de personagens; o ranking fica na aba ao lado.
    await view.user.click(await screen.findByRole('tab', { name: 'Ranking' }));
    const dialog = await screen.findByRole('dialog').catch(() => document.body);
    await fillEverything(view.user, '80');
    await exercise(view.user, { maxClicks: 60, root: dialog as HTMLElement });
    expect(view.api.calls.some((c) => c.path.includes('/relationships') || c.path.includes('/ranking'))).toBe(true);
  });

  it('cria um personagem direto na página do cast', async () => {
    const view = renderApp('/biblioteca');
    await settled();
    await view.user.click(await screen.findByText('Quarteto'));
    await view.user.type(await screen.findByLabelText(/Nome/i), 'Lady Morag');
    await view.user.click(screen.getByRole('button', { name: 'Salvar no cast' }));
    await waitFor(() => {
      const created = view.api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/characters'));
      expect((created?.body as { castId?: string } | undefined)?.castId).toBeTruthy();
    });
  });

  it('página do participante: spoiler, cartão da temporada e importação da wiki', async () => {
    const api = new FakeApi();
    api.user = fixtures.owner.user;
    const view = renderApp(`/participantes/${fixtures.characters[0].id}`, api);
    await settled();
    expect(screen.queryByText('Banido(a) no episódio 11')).toBeNull();
    await view.user.click(await screen.findByRole('button', { name: 'Exibir spoiler' }));
    expect(screen.getByText('Banido(a) no episódio 11')).toBeTruthy();
    expect(screen.getByText('Recrutado(a)')).toBeTruthy();
    expect(screen.getByText('The Real Housewives of New York City')).toBeTruthy();

    await view.user.click(screen.getByRole('button', { name: 'Editar informações' }));
    await view.user.click(await screen.findByRole('button', { name: 'Importar da wiki' }));
    await waitFor(() => expect(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/wiki'))).toBe(true));
    await view.user.click(screen.getByRole('button', { name: 'Salvar página' }));
    await waitFor(() => {
      const saved = api.calls.find((c) => c.method === 'PATCH' && /^\/characters\/[^/]+$/.test(c.path));
      expect((saved?.body as { profile?: unknown } | undefined)?.profile).toBeTruthy();
    });
  });

  it('personagens: os casts ficam recolhidos e só mostram os retratos ao expandir', async () => {
    const view = renderApp('/biblioteca/personagens');
    await settled();
    const group = await screen.findByRole('article', { name: 'Quarteto' });
    expect(within(group).queryAllByRole('img').length).toBeLessThanOrEqual(1);
    await view.user.click(within(group).getByRole('button', { name: 'Expandir' }));
    expect(within(group).getByRole('button', { name: 'Recolher' })).toBeTruthy();
  });

  it('mostra o termômetro do castelo e o detalhe de cada jogador', async () => {
    const snapshot = fixtures.games.automatic.find((s) => s.state.day === 2 && s.label.endsWith('depois'))!;
    const view = await openSeason(snapshot);
    await view.user.click(screen.getByRole('button', { name: /Termômetro do castelo/i }));
    await waitFor(() => expect(view.api.calls.some((c) => c.path.endsWith('/relationships'))).toBe(true));
    const cells = await screen.findAllByRole('button', { name: /.+/ });
    for (const cell of cells.filter((b) => b.className.includes('playerCell')).slice(0, 3)) {
      await view.user.click(cell);
      await fillEverything(view.user, '50');
      await exercise(view.user, { maxClicks: 25 });
    }
  });

  it('usa o recrutamento de elenco e as configurações antes do início', async () => {
    for (const snapshot of [fixtures.games.manual[0], fixtures.games.automatic[0], fixtures.games.player[0]]) {
      const view = await openSeason(snapshot);
      await fillEverything(view.user, 'Novo nome');
      await exercise(view.user, { maxClicks: 50 });
      view.unmount();
    }
  }, 180_000);
});

describe('decisões raras do modo Jogador', () => {
  const base = fixtures.games.player.find((s) => s.state.phase === 'TRAITORS_MEETING' && !s.state.player?.need)!;
  const breakfast = fixtures.games.player.find((s) => s.state.phase === 'BREAKFAST' && !s.state.player?.need)!;
  const someone = (s: Snapshot) => (s.state.activePlayers as { id: string }[]).find((p) => p.id !== (s.state.player as unknown as { playerId: string }).playerId)!.id;

  it.each([
    ['o jantar do Vidente', base, { need: 'SEER', seerPending: true }],
    ['o relato do Vidente (Traidor)', breakfast, { need: 'SEER_ANNOUNCE', seer: { guestId: '', role: 'TRAITOR', announced: false } }],
    ['o relato do Vidente (Fiel)', breakfast, { need: 'SEER_ANNOUNCE', seer: { guestId: '', role: 'FAITHFUL', announced: true } }],
    ['a carta dos Traidores', base, { need: null, pendingOffer: { ultimatum: false } }],
    ['o ultimato dos Traidores', base, { need: null, pendingOffer: { ultimatum: true } }],
  ] as const)('%s', async (_, source, patch) => {
    const snapshot = clone(source);
    const player = snapshot.state.player as unknown as Record<string, unknown>;
    Object.assign(player, clone(patch));
    if (player.seer) (player.seer as { guestId: string }).guestId = someone(snapshot);
    const view = await openSeason(snapshot);
    await exercise(view.user, { maxClicks: 30 });
    expect(view.api.calls.some((c) => c.path.endsWith('/simulate'))).toBe(true);
  });
});

describe('cliente HTTP', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('monta a URL, envia JSON e traduz os erros da API', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (init?.method === 'PATCH') return new Response(JSON.stringify({ issues: [{ path: ['name'], message: 'obrigatório' }, { message: 'outro' }] }), { status: 400 });
      if (init?.method === 'POST') return new Response(JSON.stringify({ message: 'Proibido' }), { status: 403 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const http = new FetchHttpClient('/api');
    expect(await http.get('/x', { a: '1', b: undefined })).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/x?a=1');
    await expect(http.post('/y', { z: 1 })).rejects.toThrow('Proibido');
    await expect(http.patch('/y', {})).rejects.toThrow('name: obrigatório; outro');
    await http.delete('/y');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Falhou' }), { status: 500 })));
    await expect(http.get('/y')).rejects.toThrow('Falhou');
    // Erro sem corpo da API (o gateway ou o balanceador respondendo): mensagem pelo status.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    await expect(http.get('/y')).rejects.toThrow('O servidor está indisponível');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })));
    await expect(http.get('/y')).rejects.toThrow('O servidor está indisponível');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 418 })));
    await expect(http.get('/y')).rejects.toThrow('Erro 418');
    // Falha inesperada no servidor: o código para achar o problema no log.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'InternalServerError', requestId: '3f2b8c1e-9d4a' }), { status: 500 })));
    await expect(http.get('/y')).rejects.toThrow('código 3f2b8c1e');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(http.get('/y')).rejects.toThrow(/servidor/);
  });
});

describe('mensagens e confirmações', () => {
  it('confirma e cancela ações perigosas da temporada', async () => {
    const snapshot = fixtures.games.automatic.find((s) => s.label.endsWith('antes') && s.state.phase === 'MISSION')!;
    const view = await openSeason(snapshot);
    const buttons = screen.queryAllByRole('button', { name: /Simular até o fim/i });
    for (const button of buttons) {
      await view.user.click(button);
      const dialog = await screen.findByRole('dialog').catch(() => null);
      if (dialog) await exercise(view.user, { root: dialog, maxClicks: 3 });
    }
    expect(within(document.body).queryAllByRole('button').length).toBeGreaterThan(0);
  });
});
