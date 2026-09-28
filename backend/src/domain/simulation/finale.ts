import { COFFIN_FIRST_DAY, COFFIN_MIN_PLAYERS, FINAL_PLAYERS, SEER_MAX_PLAYERS } from '../rules';
import type { SimulationFlags } from './SimulationEngine';

/**
 * Regras da reta final e das reviravoltas da 3ª temporada, usadas pelo motor e pela tela do jogador
 * (que precisa saber antes o que a noite pede).
 */

/** Com poucos jogadores, os assassinatos acabam: o jogo se decide à mesa. */
export function murdersOver(activeCount: number): boolean {
  return activeCount <= FINAL_PLAYERS;
}

/**
 * A noite dos caixões ("Nail in a Coffin"): uma vez por temporada, na primeira noite possível,
 * os traidores escolhem três nomes e um deles é assassinado à vista de todos.
 */
export function isCoffinNight(flags: SimulationFlags, day: number, activeCount: number): boolean {
  return !flags.coffins && day >= COFFIN_FIRST_DAY && activeCount >= COFFIN_MIN_PLAYERS && flags.dungeon?.day !== day && flags.poisonArmedDay !== day;
}

/** A missão de hoje é a do Vidente (uma vez, perto da final). */
export function isSeerMissionDay(flags: SimulationFlags, day: number, activeCount: number): boolean {
  return !flags.seer && day >= 3 && activeCount > FINAL_PLAYERS && activeCount <= SEER_MAX_PLAYERS;
}

/** Esta noite o Vidente escolhe com quem jantar. */
export function seerDinnerTonight(flags: SimulationFlags, day: number): boolean {
  return flags.seer?.day === day && !flags.seer.guestId;
}

/** No café, o Vidente ainda não contou o que viu no jantar de ontem. */
export function seerNewsToday(flags: SimulationFlags, day: number): boolean {
  return flags.seer?.day === day - 1 && !!flags.seer.guestId && !flags.seer.announced;
}
