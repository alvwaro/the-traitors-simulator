import type { MissionPool } from './models';
import { GamePhase, type HumanAction, type PhrasePhase, type PhraseTone, type PlayerRole, type PlayerStatus, type SeasonMode, type SeasonStatus } from './enums';

export const phaseLabel: Record<GamePhase, string> = {
  ARRIVAL: 'Chegada ao Castelo',
  TRAITOR_SELECTION: 'Escolha dos Traidores',
  BREAKFAST: 'Café da Manhã',
  MISSION: 'Missão',
  ROUND_TABLE: 'Mesa Redonda',
  TRAITORS_MEETING: 'Conclave dos Traidores',
  ENDGAME_ROUND_TABLE: 'Mesa Final e Fogo da Verdade',
  FINALE: 'Grande Final',
};

export const phaseShortLabel: Record<GamePhase, string> = {
  ARRIVAL: 'Chegada',
  TRAITOR_SELECTION: 'Escolha',
  BREAKFAST: 'Café',
  MISSION: 'Missão',
  ROUND_TABLE: 'Mesa Redonda',
  TRAITORS_MEETING: 'Conclave',
  ENDGAME_ROUND_TABLE: 'Mesa Final',
  FINALE: 'Final',
};

export const roleLabel: Record<PlayerRole, string> = {
  FAITHFUL: 'Fiel',
  TRAITOR: 'Traidor(a)',
};

export const statusLabel: Record<PlayerStatus, string> = {
  ACTIVE: 'No castelo',
  BANISHED: 'Banido(a)',
  MURDERED: 'Assassinado(a)',
  WITHDRAWN: 'Deixou o jogo',
};

export const seasonStatusLabel: Record<SeasonStatus, string> = {
  SETUP: 'Em preparação',
  IN_PROGRESS: 'Em andamento',
  ENDGAME: 'Reta final',
  FINISHED: 'Encerrada',
};



export const phrasePhaseLabel: Record<PhrasePhase, string> = {
  ARRIVAL: 'Chegada',
  BREAKFAST: 'Café da manhã',
  MISSION: 'Missão',
  ROUND_TABLE: 'Mesa redonda',
  TRAITORS_MEETING: 'Torre dos traidores',
  ENDGAME: 'Mesa final',
};

export const phraseToneLabel: Record<PhraseTone, string> = {
  NEUTRAL: 'Neutro',
  FRIENDLY: 'Amizade',
  ALLIANCE: 'Aliança',
  SUSPICION: 'Suspeita',
  ACCUSATION: 'Acusação',
  CONFLICT: 'Conflito',
  DEFENSE: 'Defesa',
  STRATEGY: 'Estratégia',
  EMOTION: 'Emoção',
  HUMOR: 'Humor',
};

/** Quem a simulação coloca no {user1} de cada teor. */
export const phraseToneHint: Record<PhraseTone, string> = {
  NEUTRAL: '{user1} é alguém de quem {user} gosta. Não mexe nos relacionamentos.',
  FRIENDLY: '{user1} é alguém de quem {user} gosta; os dois ficam mais próximos.',
  ALLIANCE: '{user1} é alguém em quem {user} confia; a confiança entre eles cresce.',
  SUSPICION: '{user1} é de quem {user} desconfia; quem ouve passa a desconfiar um pouco também.',
  ACCUSATION: '{user1} é o maior suspeito de {user}; a mesa perde confiança em {user1} e {user1} passa a odiar {user}.',
  CONFLICT: '{user1} é alguém que {user} odeia; o ódio cresce dos dois lados.',
  DEFENSE: '{user1} é alguém em quem {user} confia e que está na mira; {user2} é quem o acusa. A mesa confia mais em {user1}.',
  STRATEGY: 'Torre: {user1} é o fiel na mira dos traidores; {user2} é outro traidor.',
  EMOTION: 'Desabafo de {user}; quem ouve passa a gostar um pouco mais dele(a).',
  HUMOR: 'Piada de {user}; {user1} passa a gostar mais dele(a).',
};

export const missionPoolLabel: Record<MissionPool, string> = {
  US_S1: 'EUA · 1ª temporada',
  UK_S1: 'Reino Unido · 1ª temporada',
  US_S2: 'EUA · 2ª temporada',
  UK_S2: 'Reino Unido · 2ª temporada',
  US_S3: 'EUA · 3ª temporada',
  UK_S3: 'Reino Unido · 3ª temporada',
  US_S4: 'EUA · 4ª temporada',
  MIX: 'Todas, embaralhadas',
};

/** O que a loucura significa, em faixas. */
export function chaosLabel(chaos: number): string {
  if (chaos === 0) return 'Todos seguem o próprio comportamento';
  if (chaos < 25) return 'Uma surpresa aqui e ali';
  if (chaos < 50) return 'Ninguém é totalmente previsível';
  if (chaos < 75) return 'Metade das decisões sai do roteiro';
  if (chaos < 100) return 'Caos quase total';
  return 'Tudo aleatório';
}

export const seasonModeLabel: Record<SeasonMode, string> = {
  MANUAL: 'Manual',
  AUTOMATIC: 'Automática',
  PLAYER: 'Jogador',
};

export const humanActionLabel: Record<HumanAction, { label: string; hint: string }> = {
  ACCUSE: { label: 'Acusar', hint: 'Diz na frente de todos que é traidor(a). A mesa desconfia; ele(a) passa a te odiar, mas quem gosta de coragem admira.' },
  SUSPECT: { label: 'Dizer que desconfia', hint: 'Uma suspeita mais leve. Planta a dúvida sem fazer um inimigo.' },
  DEFEND: { label: 'Defender', hint: 'O castelo confia mais nele(a), e ele(a) em você.' },
  TRUST: { label: 'Dizer que confia', hint: 'Aproxima vocês dois. Ótimo para quem você quer ao seu lado.' },
  PRAISE: { label: 'Elogiar', hint: 'Faz a pessoa gostar mais de você (e quem ouve também). Gentileza demais, porém, levanta suspeita.' },
  JOKE: { label: 'Fazer uma piada', hint: 'Pode aproximar muito, ou cair mal com quem não gosta de você.' },
  INSULT: { label: 'Xingar', hint: 'Ódio na hora. Quem também não gosta dele(a) pode até aplaudir.' },
  ALLIANCE: { label: 'Propor aliança', hint: 'Aliados se protegem na mesa. Ele(a) aceita se confiar em você.' },
  ASK: { label: 'Perguntar em quem desconfia', hint: 'Ele(a) conta um nome, se confiar em você. Traidores mentem.' },
  ASK_ABOUT: { label: 'Perguntar o que acha de alguém', hint: 'A sós: ele(a) diz o que pensa de outra pessoa. Traidores protegem os parceiros.' },
  PERSUADE_GUILTY: {
    label: 'Convencer de que alguém é Traidor(a)',
    hint: 'A sós. Funciona se confiar em você; se falhar e ele(a) gostar da pessoa, pode contar tudo a ela.',
  },
  PERSUADE_INNOCENT: { label: 'Convencer de que alguém é Fiel', hint: 'A sós. Tira a pessoa da lista de suspeitos dele(a), se acreditar em você.' },
  TOWER_ASK: { label: 'Perguntar quem ele(a) quer matar', hint: 'O parceiro conta a vítima que tem em mente e o motivo.' },
  TOWER_KILL: { label: 'Convencer a matar alguém', hint: 'Se ele(a) topar, vota com você nesta noite.' },
  TOWER_SPARE: { label: 'Pedir para poupar alguém', hint: 'Se ele(a) topar, tira essa pessoa da lista nesta noite.' },
  TOWER_RECRUIT: { label: 'Sugerir recrutar alguém', hint: 'O parceiro diz se toparia trazer essa pessoa para os traidores.' },
};

/** As conversas agrupadas pela intenção: cada grupo vira uma coluna na hora de escolher o que dizer. */
export const humanActionGroups: { key: 'good' | 'bad' | 'doubt' | 'plan'; label: string; actions: HumanAction[] }[] = [
  { key: 'good', label: 'Positivas', actions: ['TRUST', 'PRAISE', 'JOKE', 'DEFEND', 'TOWER_SPARE'] },
  { key: 'bad', label: 'Negativas', actions: ['ACCUSE', 'INSULT', 'TOWER_KILL'] },
  { key: 'doubt', label: 'Suspeita', actions: ['SUSPECT', 'PERSUADE_GUILTY', 'PERSUADE_INNOCENT'] },
  { key: 'plan', label: 'Estratégia', actions: ['ALLIANCE', 'ASK', 'ASK_ABOUT', 'TOWER_ASK', 'TOWER_RECRUIT'] },
];
