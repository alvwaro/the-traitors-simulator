/**
 * Frases das conversas: cada marcador diferente ({user}, {user1}, {user2}...) é uma pessoa diferente;
 * o mesmo marcador repetido é sempre a mesma pessoa. {victim} é quem acabou de sair do jogo.
 */
export const PHRASE_MAX_LENGTH = 400;

const ANY_TOKEN = /\{[^}]*\}?/g;
const VALID_TOKEN = /^\{(?:user\d*|victim)\}$/;
const HAS_USER = /\{user\d*\}/;

/** Os marcadores de personagem da frase, na ordem em que aparecem (com a posição de cada um). */
export function userTokens(template: string): RegExpExecArray[] {
  return [...template.matchAll(/\{user\d*\}/g)];
}

/** As vagas de personagem da frase, na ordem de aparição (cada marcador diferente uma vez). */
export function userSlots(template: string): string[] {
  return [...new Set(userTokens(template).map((match) => match[0]))];
}

/**
 * O que está errado numa frase já aparada (null = pode salvar).
 * A frase vazia é tratada por quem chama: o formulário ainda não mostra erro, o servidor recusa.
 */
export function phraseProblem(text: string): string | null {
  if (text.length > PHRASE_MAX_LENGTH) return `A frase pode ter no máximo ${PHRASE_MAX_LENGTH} caracteres`;
  const invalid = (text.match(ANY_TOKEN) ?? []).find((token) => !VALID_TOKEN.test(token));
  if (invalid) return `Marcador inválido: ${invalid}. Use {user}, {user1}, {user2}... ou {victim}`;
  if (!HAS_USER.test(text)) return 'A frase precisa de pelo menos um {user}';
  return null;
}
