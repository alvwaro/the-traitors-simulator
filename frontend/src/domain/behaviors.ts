import { BEHAVIOR_EFFECT_LIMIT, type BehaviorEffectKey } from '@traitors/shared';
import type { Behavior, BehaviorEffects } from './models';

// As chaves e o limite dos efeitos são os mesmos do backend (kernel compartilhado).
export type { BehaviorEffectKey } from '@traitors/shared';
export const EFFECT_LIMIT = BEHAVIOR_EFFECT_LIMIT;

export interface EffectInfo {
  key: BehaviorEffectKey;
  label: string;
  /** O que acontece quando o valor é positivo. */
  description: string;
}

export interface EffectGroup {
  title: string;
  lead: string;
  effects: EffectInfo[];
}

/** Nome e explicação de cada efeito. O tipo exige um texto para cada chave do kernel. */
const EFFECT_TEXT: Readonly<Record<BehaviorEffectKey, readonly [label: string, description: string]>> = {
  trustGiven: ['Confia nos outros', 'Começa confiando mais em todo mundo.'],
  likeGiven: ['Gosta dos outros', 'Começa gostando mais de todo mundo.'],
  hateGiven: ['Odeia os outros', 'Começa com mais ódio de todo mundo.'],
  envy: ['Inveja', 'Passa a odiar quem é muito querido pelo castelo.'],
  trustReceived: ['Inspira confiança', 'Os outros confiam mais nele(a) desde o início.'],
  likeReceived: ['Desperta simpatia', 'Os outros gostam mais dele(a) (e os invejosos, menos).'],
  hateReceived: ['Desperta ódio', 'Os outros começam com mais raiva dele(a).'],
  loyalty: ['Lealdade', 'Chance de aliança = confiança × lealdade. Protege aliados na mesa e resiste ao recrutamento.'],
  paranoia: ['Desconfiança', 'A confiança nos outros cai a cada dia e o voto segue a suspeita.'],
  aggression: ['Agressividade', 'Vota por ódio, acusa e briga mais.'],
  influence: ['Influência', 'Acusações e defesas dele(a) mudam mais a opinião da mesa.'],
  deception: ['Dissimulação', 'Como traidor(a), levanta menos suspeita. Mais chance de ser escolhido(a) traidor(a).'],
  skill: ['Habilidade', 'Vai melhor nas missões (dinheiro e escudos).'],
  volatility: ['Intensidade', 'Reage com mais força: relacionamentos mudam mais depois de cada acontecimento.'],
  sociability: ['Sociabilidade', 'Fala mais nas conversas (negativo = mais calado).'],
  grudge: ['Rancor', 'O ódio demora a passar, pesa mais no voto e na vingança depois de levar votos.'],
  insight: ['Intuição', 'Percebe os traidores mais rápido, a cada manhã.'],
  unpredictability: ['Imprevisibilidade', 'Soma-se à loucura da temporada: decisões dele(a) fogem do esperado com mais frequência.'],
  conformity: ['Conformismo', 'Vota com a maioria (negativo = do contra, foge de quem todos acusam).'],
};

const info = (key: BehaviorEffectKey): EffectInfo => ({ key, label: EFFECT_TEXT[key][0], description: EFFECT_TEXT[key][1] });

/** Todos os efeitos, agrupados como aparecem no formulário. */
export const EFFECT_GROUPS: EffectGroup[] = [
  {
    title: 'Como sente os outros',
    lead: 'Primeira impressão que o personagem tem de cada pessoa do elenco.',
    effects: (['trustGiven', 'likeGiven', 'hateGiven', 'envy'] as const).map(info),
  },
  {
    title: 'Como os outros o(a) sentem',
    lead: 'O que o personagem desperta no resto do elenco.',
    effects: (['trustReceived', 'likeReceived', 'hateReceived'] as const).map(info),
  },
  {
    title: 'Jeito de jogar',
    lead: 'Atributos de 0 a 100 (começam em 50) que decidem votos, alianças e missões.',
    effects: (
      ['loyalty', 'paranoia', 'aggression', 'influence', 'deception', 'skill', 'volatility', 'sociability', 'grudge', 'insight', 'unpredictability', 'conformity'] as const
    ).map(info),
  },
];

export const EFFECTS: EffectInfo[] = EFFECT_GROUPS.flatMap((g) => g.effects);
export const effectLabel = Object.fromEntries(EFFECTS.map((e) => [e.key, e.label])) as Record<BehaviorEffectKey, string>;

/** "Lealdade +50 · Confia nos outros +10" */
export function summarizeEffects(effects: BehaviorEffects, max = Infinity): string {
  const parts = EFFECTS.filter((e) => effects[e.key]).map((e) => `${e.label} ${effects[e.key]! > 0 ? '+' : ''}${effects[e.key]}`);
  const shown = parts.slice(0, max);
  return shown.join(' · ') + (parts.length > shown.length ? ` · +${parts.length - shown.length}` : '');
}

/** Nomes das tags na ordem dos ids. */
export function behaviorNames(ids: readonly string[], behaviors: readonly Behavior[]): string[] {
  const byId = new Map(behaviors.map((b) => [b.id, b.name]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
