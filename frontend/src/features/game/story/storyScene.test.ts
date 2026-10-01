import { describe, expect, it } from 'vitest';
import type { DayHistory, GameState, Player, SeasonHistory, TraitorMeetingRecord } from '../../../domain/models';
import type { GameContextValue } from '../context/GameContext';
import { shieldScene, storyScene } from './storyScene';

const victim = { id: 'v1', name: 'Ana', status: 'MURDERED' } as Player;
const draft = { conversations: [], shieldIds: [], hiddenShieldIds: [], votes: [] };

/** Conclave de hoje: `meeting` null = a reunião ainda não foi registrada. */
function conclave(meeting: TraitorMeetingRecord | null): GameContextValue {
  return {
    seasonId: 's1',
    state: { phase: 'TRAITORS_MEETING', activePlayers: [] } as unknown as GameState,
    history: { players: [victim] } as unknown as SeasonHistory,
    phrases: [],
    playersById: new Map([[victim.id, victim]]),
    today: { traitorsMeeting: meeting, missions: [], roundTables: [] } as unknown as DayHistory,
    yesterday: undefined,
    refresh: () => undefined,
  };
}

const meeting = (murder: TraitorMeetingRecord['murder']): TraitorMeetingRecord => ({
  id: 'm1',
  dayId: 'd1',
  murder,
  recruitments: [],
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
});

describe('arte do conclave (Estilizar para o Instagram)', () => {
  it('enquanto a reunião não foi registrada, mostra a torre', () => {
    expect(storyScene(conclave(null), draft)).toEqual({ kind: 'tower' });
  });

  it('sem assassinato, avisa que ninguém morreu', () => {
    expect(storyScene(conclave(meeting(null)), draft)).toEqual({ kind: 'noMurder' });
  });

  it('com o alvo salvo pelo escudo, também ninguém morreu (sem revelar quem era o alvo)', () => {
    const scene = storyScene(conclave(meeting({ id: 'x', targetId: victim.id, outcome: 'BLOCKED_BY_SHIELD' })), draft);
    expect(scene).toEqual({ kind: 'noMurder', detail: 'O alvo dos Traidores estava protegido por um escudo.' });
  });

  it('com assassinato, mostra a vítima', () => {
    const scene = storyScene(conclave(meeting({ id: 'x', targetId: victim.id, outcome: 'SUCCESS' })), draft);
    expect(scene).toMatchObject({ kind: 'elimination', player: victim, status: 'MURDERED', headline: 'Ana foi assassinado(a)' });
    expect(storyScene(conclave(meeting({ id: 'x', targetId: 'desconhecido', outcome: 'SUCCESS' })), draft)).toMatchObject({ kind: 'wall' });
  });
});

describe('arte dos escudos', () => {
  const ana = { id: 'a', name: 'Ana', status: 'ACTIVE' } as Player;
  const bia = { id: 'b', name: 'Bia', status: 'ACTIVE' } as Player;
  const caio = { id: 'c', name: 'Caio', status: 'ACTIVE' } as Player;
  const reward = (playerId: string, hidden = false) => ({ id: playerId, missionId: 'm', playerId, rewardType: 'SHIELD' as const, hidden });
  const game = (missions: unknown[]): GameContextValue =>
    ({
      state: { phase: 'MISSION', activePlayers: [ana, bia, caio] },
      history: { players: [ana, bia, caio] },
      playersById: new Map([ana, bia, caio].map((p) => [p.id, p])),
      today: { missions, roundTables: [], traitorsMeeting: null },
    }) as unknown as GameContextValue;

  it('escudo escondido vira "?" e não entra com foto', () => {
    const g = game([{ id: 'm', name: 'Barco', prizeEarned: 0, rewards: [reward('a'), reward('b', true)] }]);
    expect(shieldScene(g, [])).toEqual({ kind: 'shields', players: [ana], hidden: 1 });
    expect(storyScene(g, draft)).toMatchObject({ kind: 'mission', shielded: [ana], hidden: 1 });
  });

  it('soma os escondidos do formulário e o escudo misterioso da simulação conta um "?" só', () => {
    const g = game([{ id: 'm', name: 'Barco', prizeEarned: 0, shieldsHidden: true, rewards: [reward('a'), reward('b')] }]);
    expect(shieldScene(g, ['c'], ['c'])).toEqual({ kind: 'shields', players: [], hidden: 2 });
  });
});
