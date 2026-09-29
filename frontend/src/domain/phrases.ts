import { phraseProblem, userSlots, userTokens } from '@traitors/shared';
import type { Player } from './models';
import { seededRng, shuffle, type Rng } from '../lib/random';

// Tamanho e marcadores seguem a mesma regra do backend (kernel compartilhado).
export { PHRASE_MAX_LENGTH } from '@traitors/shared';

export type ConversationPart = { kind: 'text'; text: string } | { kind: 'player'; player: Player };

export interface Conversation {
  key: string;
  /** Participantes na ordem em que aparecem na frase. */
  players: Player[];
  parts: ConversationPart[];
}

/**
 * Vagas de personagem de uma frase, na ordem de aparição.
 * Cada marcador diferente ({user}, {user1}, {user2}...) é uma pessoa diferente;
 * o mesmo marcador repetido é sempre a mesma pessoa.
 */
export const slotsOf = userSlots;

/** Troca os marcadores pelos personagens (um por vaga, na ordem de slotsOf). */
export function fillTemplate(template: string, players: Player[]): ConversationPart[] {
  const bySlot = new Map(slotsOf(template).map((slot, i) => [slot, players[i]]));
  const parts: ConversationPart[] = [];
  let last = 0;
  for (const match of userTokens(template)) {
    const index = match.index;
    if (index > last) parts.push({ kind: 'text', text: template.slice(last, index) });
    const player = bySlot.get(match[0]);
    if (player) parts.push({ kind: 'player', player });
    last = index + match[0].length;
  }
  if (last < template.length) parts.push({ kind: 'text', text: template.slice(last) });
  return parts;
}

interface GenerateOptions {
  templates: readonly string[];
  players: readonly Player[];
  count: number;
  /** Mesma semente, mesmas conversas (não mudam ao recarregar a página). */
  seed: string;
}

/**
 * Escolhe `size` personagens distintos para uma frase, sempre entre os que menos apareceram
 * nas frases anteriores (empate decidido pela ordem sorteada). Assim ninguém se repete
 * enquanto houver alguém que ainda não apareceu.
 */
function dealLeastUsed(pool: readonly Player[], uses: Map<string, number>, size: number, rng: Rng): Player[] {
  // sort é estável: entre os igualmente usados, vale a ordem embaralhada
  const chosen = shuffle(pool, rng).sort((x, y) => (uses.get(x.id) ?? 0) - (uses.get(y.id) ?? 0)).slice(0, size);
  for (const p of chosen) uses.set(p.id, (uses.get(p.id) ?? 0) + 1);
  return chosen;
}

/**
 * Sorteia `count` frases diferentes. Só entram jogadores ativos (eliminados nunca aparecem),
 * cada frase tem personagens distintos e os nomes não se repetem entre as frases enquanto houver gente nova.
 */
export function generateConversations({ templates, players, count, seed }: GenerateOptions): Conversation[] {
  const rng = seededRng(seed);
  const pool = players.filter((p) => p.status === 'ACTIVE').sort((a, b) => a.id.localeCompare(b.id));
  // {victim} só existe na simulação automática.
  const usable = templates.map((t) => t.trim()).filter((t) => t && !t.includes('{victim}') && slotsOf(t).length <= pool.length);
  const uses = new Map<string, number>();

  return shuffle(usable, rng)
    .slice(0, count)
    .map((template, i) => {
      const chosen = shuffle(dealLeastUsed(pool, uses, slotsOf(template).length, rng), rng);
      return { key: `${i}:${template}`, players: chosen, parts: fillTemplate(template, chosen) };
    });
}

/** Mesma validação do backend; devolve a mensagem de erro ou null (a frase vazia ainda não é erro no formulário). */
export function validatePhrase(raw: string): string | null {
  const text = raw.trim();
  return text ? phraseProblem(text) : null;
}
