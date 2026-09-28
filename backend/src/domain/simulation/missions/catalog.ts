import { MissionPool } from '../../entities/Season';
import { seededRng, shuffle } from '../random';
import { MissionDefinition } from './MissionContext';
import { UK_SEASON_1_FINALE, UK_SEASON_1_MISSIONS, US_SEASON_1_FINALE, US_SEASON_1_MISSIONS } from './season1';
import { UK_SEASON_2_FINALE, UK_SEASON_2_MISSIONS, US_SEASON_2_FINALE, US_SEASON_2_MISSIONS } from './season2';
import { UK_SEASON_3_FINALE, UK_SEASON_3_MISSIONS, UK_SEASON_3_SEER, US_SEASON_3_FINALE, US_SEASON_3_MISSIONS, US_SEASON_3_SEER } from './season3';

/** Uma reviravolta ou acontecimento do jogo, como aparece no guia das temporadas. */
export interface GameEvent {
  name: string;
  description: string;
}

/**
 * Uma temporada do programa (país + número): as missões na ordem da exibição, a missão final,
 * a do Vidente (se houve) e as reviravoltas que só aconteceram nela.
 */
export interface Edition {
  pool: MissionPool;
  country: 'US' | 'UK' | 'MIX';
  season: number | null;
  label: string;
  summary: string;
  missions: readonly MissionDefinition[];
  /** Missão do último dia, com a reta final já começada. */
  finale: readonly MissionDefinition[];
  /** Missão do Vidente, perto da final (só na 3ª temporada). */
  seer?: MissionDefinition;
  /** A noite dos caixões (assassinato à vista de todos) acontece nesta temporada. */
  coffins: boolean;
  twists: readonly GameEvent[];
}

const POISON: GameEvent = {
  name: 'A Taça Envenenada',
  description: 'Depois da missão no cemitério, os Traidores assassinam à vista de todos: servem a taça a alguém no jantar e a vítima só cai no café seguinte. Escudo nenhum protege contra o veneno.',
};
const COFFINS: GameEvent = {
  name: 'A Noite dos Caixões',
  description: 'Uma vez por temporada, com o castelo ainda cheio, os Traidores escrevem três nomes para os caixões. Os três passam a noite ali e, de manhã, um deles tem o caixão pregado. Escudo não protege.',
};
const SEER: GameEvent = {
  name: 'O Poder do Vidente',
  description: 'Perto da final, uma missão de ouro individual dá a quem juntar mais o poder do Vidente: jantar a sós com alguém e descobrir se é Traidor(a) ou Fiel. No café, o Vidente conta a verdade, mente ou guarda segredo.',
};
const LONGBOAT: GameEvent = {
  name: 'Os Acorrentados do Lago',
  description: 'Na missão do barco viking, quem fica acorrentado nos pontões é o único que pode ser assassinado naquela noite. Quanto menos pontões o barco visita, menos gente divide o risco, e quem ficou para trás guarda rancor.',
};
const DUNGEON: GameEvent = {
  name: 'A Masmorra',
  description: 'O grupo condena quatro jogadores à masmorra. A equipe vencedora da missão liberta um deles, e os Traidores só podem assassinar um dos que sobraram.',
};
const MONUMENT: GameEvent = {
  name: 'O Monumento dos Traidores',
  description: 'Se as charadas abrirem o monumento, a torre fica fechada: não há assassinato naquela noite.',
};
const STATUE: GameEvent = {
  name: 'A Estátua dos Traidores',
  description: 'Na missão da pólvora britânica, 500 kg de pólvora explodem a estátua dos Traidores e impedem o assassinato daquela noite.',
};
const ARMOURY: GameEvent = {
  name: 'O Arsenal',
  description: 'Em várias missões, a equipe mais rápida entra no arsenal, onde um escudo espera por alguém.',
};

const US_S1: Edition = {
  pool: 'US_S1',
  country: 'US',
  season: 1,
  label: 'EUA · 1ª temporada (2023)',
  summary: 'A primeira versão americana, com valores em dólar. Poucos escudos (quase todos no arsenal) e o Lago Glass como missão final.',
  missions: US_SEASON_1_MISSIONS,
  finale: [US_SEASON_1_FINALE],
  coffins: false,
  twists: [],
};

const UK_S1: Edition = {
  pool: 'UK_S1',
  country: 'UK',
  season: 1,
  label: 'Reino Unido · 1ª temporada (2022)',
  summary: 'A temporada original, com valores em libra. As ovelhas, a estrada da verdade e a ponte vendada só existiram aqui; o arsenal distribui escudos em várias missões.',
  missions: UK_SEASON_1_MISSIONS,
  finale: [UK_SEASON_1_FINALE],
  coffins: false,
  twists: [ARMOURY],
};

const US_S2: Edition = {
  pool: 'US_S2',
  country: 'US',
  season: 2,
  label: 'EUA · 2ª temporada (2024)',
  summary: 'Valores em dólar, escudos escondidos em quase toda missão e a taça envenenada depois do cemitério.',
  missions: US_SEASON_2_MISSIONS,
  finale: [US_SEASON_2_FINALE],
  coffins: false,
  twists: [POISON],
};

const UK_S2: Edition = {
  pool: 'UK_S2',
  country: 'UK',
  season: 2,
  label: 'Reino Unido · 2ª temporada (2024)',
  summary: 'Valores em libra. Além da taça envenenada, a masmorra limita o assassinato a quatro condenados e o monumento fecha a torre por uma noite.',
  missions: UK_SEASON_2_MISSIONS,
  finale: [UK_SEASON_2_FINALE],
  coffins: false,
  twists: [DUNGEON, POISON, MONUMENT],
};

const US_S3: Edition = {
  pool: 'US_S3',
  country: 'US',
  season: 3,
  label: 'EUA · 3ª temporada (2025)',
  summary: 'Valores em dólar. Abre com o barco viking, tem a noite dos caixões e o poder do Vidente antes do Dia do Juízo Final.',
  missions: US_SEASON_3_MISSIONS,
  finale: [US_SEASON_3_FINALE],
  seer: US_SEASON_3_SEER,
  coffins: true,
  twists: [LONGBOAT, COFFINS, SEER],
};

const UK_S3: Edition = {
  pool: 'UK_S3',
  country: 'UK',
  season: 3,
  label: 'Reino Unido · 3ª temporada (2025)',
  summary: 'Valores em libra. Começa no trem, a pólvora pode salvar uma noite, e a cerimônia da verdade e os desaparecidos só existiram aqui. Também tem o Vidente.',
  missions: UK_SEASON_3_MISSIONS,
  finale: [UK_SEASON_3_FINALE],
  seer: UK_SEASON_3_SEER,
  coffins: false,
  twists: [STATUE, LONGBOAT, SEER],
};

const REAL: readonly Edition[] = [US_S1, UK_S1, US_S2, UK_S2, US_S3, UK_S3];

/** Sem repetir a mesma prova: fica a primeira versão que aparece (a americana, quando as duas existem). */
function distinct(missions: readonly MissionDefinition[]): MissionDefinition[] {
  const byKey = new Map<string, MissionDefinition>();
  for (const m of missions) if (!byKey.has(m.key)) byKey.set(m.key, m);
  return [...byKey.values()];
}

const ALL_MISSIONS = distinct(REAL.flatMap((e) => e.missions));

const MIX: Edition = {
  pool: 'MIX',
  country: 'MIX',
  season: null,
  label: 'Todas, embaralhadas',
  summary: 'As provas de todas as temporadas, dos dois países, numa ordem sorteada (a mesma a cada simulação). Todas as reviravoltas podem acontecer.',
  missions: ALL_MISSIONS,
  finale: distinct(REAL.flatMap((e) => e.finale)),
  seer: US_SEASON_3_SEER,
  coffins: true,
  twists: [LONGBOAT, COFFINS, SEER, DUNGEON, POISON, MONUMENT, STATUE, ARMOURY],
};

export const EDITIONS: readonly Edition[] = [...REAL, MIX];

/** O que acontece em qualquer temporada simulada, seja qual for a escolhida. */
export const COMMON_EVENTS: readonly GameEvent[] = [
  { name: 'A Chegada', description: 'Primeiras impressões, conversas de canto e as primeiras alianças antes de o jogo começar.' },
  { name: 'O Toque no Ombro', description: 'À meia-noite, os Traidores são escolhidos em segredo. Só o público sabe quem são.' },
  { name: 'O Café da Manhã', description: 'Quem entra pela porta sobreviveu à noite; quem não entra foi assassinado(a). Um escudo pode ter salvado alguém.' },
  { name: 'A Missão', description: 'Uma prova por dia para encher o prêmio e, às vezes, ganhar escudos. Cada missão tem imprevistos e relógio: pode render tudo ou nada.' },
  { name: 'A Tentação', description: 'Uma vez por temporada, no fim de uma missão, alguém recebe a oferta de um escudo só seu em troca de um quarto do dinheiro do grupo.' },
  { name: 'A Mesa Redonda', description: 'Debate, acusações e votos. O mais votado é banido(a) e revela o papel; empate leva a uma revotação.' },
  { name: 'A Torre', description: 'Os Traidores escolhem quem assassinar. Com poucos Traidores, podem recrutar um Fiel ou dar um ultimato: juntar-se a eles ou morrer.' },
  { name: 'Segredos e Confissões', description: 'Duplas que se conheciam antes do jogo podem ser descobertas, e um Traidor sob pressão pode confessar na mesa.' },
  { name: 'Desistências', description: 'Raramente, alguém deixa o castelo por motivos pessoais. Pode ser desligado nas configurações da temporada.' },
  { name: 'A Reta Final', description: 'Com cinco jogadores ou menos, os assassinatos acabam: missão final, última mesa redonda e o Fogo da Verdade (encerrar o jogo ou banir de novo). Os banidos da reta final saem sem revelar o papel.' },
];

/** Temporadas criadas antes da separação EUA/Reino Unido guardavam só o número. */
const LEGACY: Record<string, MissionPool> = { S1: 'US_S1', S2: 'US_S2', S3: 'US_S3' };

export function editionFor(pool: MissionPool | string): Edition {
  const key = LEGACY[pool] ?? pool;
  return EDITIONS.find((e) => e.pool === key) ?? US_S3;
}

/**
 * Sequência de missões da temporada. Nas temporadas do programa, a ordem é a da exibição;
 * MIX embaralha com a semente da temporada (a ordem não muda entre simulações).
 */
export function missionSequence(pool: MissionPool, seed: string): readonly MissionDefinition[] {
  const edition = editionFor(pool);
  return edition.pool === 'MIX' ? shuffle(seededRng(seed), edition.missions) : edition.missions;
}

/** Missão de número `index` (0 = primeira da temporada); depois da última, recomeça como "revanche". */
export function missionFor(index: number, pool: MissionPool = 'US_S3', seed = ''): MissionDefinition {
  const sequence = missionSequence(pool, seed);
  const def = sequence[index % sequence.length];
  const lap = Math.floor(index / sequence.length);
  if (lap === 0) return def;
  const round = lap > 1 ? ` ${lap}` : '';
  return { ...def, name: `${def.name} (revanche${round})` };
}

/** Missão do último dia (em MIX, sorteada com a semente da temporada). */
export function finaleFor(pool: MissionPool = 'US_S3', seed = ''): MissionDefinition {
  const { finale } = editionFor(pool);
  return finale.length === 1 ? finale[0] : shuffle(seededRng(`${seed}:final`), finale)[0];
}

/** Missão do Vidente da temporada, se ela teve uma. */
export function seerMissionFor(pool: MissionPool = 'US_S3'): MissionDefinition | undefined {
  return editionFor(pool).seer;
}
