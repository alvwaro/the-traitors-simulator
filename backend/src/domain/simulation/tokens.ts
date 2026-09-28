/**
 * Marcadores de jogador nas frases: {user} é o primeiro citado, {user1} o segundo, e assim por diante.
 * Quem monta a frase passa os jogadores na mesma ordem dos marcadores.
 */

/** Marcador do jogador de índice `index`: 0 → {user}, 1 → {user1}... */
export function token(index: number): string {
  return index === 0 ? '{user}' : `{user${index}}`;
}

/** "{user}, {user1} e {user2}": `count` marcadores seguidos a partir de `first`. */
export function tokenList(count: number, first = 0): string {
  const list = Array.from({ length: count }, (_, i) => token(first + i));
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} e ${list.at(-1)}`;
}
