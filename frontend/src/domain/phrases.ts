import type { Player } from './models';
import { seededRng, shuffle, type Rng } from '../lib/random';

export type ConversationPart = { kind: 'text'; text: string } | { kind: 'player'; player: Player };

export interface Conversation {
  key: string;
  /** Participantes na ordem em que aparecem na frase. */
  players: Player[];
  parts: ConversationPart[];
}

const TOKEN = /\{user(\d*)\}/g;

/**
 * Vagas de personagem de uma frase, na ordem de aparição.
 * Cada marcador diferente ({user}, {user1}, {user2}...) é uma pessoa diferente;
 * o mesmo marcador repetido é sempre a mesma pessoa.
 */
export function slotsOf(template: string): string[] {
  const slots: string[] = [];
  for (const match of template.matchAll(TOKEN)) {
    if (!slots.includes(match[0])) slots.push(match[0]);
  }
  return slots;
}

/** Troca os marcadores pelos personagens (um por vaga, na ordem de slotsOf). */
export function fillTemplate(template: string, players: Player[]): ConversationPart[] {
  const bySlot = new Map(slotsOf(template).map((slot, i) => [slot, players[i]]));
  const parts: ConversationPart[] = [];
  let last = 0;
  for (const match of template.matchAll(TOKEN)) {
    const index = match.index ?? 0;
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

const VALID_TOKEN = /^\{(user\d*|victim)\}$/;
export const PHRASE_MAX_LENGTH = 400;

/** Mesma validação do backend; devolve a mensagem de erro ou null. */
export function validatePhrase(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.length > PHRASE_MAX_LENGTH) return `A frase pode ter no máximo ${PHRASE_MAX_LENGTH} caracteres`;
  const invalid = (text.match(/\{[^}]*\}?/g) ?? []).find((token) => !VALID_TOKEN.test(token));
  if (invalid) return `Marcador inválido: ${invalid}. Use {user}, {user1}, {user2}... ou {victim}`;
  if (!/\{user\d*\}/.test(text)) return 'A frase precisa de pelo menos um {user}';
  return null;
}
