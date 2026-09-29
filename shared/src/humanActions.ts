/** O que o jogador humano pode fazer ao clicar na foto de alguém (modo Jogador). */
export const HUMAN_ACTIONS = [
  'ACCUSE',
  'SUSPECT',
  'DEFEND',
  'TRUST',
  'PRAISE',
  'JOKE',
  'INSULT',
  'ALLIANCE',
  'ASK',
  'ASK_ABOUT',
  'PERSUADE_GUILTY',
  'PERSUADE_INNOCENT',
  'TOWER_ASK',
  'TOWER_KILL',
  'TOWER_SPARE',
  'TOWER_RECRUIT',
] as const;
export type HumanAction = (typeof HUMAN_ACTIONS)[number];

/** Ações que falam de uma terceira pessoa (escolhida depois de clicar em quem ouve). */
export const SUBJECT_ACTIONS: readonly HumanAction[] = ['ASK_ABOUT', 'PERSUADE_GUILTY', 'PERSUADE_INNOCENT', 'TOWER_KILL', 'TOWER_SPARE', 'TOWER_RECRUIT'];
/** Conversas da torre (só com os outros traidores). */
export const TOWER_ACTIONS: readonly HumanAction[] = ['TOWER_ASK', 'TOWER_KILL', 'TOWER_SPARE', 'TOWER_RECRUIT'];
/** Na chegada ninguém sabe nada do jogo: só dá para se apresentar, criar laços (ou antipatias). */
export const ARRIVAL_ACTIONS: readonly HumanAction[] = ['TRUST', 'PRAISE', 'JOKE', 'INSULT', 'ALLIANCE', 'ASK_ABOUT'];
