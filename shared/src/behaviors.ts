/**
 * Chaves dos efeitos de um comportamento. Todo efeito é um modificador de -50 a +50.
 *
 * Relacionamentos iniciais (somados à base de cada par):
 *   trustGiven / likeGiven / hateGiven          o que o personagem sente pelos outros
 *   trustReceived / likeReceived / hateReceived o que os outros sentem por ele
 *   envy                                         ódio extra pelos personagens mais queridos
 *
 * Atributos de jogo (base 50, de 0 a 100 depois de somar as tags):
 *   loyalty      lealdade: chance de transformar confiança em aliança e de não trair aliados
 *   paranoia     desconfiança: a confiança cai com o tempo e o voto segue a suspeita
 *   aggression   agressividade: vota por ódio, acusa e briga mais
 *   influence    influência: o quanto acusações e defesas mudam a opinião dos outros
 *   deception    dissimulação: como traidor(a), levanta menos suspeita
 *   skill        habilidade nas missões
 *   volatility   intensidade: o quanto os relacionamentos mudam depois de cada acontecimento
 *   sociability  sociabilidade: o quanto fala nas conversas
 *   grudge       rancor: o ódio demora a passar e pesa mais no voto
 *   insight      intuição: percebe os traidores mais rápido
 *   unpredictability  imprevisibilidade: soma-se à loucura da temporada nas decisões dele(a)
 *   conformity   conformismo: vota com a maioria (negativo = do contra)
 */
export const BEHAVIOR_EFFECT_KEYS = [
  'trustGiven',
  'likeGiven',
  'hateGiven',
  'trustReceived',
  'likeReceived',
  'hateReceived',
  'envy',
  'loyalty',
  'paranoia',
  'aggression',
  'influence',
  'deception',
  'skill',
  'volatility',
  'sociability',
  'grudge',
  'insight',
  'unpredictability',
  'conformity',
] as const;

export type BehaviorEffectKey = (typeof BEHAVIOR_EFFECT_KEYS)[number];
export type BehaviorEffects = Partial<Record<BehaviorEffectKey, number>>;

/** Maior modificador (em módulo) de um efeito. */
export const BEHAVIOR_EFFECT_LIMIT = 50;
export const BEHAVIOR_NAME_MAX_LENGTH = 40;

export function isBehaviorEffectKey(key: string): key is BehaviorEffectKey {
  return (BEHAVIOR_EFFECT_KEYS as readonly string[]).includes(key);
}
