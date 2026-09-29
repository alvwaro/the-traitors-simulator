import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Player, RoundTableRecord } from '../../../../domain/models';
import { BanishmentPicker, banishmentOf, useBallot } from './Banishment';

const player = (id: string, name: string): Player => ({
  id,
  name,
  seasonId: 's',
  characterId: null,
  isHuman: false,
  imageUrl: null,
  behaviorIds: [],
  role: 'TRAITOR',
  isOriginalTraitor: true,
  status: 'ACTIVE',
  eliminatedDayId: null,
  createdAt: '2026-01-01T00:00:00Z',
});
const [ana, bia, caio] = [player('a', 'Ana'), player('b', 'Bia'), player('c', 'Caio')];

describe('useBallot', () => {
  it('sugere o mais votado, deixa escolher outro e recomeça do zero', () => {
    const { result } = renderHook(() => useBallot());
    expect(result.current.banishedId).toBeNull();

    act(() =>
      result.current.setVotes([
        { voterId: 'a', targetId: 'c', round: 1 },
        { voterId: 'b', targetId: 'c', round: 1 },
      ]),
    );
    expect(result.current.leaders).toEqual(['c']);
    expect(result.current.banishedId).toBe('c');

    act(() => result.current.toggle('b'));
    expect(result.current.banishedId).toBe('b');
    act(() => result.current.toggle('b'));
    expect(result.current.banishedId).toBe('c');

    act(() => result.current.reset());
    expect(result.current.votes).toEqual([]);
    expect(result.current.banishedId).toBeNull();
  });

  it('empate: ninguém é sugerido', () => {
    const { result } = renderHook(() => useBallot());
    act(() =>
      result.current.setVotes([
        { voterId: 'a', targetId: 'b', round: 1 },
        { voterId: 'b', targetId: 'a', round: 1 },
      ]),
    );
    expect(result.current.leaders).toHaveLength(2);
    expect(result.current.banishedId).toBeNull();
  });
});

describe('BanishmentPicker', () => {
  function Picker({ markLeaders }: Readonly<{ markLeaders?: boolean }>) {
    const ballot = useBallot();
    return (
      <>
        <button type="button" onClick={() => ballot.setVotes([{ voterId: 'a', targetId: 'b', round: 1 }])}>
          votar
        </button>
        <BanishmentPicker players={[ana, bia, caio]} ballot={ballot} markLeaders={markLeaders} />
      </>
    );
  }

  it('marca o mais votado quando pedido', async () => {
    render(<Picker markLeaders />);
    expect(screen.getByRole('heading', { name: 'Banido(a)' })).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: 'votar' }).click());
    expect(screen.getByText('Mais votado(a)')).toBeInTheDocument();
  });

  it('sem a marcação, só a escolha', async () => {
    render(<Picker />);
    await act(async () => screen.getByRole('button', { name: 'votar' }).click());
    expect(screen.queryByText('Mais votado(a)')).not.toBeInTheDocument();
  });
});

describe('banishmentOf', () => {
  it('usa o papel revelado pela API ou o que a tela já sabia', () => {
    const record = { revealedRole: 'FAITHFUL' } as RoundTableRecord;
    expect(banishmentOf(ana, record)).toEqual({ player: ana, kind: 'BANISHED', role: 'FAITHFUL' });
    expect(banishmentOf(ana, { ...record, revealedRole: null }).role).toBe('TRAITOR');
  });
});
