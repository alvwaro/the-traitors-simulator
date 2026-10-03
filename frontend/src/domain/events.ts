import type { GamePhase, SimulationEventKind } from './enums';
import type { DayHistory, Player, SimulationEventRecord } from './models';
import { fillTemplate, slotsOf, type Conversation, type ConversationPart } from './phrases';

export interface RenderedEvent {
  event: SimulationEventRecord;
  /** Participantes sem repetição, na ordem em que aparecem. */
  players: Player[];
  parts: ConversationPart[];
}

/** Troca os marcadores do acontecimento pelos jogadores (mesma regra das frases). */
export function renderEvent(event: SimulationEventRecord, playersById: Map<string, Player>): RenderedEvent {
  const slots = slotsOf(event.text);
  const players = slots.map((_, i) => playersById.get(event.playerIds[i]) ?? ({ id: event.playerIds[i] ?? String(i), name: '?' } as Player));
  const unique = players.filter((p, i) => players.findIndex((q) => q.id === p.id) === i);
  return { event, players: unique, parts: fillTemplate(event.text, players) };
}

/** As suas conversas no modo Jogador: o que você falou e as respostas que recebeu. */
const TALK_KINDS: SimulationEventKind[] = ['PLAYER', 'REACTION'];

export function isTalk(event: SimulationEventRecord): boolean {
  return TALK_KINDS.includes(event.kind);
}

export function eventsOf(day: DayHistory | undefined, phase: GamePhase): SimulationEventRecord[] {
  return day?.events.filter((e) => e.phase === phase) ?? [];
}

/** Falas da simulação no formato das conversas (arte do Instagram). */
export function eventsAsConversations(events: readonly SimulationEventRecord[], playersById: Map<string, Player>, kinds: SimulationEventKind[] = ['DIALOGUE']): Conversation[] {
  return events
    .filter((e) => kinds.includes(e.kind))
    .map((e) => {
      const { players, parts } = renderEvent(e, playersById);
      return { key: e.id, players, parts };
    });
}
