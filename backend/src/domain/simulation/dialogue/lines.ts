import { pickOne, Rng } from '../random';

/** Momentos em que alguém fala com o jogador (ou o jogador fala). */
export type Moment = 'ARRIVAL' | 'BREAKFAST' | 'MISSION' | 'TABLE' | 'FINAL' | 'TOWER';

/** Um banco de frases escrito como texto: uma frase por linha (linhas vazias são ignoradas). */
export function lines(text: string): string[] {
  return [
    ...new Set(
      text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ];
}

/** Casa qualquer um dos trechos (sem diferenciar maiúsculas). As listas são texto simples, sem símbolos de regex. */
function anyOf(words: readonly string[]): RegExp {
  return new RegExp(words.join('|'), 'i');
}

/** Na chegada ninguém sabe nada do jogo: nada de votos, traidores, mortes ou missões. */
const GAME_TALK = anyOf([
  'vot', 'mesa', 'assassin', 'banid', 'torre', 'escudo', 'traidor', 'traição', 'trair', 'fiel', 'fiéis', 'matar', 'mata ',
  'morr', 'mort', 'missão', 'prêmio', 'capa preta', 'veneno', 'ontem', 'noite passada', 'suspeit', 'desconfi', 'acus',
  'culpad', 'inocente',
]);

/** Frases que citam um lugar ou objeto só cabem no momento certo. */
const ONLY_IN: [RegExp, Moment[]][] = [
  [anyOf(['café', 'croissant', 'xícara', 'bacon', 'torrada', 'panqueca', 'mingau', 'geleia', 'garfo', 'guardanapo', 'manteiga', 'ovos mexidos']), ['BREAKFAST']],
  [anyOf(['missão', 'lama', 'lago', 'corda', 'pontão', 'gaiola', 'túnel', 'remo', 'barco', 'prova de hoje', 'trilha', 'labirinto']), ['MISSION']],
  [anyOf(['mesa redonda', 'quadro', 'urna', 'escrever o nome', 'escrever seu nome', 'escrever meu nome', 'escrevo o nome', 'escrevo seu nome', 'na hora do voto', 'velas']), ['TABLE', 'FINAL']],
  [anyOf(['mesa final', 'encerrar o jogo', 'banir mais alguém', 'últimos', 'chegamos até aqui']), ['FINAL']],
  [anyOf(['lareira', 'mala', 'figurino', 'chegada', 'primeira impressão', 'acabei de chegar', 'primeiro dia']), ['ARRIVAL', 'BREAKFAST']],
];

/** A frase combina com o momento. */
export function fits(line: string, moment: Moment): boolean {
  if (moment === 'ARRIVAL' && GAME_TALK.test(line)) return false;
  return ONLY_IN.every(([pattern, moments]) => !pattern.test(line) || moments.includes(moment));
}

/**
 * Sorteia uma frase do banco que combine com o momento, evitando as já usadas (`used`).
 * Se nenhuma combinar, usa qualquer uma do banco.
 */
export function pickLine(rng: Rng, bank: readonly string[], moment: Moment, used?: Set<string>): string {
  const fitting = bank.filter((l) => fits(l, moment));
  const fresh = fitting.filter((l) => !used?.has(l));
  const line = pickOne(rng, fresh) ?? pickOne(rng, fitting) ?? pickOne(rng, bank) ?? '';
  used?.add(line);
  return line;
}
