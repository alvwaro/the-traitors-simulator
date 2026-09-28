import type { Behavior, BehaviorEffects } from './models';

// Espelha BEHAVIOR_EFFECT_KEYS do backend (domain/entities/Behavior.ts).
export type BehaviorEffectKey =
  | 'trustGiven'
  | 'likeGiven'
  | 'hateGiven'
  | 'trustReceived'
  | 'likeReceived'
  | 'hateReceived'
  | 'envy'
  | 'loyalty'
  | 'paranoia'
  | 'aggression'
  | 'influence'
  | 'deception'
  | 'skill'
  | 'volatility'
  | 'sociability'
  | 'grudge'
  | 'insight'
  | 'unpredictability'
  | 'conformity';

export const EFFECT_LIMIT = 50;

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

/** Todos os efeitos, agrupados como aparecem no formulário. */
export const EFFECT_GROUPS: EffectGroup[] = [
  {
    title: 'Como sente os outros',
    lead: 'Primeira impressão que o personagem tem de cada pessoa do elenco.',
    effects: [
      { key: 'trustGiven', label: 'Confia nos outros', description: 'Começa confiando mais em todo mundo.' },
      { key: 'likeGiven', label: 'Gosta dos outros', description: 'Começa gostando mais de todo mundo.' },
      { key: 'hateGiven', label: 'Odeia os outros', description: 'Começa com mais ódio de todo mundo.' },
      { key: 'envy', label: 'Inveja', description: 'Passa a odiar quem é muito querido pelo castelo.' },
    ],
  },
  {
    title: 'Como os outros o(a) sentem',
    lead: 'O que o personagem desperta no resto do elenco.',
    effects: [
      { key: 'trustReceived', label: 'Inspira confiança', description: 'Os outros confiam mais nele(a) desde o início.' },
      { key: 'likeReceived', label: 'Desperta simpatia', description: 'Os outros gostam mais dele(a) (e os invejosos, menos).' },
      { key: 'hateReceived', label: 'Desperta ódio', description: 'Os outros começam com mais raiva dele(a).' },
    ],
  },
  {
    title: 'Jeito de jogar',
    lead: 'Atributos de 0 a 100 (começam em 50) que decidem votos, alianças e missões.',
    effects: [
      { key: 'loyalty', label: 'Lealdade', description: 'Chance de aliança = confiança × lealdade. Protege aliados na mesa e resiste ao recrutamento.' },
      { key: 'paranoia', label: 'Desconfiança', description: 'A confiança nos outros cai a cada dia e o voto segue a suspeita.' },
      { key: 'aggression', label: 'Agressividade', description: 'Vota por ódio, acusa e briga mais.' },
      { key: 'influence', label: 'Influência', description: 'Acusações e defesas dele(a) mudam mais a opinião da mesa.' },
      { key: 'deception', label: 'Dissimulação', description: 'Como traidor(a), levanta menos suspeita. Mais chance de ser escolhido(a) traidor(a).' },
      { key: 'skill', label: 'Habilidade', description: 'Vai melhor nas missões (dinheiro e escudos).' },
      { key: 'volatility', label: 'Intensidade', description: 'Reage com mais força: relacionamentos mudam mais depois de cada acontecimento.' },
      { key: 'sociability', label: 'Sociabilidade', description: 'Fala mais nas conversas (negativo = mais calado).' },
      { key: 'grudge', label: 'Rancor', description: 'O ódio demora a passar, pesa mais no voto e na vingança depois de levar votos.' },
      { key: 'insight', label: 'Intuição', description: 'Percebe os traidores mais rápido, a cada manhã.' },
      { key: 'unpredictability', label: 'Imprevisibilidade', description: 'Soma-se à loucura da temporada: decisões dele(a) fogem do esperado com mais frequência.' },
      { key: 'conformity', label: 'Conformismo', description: 'Vota com a maioria (negativo = do contra, foge de quem todos acusam).' },
    ],
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
