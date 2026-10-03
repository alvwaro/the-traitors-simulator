import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayHistory, GameState, SimulationEventRecord } from '../../../domain/models';
import { FakeApi, findSnapshot, fixtures, type Snapshot } from '../../../test/fakeApi';
import { renderApp, settled } from '../../../test/render';

type Moment = Snapshot & { state: GameState; history: { days: DayHistory[]; players: { id: string; name: string }[] } };

const TALK = ['PLAYER', 'REACTION'];

/** A história do momento atual (sem as conversas do jogador), como o drama conta. */
function storyOf(s: Moment): SimulationEventRecord[] {
  const today = s.history.days.find((d) => d.day.number === s.state.day);
  return (today?.events ?? []).filter((e) => e.phase === s.state.phase && !TALK.includes(e.kind));
}

/** Um momento gravado do modo Jogador, com o drama ligado (ou não). */
function moment(test: (s: Moment) => boolean, drama = true): Moment {
  const snapshot = structuredClone(findSnapshot(fixtures.games.player, (s) => test(s as Moment))) as Moment;
  snapshot.state.season.drama = drama;
  return snapshot;
}

/**
 * Café já simulado e sem conversa pendente (a parede de fotos aparece), visto por quem está no jogo,
 * com alguém que não desceu (revelado no meio da história).
 */
const breakfast = (drama = true) =>
  moment((s) => {
    const me = s.state.player;
    return s.state.phase === 'BREAKFAST' && s.state.phaseSimulated && !!me && !me.spectator && !me.canTalk && storyOf(s).findIndex((e) => e.kind === 'MURDER') > 1;
  }, drama);

async function open(snapshot: Snapshot) {
  const api = new FakeApi();
  api.snapshot = snapshot;
  const view = renderApp(`/temporadas/${snapshot.details.id}`, api);
  await settled();
  return view;
}

const bar = () => screen.queryByRole('group', { name: 'Avançar na história' });
const step = (label: 'Próximo' | 'Mostrar tudo') => within(bar()!).getByRole('button', { name: label });
/** O número ao lado de um rótulo do cabeçalho (prêmio, no castelo, eliminados). */
const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
const telling = 'A história deste momento ainda não terminou: continue acima';
const murder = () => screen.queryByText(/A porta não abre mais/);
const wall = () => screen.queryByText(/não apareceu\. Foi assassinado/);

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('modo drama (temporada jogável)', () => {
  it('no café, quem desce aparece um de cada vez; a parede, o elenco e o avançar esperam o fim', async () => {
    const snapshot = breakfast();
    const total = storyOf(snapshot).length;
    const { user } = await open(snapshot);
    expect(within(bar()!).getByText(`1 de ${total}`)).toBeInTheDocument();
    expect(murder()).not.toBeInTheDocument();
    expect(wall()).not.toBeInTheDocument();
    expect(screen.getByText(telling)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avançar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Exibir informações' }));
    expect(screen.getByText('O elenco aparece quando a história deste momento terminar.')).toBeInTheDocument();

    await user.click(step('Próximo'));
    expect(within(bar()!).getByText(`2 de ${total}`)).toBeInTheDocument();

    await user.click(step('Mostrar tudo'));
    expect(bar()).not.toBeInTheDocument();
    expect(murder()).toBeInTheDocument();
    expect(wall()).toBeInTheDocument();
    expect(screen.queryByText(telling)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avançar' })).toBeEnabled();
    expect(screen.queryByText('O elenco aparece quando a história deste momento terminar.')).not.toBeInTheDocument();
  });

  it('sem drama, tudo aparece de uma vez (como sempre foi)', async () => {
    await open(breakfast(false));
    expect(bar()).not.toBeInTheDocument();
    expect(murder()).toBeInTheDocument();
    expect(wall()).toBeInTheDocument();
  });

  it('quem já saiu do jogo também assiste aos votos um a um, e o banimento vem no fim', async () => {
    const snapshot = moment((s) => s.state.phase === 'ROUND_TABLE' && s.state.phaseSimulated && !s.state.player?.need && !!s.history.days.find((d) => d.day.number === s.state.day)?.roundTables[0]?.banishedPlayerId);
    // Visto por quem já foi eliminado(a): a tela de quem assiste.
    Object.assign(snapshot.state.player!, { spectator: true, isActive: false });
    const story = storyOf(snapshot);
    const firstVote = story.findIndex((e) => e.kind === 'VOTE');
    const table = snapshot.history.days.find((d) => d.day.number === snapshot.state.day)!.roundTables[0];
    const banished = snapshot.history.players.find((p) => p.id === table.banishedPlayerId)!.name;
    const votes = () => screen.queryAllByRole('cell', { name: '→' }).length;

    const { user } = await open(snapshot);
    expect(within(bar()!).getByText(`1 de ${story.length}`)).toBeInTheDocument();
    for (let i = 0; i < firstVote; i++) await user.click(step('Próximo'));
    expect(votes()).toBe(1);
    await user.click(step('Próximo'));
    expect(votes()).toBe(2);
    expect(screen.queryByText(`${banished} foi banido(a)`)).not.toBeInTheDocument();

    await user.click(step('Mostrar tudo'));
    expect(votes()).toBe(story.filter((e) => e.kind === 'VOTE').length);
    expect(screen.getByText(`${banished} foi banido(a)`)).toBeInTheDocument();
  });

  it('a sua escolha (o desempate) só aparece depois de ver todos os votos', async () => {
    const { user } = await open(moment((s) => s.state.player?.need === 'REVOTE' && storyOf(s).length > 1));
    expect(screen.getByText(telling)).toBeInTheDocument();
    expect(screen.queryByText('Sua vez: faça a sua escolha acima')).not.toBeInTheDocument();
    await user.click(step('Mostrar tudo'));
    expect(screen.getByText('Sua vez: faça a sua escolha acima')).toBeInTheDocument();
  });

  it('o progresso fica guardado: recarregar a página não volta ao começo', async () => {
    const snapshot = breakfast();
    const first = await open(snapshot);
    await first.user.click(step('Próximo'));
    await first.user.click(step('Próximo'));
    first.unmount();
    await open(snapshot);
    expect(within(bar()!).getByText(`3 de ${storyOf(snapshot).length}`)).toBeInTheDocument();
  });

  it('o placar do topo não entrega o que a história ainda vai contar', async () => {
    const snapshot = breakfast();
    const { prizePot } = snapshot.state;
    const active = snapshot.state.activePlayers.length;
    const eliminated = snapshot.state.eliminatedPlayers.length;
    const key = `drama-score:${snapshot.details.id}`;
    // O último placar que o jogador viu inteiro: antes da noite, com a vítima ainda no castelo.
    sessionStorage.setItem(key, JSON.stringify({ prizePot, active: active + 1, eliminated: eliminated - 1 }));
    const { user } = await open(snapshot);
    expect(stat('No castelo')).toBe(String(active + 1));
    expect(stat('Eliminados')).toBe(String(eliminated - 1));

    await user.click(step('Mostrar tudo'));
    expect(stat('No castelo')).toBe(String(active));
    expect(stat('Eliminados')).toBe(String(eliminated));
    expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ prizePot, active, eliminated });
  });

  it('do convite do café até o fim da história, o placar segue o que você já viu', async () => {
    const before = moment((s) => s.state.phase === 'BREAKFAST' && !s.state.phaseSimulated);
    const after = moment((s) => s.details.id === before.details.id && s.state.day === before.state.day && s.state.phase === 'BREAKFAST' && s.state.phaseSimulated && !s.state.player?.canTalk);
    const { prizePot } = after.state;
    const active = after.state.activePlayers.length;
    const eliminated = after.state.eliminatedPlayers.length;
    sessionStorage.setItem(`drama-score:${before.details.id}`, JSON.stringify({ prizePot, active: active + 1, eliminated: eliminated - 1 }));
    const api = new FakeApi();
    api.snapshot = before;
    const { user } = renderApp(`/temporadas/${before.details.id}`, api);
    await settled();
    // Antes de descer para o café, a morte da noite ainda não aparece no topo.
    expect(stat('No castelo')).toBe(String(active + 1));

    api.snapshot = after;
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('group', { name: 'Avançar na história' });
    expect(stat('No castelo')).toBe(String(active + 1));
    await user.click(step('Mostrar tudo'));
    expect(stat('No castelo')).toBe(String(active));
    expect(stat('Eliminados')).toBe(String(eliminated));
  });

  it('placar guardado com defeito: mostra o de agora', async () => {
    const snapshot = breakfast();
    const live = String(snapshot.state.activePlayers.length);
    for (const junk of ['{"active": "muitos"}', '{quebrado']) {
      sessionStorage.setItem(`drama-score:${snapshot.details.id}`, junk);
      const view = await open(snapshot);
      expect(stat('No castelo')).toBe(live);
      view.unmount();
    }
  });

  it('sem armazenamento (aba privada, bloqueio), o drama segue só na memória', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const snapshot = breakfast();
    const { user } = await open(snapshot);
    await user.click(step('Próximo'));
    expect(within(bar()!).getByText(`2 de ${storyOf(snapshot).length}`)).toBeInTheDocument();
  });
});
