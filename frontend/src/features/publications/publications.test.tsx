import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Publication } from '../../domain/models';
import { ApiError } from '../../services/http/HttpClient';
import { FakeApi, fanSeason, fixtures, officialSeason } from '../../test/fakeApi';
import { renderApp, settled } from '../../test/render';

const usSeason = officialSeason('US') as unknown as Publication;
const ukSeason = officialSeason('UK') as unknown as Publication;
const fanPublication = fanSeason() as unknown as Publication;

/** A API gravada com algumas leituras trocadas (por um valor ou por um erro). */
class PatchedApi extends FakeApi {
  constructor(private readonly patches: Record<string, unknown>) {
    super();
  }

  override get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    if (!(path in this.patches)) return super.get<T>(path, query);
    this.calls.push({ method: 'GET', path, body: query });
    const value = this.patches[path];
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(structuredClone(value) as T);
  }
}

/** Temporada de outra pessoa: a API responde 404. */
const someoneElses = (seasonId: string) => new PatchedApi({ [`/seasons/${seasonId}`]: new ApiError('Temporada não encontrada', 404) });

const posted = (api: FakeApi, path: string) => api.calls.find((c) => c.method === 'POST' && c.path === path);

describe('Temporadas Oficiais', () => {
  it('separa as temporadas entre EUA e Reino Unido, sem casts, personagens nem Minha Área', async () => {
    renderApp('/');
    await settled();
    const tabs = screen.getByRole('navigation', { name: 'Áreas do site' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Temporadas Oficiais', 'Área de Fãs']);
    for (const [season, title] of [[usSeason, 'Estados Unidos'], [ukSeason, 'Reino Unido']] as const) {
      const section = screen.getByRole('region', { name: title });
      expect(within(section).getByRole('button', { name: season.name })).toBeInTheDocument();
      expect(within(section).getByText(`${season.snapshot.characters.length} participantes`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Elencos oficiais|Participantes reais|montadas pelos donos do site/)).toBeNull();
  });

  it('mostra as temporadas de cada país na ordem do programa', async () => {
    const at = (id: string, name: string, missionPool: string) => ({ ...usSeason, id, name, season: { ...usSeason.season!, missionPool } });
    // A API devolve as mais recentes primeiro.
    const list = [at('p-mix', 'Mistura dos fãs', 'MIX'), at('p-4', 'Quarta', 'US_S4'), at('p-1', 'Primeira', 'US_S1'), at('p-uk', 'Britânica em lista dos EUA', 'UK_S2')];
    renderApp('/', new PatchedApi({ '/publications': list }));
    await settled();
    const section = screen.getByRole('region', { name: 'Estados Unidos' });
    const names = within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Primeira', 'Quarta', 'Britânica em lista dos EUA', 'Mistura dos fãs']);
    expect(within(screen.getByRole('region', { name: 'Reino Unido' })).getByText('Nenhuma temporada do Reino Unido publicada ainda')).toBeInTheDocument();
  });
});

describe('página da temporada publicada', () => {
  it('capa com a foto do elenco; se a foto não abrir, ficam as iniciais', async () => {
    const cover = 'https://example.com/capa.png';
    renderApp(`/publicacoes/${usSeason.id}`, new PatchedApi({ [`/publications/${usSeason.id}`]: { ...usSeason, imageUrl: cover } }));
    await settled();
    const image = document.querySelector(`img[src="${cover}"]`);
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(document.querySelector(`img[src="${cover}"]`)).toBeNull();
  });

  it('mostra as informações e o elenco, sem o andamento do jogo', async () => {
    renderApp(`/publicacoes/${usSeason.id}`);
    await settled();
    expect(screen.getByRole('heading', { level: 1, name: usSeason.name })).toBeInTheDocument();
    const facts = screen.getByText('Participantes').closest('dl')!;
    expect(within(facts).getAllByRole('term').map((t) => t.textContent)).toEqual(['Participantes', 'Missões e reviravoltas']);
    expect(screen.queryByText(/Situação|Modo|Prêmio|Crônica|Vencedores|Temporada oficial ·/)).toBeNull();

    // A temporada do programa que ela reproduz, com o guia.
    const edition = screen.getByRole('region', { name: 'A temporada do programa' });
    expect(within(edition).getByRole('link').getAttribute('href')).toBe('/guia/US_S4');

    // Cada foto do elenco leva à página do participante.
    const cast = screen.getByRole('region', { name: 'Elenco' });
    expect(within(cast).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(usSeason.snapshot.characters.map((c) => `/participantes/${c.characterId}`));
  });

  it('copia a temporada inteira (com as configurações) ou só o elenco', async () => {
    const view = renderApp(`/publicacoes/${usSeason.id}`);
    await settled();
    await view.user.click(screen.getByRole('button', { name: 'Copiar temporada' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Seu nome no castelo')).toBeNull();
    await view.user.type(within(dialog).getByLabelText('Nome da temporada'), 'Minha versão');
    await view.user.click(within(dialog).getByRole('button', { name: 'Copiar temporada' }));
    const opened = await screen.findByRole('link', { name: 'Abrir a temporada' });
    expect(opened.getAttribute('href')).toBe(`/temporadas/${fixtures.games.manual[0].details.id}`);
    expect(posted(view.api, `/publications/${usSeason.id}/copy-season`)?.body).toEqual({ name: 'Minha versão' });
    await view.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await view.user.click(within(screen.getByRole('region', { name: 'Elenco' })).getByRole('button', { name: 'Copiar elenco' }));
    dialog = await screen.findByRole('dialog');
    await view.user.click(within(dialog).getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(posted(view.api, `/publications/${usSeason.id}/copy`)).toBeTruthy());
  });

  it('no modo Jogador, a cópia da temporada pede o nome de quem vai jogar', async () => {
    const played = { ...fanPublication, season: { ...fanPublication.season!, mode: 'PLAYER' } };
    const api = new PatchedApi({ [`/publications/${fanPublication.id}`]: played });
    const view = renderApp(`/publicacoes/${fanPublication.id}`, api);
    await settled();
    await view.user.click(screen.getByRole('button', { name: 'Copiar temporada' }));
    const dialog = await screen.findByRole('dialog');
    await view.user.type(within(dialog).getByLabelText('Seu nome no castelo'), 'Eu');
    await view.user.click(within(dialog).getByRole('button', { name: 'Copiar temporada' }));
    await waitFor(() => expect(posted(api, `/publications/${fanPublication.id}/copy-season`)?.body).toEqual({ human: { name: 'Eu' } }));
  });

  it('temporada de fã: quem publicou e o elenco sem fotos marcadas nem links', async () => {
    renderApp(`/publicacoes/${fanPublication.id}`);
    await settled();
    expect(screen.getByText(new RegExp(`por ${fanPublication.publisherName}`))).toBeInTheDocument();
    const cast = screen.getByRole('region', { name: 'Elenco' });
    expect(within(cast).queryAllByRole('link')).toHaveLength(0);
    expect(within(cast).queryAllByTitle(/Banido|Assassinado|Deixou o jogo/)).toHaveLength(0);
  });

  it('o link antigo de uma temporada publicada leva à publicação; o de uma não publicada mostra o erro', async () => {
    const seasonId = fanPublication.seasonId!;
    const view = renderApp(`/temporadas/${seasonId}`, someoneElses(seasonId));
    await waitFor(() => expect(view.router.state.location.pathname).toBe(`/publicacoes/${fanPublication.id}`));
    view.unmount();

    const other = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';
    renderApp(`/temporadas/${other}`, someoneElses(other));
    expect(await screen.findByText('Temporada não encontrada')).toBeInTheDocument();
  });
});

describe('biblioteca: suas temporadas e o que você publicou', () => {
  it('a Minha Área virou a aba Temporadas da biblioteca, e o nome no topo leva até ela', async () => {
    const view = renderApp('/minha-area');
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/biblioteca'));
    await settled();
    const tabs = screen.getByRole('navigation', { name: 'Seções da biblioteca' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Temporadas', 'Casts', 'Personagens', 'Comportamentos', 'Frases']);
    expect(screen.getByRole('region', { name: 'Minhas temporadas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Minhas publicações' })).toBeInTheDocument();
    const me = (fixtures.me.user as { username: string }).username;
    expect(screen.getByRole('link', { name: me }).getAttribute('href')).toBe('/biblioteca');
  });

  it('separa as temporadas em jogáveis, automáticas e manuais; as encerradas ficam em Arquivadas', async () => {
    const api = new FakeApi();
    // Duas ainda em andamento (uma jogável e uma manual); as outras três já terminaram.
    api.seasons = fixtures.seasons.map((s, i) => (i === 0 || i === 4 ? { ...s, status: 'IN_PROGRESS' } : s));
    const view = renderApp('/biblioteca', api);
    await settled();
    const current = screen.getByRole('region', { name: 'Minhas temporadas' });
    expect(within(current).getByText('2 temporadas')).toBeInTheDocument();
    expect(within(current).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Jogáveis', 'Manuais']);
    const playable = within(current).getByRole('region', { name: 'Jogáveis' });
    expect(within(playable).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([fixtures.seasons[0].name]);

    // "Arquivadas" fica à esquerda de "Nova temporada", discreto (não é o botão verde).
    const archive = within(current).getByRole('link', { name: 'Arquivadas (3)' });
    const create = within(current).getByRole('link', { name: 'Nova temporada' });
    expect(archive.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(archive.className).toMatch(/\bghost\b/);
    expect(create.className).toMatch(/\bprimary\b/);

    await view.user.click(archive);
    expect(view.router.state.location.search).toBe('?arquivadas');
    const archived = screen.getByRole('region', { name: 'Temporadas arquivadas' });
    expect(within(archived).getByText('3 temporadas arquivadas')).toBeInTheDocument();
    expect(within(archived).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Jogáveis', 'Automáticas']);
    expect(screen.queryByRole('region', { name: 'Minhas publicações' })).not.toBeInTheDocument();

    await view.user.click(within(archived).getByRole('link', { name: 'Voltar às temporadas' }));
    expect(view.router.state.location.search).toBe('');
    expect(screen.getByRole('region', { name: 'Minhas publicações' })).toBeInTheDocument();
  });

  it('avisa quando não há temporada em andamento, nenhuma arquivada ou nenhuma ainda', async () => {
    // As gravadas já terminaram todas: a lista principal fica vazia e aponta para as arquivadas.
    const first = renderApp('/biblioteca');
    await settled();
    expect(screen.getByText('Nenhuma temporada em andamento')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Arquivadas (5)' })).toBeInTheDocument();
    first.unmount();

    const api = new FakeApi();
    api.seasons = [];
    const second = renderApp('/biblioteca?arquivadas', api);
    await settled();
    expect(screen.getByText('Nenhuma temporada arquivada')).toBeInTheDocument();
    expect(screen.getByText('0 temporadas arquivadas')).toBeInTheDocument();
    await second.user.click(screen.getByRole('link', { name: 'Voltar às temporadas' }));
    expect(screen.getByText('Nenhuma temporada ainda')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Arquivadas' })).toBeInTheDocument();
  });

  async function openPublishModal(api: FakeApi) {
    const view = renderApp('/biblioteca?arquivadas', api);
    await settled();
    await view.user.click(within(screen.getByRole('region', { name: 'Temporadas arquivadas' })).getAllByRole('button', { name: 'Publicar' })[0]);
    return { view, dialog: await screen.findByRole('dialog') };
  }

  it('o dono do site escolhe entre as oficiais dos EUA, do Reino Unido ou a Área de Fãs', async () => {
    const api = new FakeApi();
    api.user = fixtures.owner.user;
    const { view, dialog } = await openPublishModal(api);
    expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    await view.user.click(within(dialog).getByLabelText('Temporadas Oficiais · Reino Unido'));
    expect(within(dialog).getByText('Temporadas Oficiais · Reino Unido', { selector: 'strong' })).toBeInTheDocument();
    await view.user.click(within(dialog).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(posted(api, '/publications')?.body).toMatchObject({ kind: 'SEASON', area: 'OFFICIAL', country: 'UK' }));
  });

  it('fãs publicam na Área de Fãs, sem escolher', async () => {
    const api = new FakeApi();
    const { view, dialog } = await openPublishModal(api);
    expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);
    expect(within(dialog).getByText('Área de Fãs', { selector: 'strong' })).toBeInTheDocument();
    await view.user.click(within(dialog).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(posted(api, '/publications')?.body).toEqual({ kind: 'SEASON', sourceId: expect.any(String), description: null }));
  });
});
