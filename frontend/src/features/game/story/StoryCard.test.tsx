import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Player } from '../../../domain/models';
import type { Conversation } from '../../../domain/phrases';
import { fixtures } from '../../../test/fakeApi';
import { refitLines, StoryCard } from './StoryCard';
import type { StoryScene } from './storyScene';

const players = (fixtures.games.manual.at(-1)!.details as unknown as { players: Player[] }).players;
const withPhotos = players.map((p, i) => ({ ...p, imageUrl: i % 2 ? `https://example.com/${i}.png` : p.imageUrl }));

function conversations(count: number): Conversation[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `c${i}`,
    players: [withPhotos[i % withPhotos.length], withPhotos[(i + 1) % withPhotos.length]],
    parts: [
      { kind: 'player', player: withPhotos[i % withPhotos.length] },
      { kind: 'text', text: ' disse algo longo o bastante para ocupar mais de uma linha na arte do story, ' },
      { kind: 'player', player: withPhotos[(i + 1) % withPhotos.length] },
    ],
  }));
}

const many = [...withPhotos, ...withPhotos, ...withPhotos].map((p, i) => ({ ...p, id: `${p.id}-${i}` }));
const ballots = withPhotos.slice(1).map((p) => ({ voterId: p.id, targetId: withPhotos[0].id }));

const SCENES: [string, StoryScene][] = [
  ['parede', { kind: 'wall', players: withPhotos }],
  ['parede cheia com manchete ruim', { kind: 'wall', players: many, headline: 'Alguém não desceu', tone: 'bad' }],
  ['parede com manchete boa', { kind: 'wall', players: withPhotos.slice(0, 3), headline: 'Todos vivos', tone: 'good' }],
  ['poucas conversas', { kind: 'conversations', conversations: conversations(2) }],
  ['muitas conversas', { kind: 'conversations', conversations: conversations(9) }],
  ['assassinato', { kind: 'elimination', player: withPhotos[0], status: 'MURDERED', headline: 'Foi assassinado(a)', detail: 'Pela ordem dos Traidores.' }],
  ['banimento revelado', { kind: 'elimination', player: withPhotos[1], status: 'BANISHED', headline: 'Foi banido(a)', role: 'TRAITOR' }],
  ['banimento', { kind: 'banishment', player: withPhotos[2], role: 'FAITHFUL', votes: 5 }],
  ['banimento sem revelação', { kind: 'banishment', player: withPhotos[2], votes: 1 }],
  ['missão', { kind: 'mission', name: 'O Barco Viking', prize: 25000, shielded: withPhotos.slice(0, 3) }],
  ['missão sem escudos', { kind: 'mission', name: 'Missão', prize: 0, shielded: [] }],
  ['vencedores', { kind: 'winners', players: withPhotos.slice(0, 2), headline: 'Os Fiéis venceram' }],
  ['um escudo', { kind: 'shields', players: withPhotos.slice(0, 1) }],
  ['alguns escudos', { kind: 'shields', players: withPhotos.slice(0, 5) }],
  ['muitos escudos', { kind: 'shields', players: many.slice(0, 14) }],
  ['torre', { kind: 'tower' }],
  ['mesa redonda', { kind: 'roundTable', players: withPhotos, votes: { [withPhotos[0].id]: ballots.length }, ballots }],
  ['mesa redonda cheia', { kind: 'roundTable', players: many.slice(0, 20), votes: {}, ballots: [] }],
];

describe('arte do Instagram', () => {
  it.each(SCENES)('desenha a cena: %s', (_, scene) => {
    const { container } = render(<StoryCard scene={scene} seasonName="Temporada" currency="BRL" />);
    expect(container.firstChild).toBeTruthy();
    refitLines(container as HTMLElement);
  });
});
