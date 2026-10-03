/**
 * Manifesto da API: a lista única das rotas, com quem pode chamar cada uma.
 *  - o backend monta o roteador a partir dele (cada rota precisa de um handler);
 *  - o gateway barra antes do backend o que não pode passar (rota inexistente, método errado,
 *    id malformado, visitante numa rota que exige login, excesso de tentativas).
 * Todo parâmetro de caminho (":algoId") é um UUID.
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** public: qualquer um; user: logado; owner: dono do site. */
export type RouteAccess = 'public' | 'user' | 'owner';

/** Regra de dono do recurso (só o backend confere: depende dos dados). */
export type ResourceGuard = 'seasonRead' | 'seasonWrite' | 'cast' | 'character';

/** Grupo de limite de requisições por IP (além do limite geral do gateway). */
export type RateLimitGroup = 'auth' | 'imageProxy';

export interface RouteSpec {
  readonly method: HttpMethod;
  /** Caminho relativo a /api, no formato do Express (/seasons/:seasonId). */
  readonly path: string;
  readonly access: RouteAccess;
  readonly guard?: ResourceGuard;
  readonly rateLimit?: RateLimitGroup;
}

const route = <const S extends RouteSpec>(spec: S): S => spec;

const SEASON = '/seasons/:seasonId';
const PHASE = `${SEASON}/phase`;
const PLAYER = `${SEASON}/players/:playerId`;
const CAST = '/casts/:castId';
const CHARACTER = '/characters/:characterId';

/**
 * Política de acesso. O site só funciona logado:
 *  - sem sessão: só cadastro, login, logout e "quem sou eu";
 *  - logado: vitrines (publicações), temporadas publicadas (só leitura) e a Minha Área
 *    (temporadas, casts e personagens de quem criou);
 *  - donos do site: alterar comportamentos e frases (valem para todos).
 */
export const API_ROUTES = {
  // Contas
  'auth.register': route({ method: 'POST', path: '/auth/register', access: 'public', rateLimit: 'auth' }),
  'auth.login': route({ method: 'POST', path: '/auth/login', access: 'public', rateLimit: 'auth' }),
  'auth.logout': route({ method: 'POST', path: '/auth/logout', access: 'public' }),
  'auth.me': route({ method: 'GET', path: '/auth/me', access: 'public' }),

  // Áreas públicas: Temporadas Oficiais e Fãs
  'publications.list': route({ method: 'GET', path: '/publications', access: 'user' }),
  'publications.get': route({ method: 'GET', path: '/publications/:publicationId', access: 'user' }),
  'publications.publish': route({ method: 'POST', path: '/publications', access: 'user' }),
  'publications.remove': route({ method: 'DELETE', path: '/publications/:publicationId', access: 'user' }),
  'publications.copy': route({ method: 'POST', path: '/publications/:publicationId/copy', access: 'user' }),
  // Temporada publicada copiada inteira: configurações e elenco, pronta para começar
  'publications.copySeason': route({ method: 'POST', path: '/publications/:publicationId/copy-season', access: 'user' }),

  // Minha Área: personagens e casts
  'characters.create': route({ method: 'POST', path: '/characters', access: 'user' }),
  'characters.list': route({ method: 'GET', path: '/characters', access: 'user' }),
  'characters.get': route({ method: 'GET', path: CHARACTER, access: 'user', guard: 'character' }),
  'characters.update': route({ method: 'PATCH', path: CHARACTER, access: 'user', guard: 'character' }),
  'characters.remove': route({ method: 'DELETE', path: CHARACTER, access: 'user', guard: 'character' }),
  'characters.importWiki': route({ method: 'POST', path: `${CHARACTER}/wiki`, access: 'user', guard: 'character' }),
  // Página do participante: de quem criou o personagem e, nos personagens dos donos do site, de todos
  'characters.participant': route({ method: 'GET', path: '/participants/:characterId', access: 'user' }),

  'casts.create': route({ method: 'POST', path: '/casts', access: 'user' }),
  'casts.list': route({ method: 'GET', path: '/casts', access: 'user' }),
  'casts.get': route({ method: 'GET', path: CAST, access: 'user', guard: 'cast' }),
  'casts.update': route({ method: 'PATCH', path: CAST, access: 'user', guard: 'cast' }),
  'casts.remove': route({ method: 'DELETE', path: CAST, access: 'user', guard: 'cast' }),
  'casts.relationships': route({ method: 'GET', path: `${CAST}/relationships`, access: 'user', guard: 'cast' }),
  'casts.updateRelationship': route({ method: 'PATCH', path: `${CAST}/relationships`, access: 'user', guard: 'cast' }),
  'casts.ranking': route({ method: 'GET', path: `${CAST}/ranking`, access: 'user', guard: 'cast' }),
  'casts.randomizeBehaviors': route({ method: 'POST', path: `${CAST}/randomize-behaviors`, access: 'user', guard: 'cast' }),
  'casts.memberPhoto': route({ method: 'PATCH', path: `${CAST}/members/:characterId/photo`, access: 'user', guard: 'cast' }),

  // Frases e comportamentos: todos leem, só os donos do site alteram
  'phrases.list': route({ method: 'GET', path: '/phrases', access: 'user' }),
  'phrases.create': route({ method: 'POST', path: '/phrases', access: 'owner' }),
  'phrases.update': route({ method: 'PATCH', path: '/phrases/:phraseId', access: 'owner' }),
  'phrases.remove': route({ method: 'DELETE', path: '/phrases/:phraseId', access: 'owner' }),

  'behaviors.list': route({ method: 'GET', path: '/behaviors', access: 'user' }),
  'behaviors.create': route({ method: 'POST', path: '/behaviors', access: 'owner' }),
  'behaviors.update': route({ method: 'PATCH', path: '/behaviors/:behaviorId', access: 'owner' }),
  'behaviors.remove': route({ method: 'DELETE', path: '/behaviors/:behaviorId', access: 'owner' }),

  // Guia das temporadas do programa: missões e reviravoltas de cada versão
  'editions.list': route({ method: 'GET', path: '/editions', access: 'user' }),

  // Imagens externas com a mesma origem (arte do Instagram)
  'imageProxy.get': route({ method: 'GET', path: '/image-proxy', access: 'user', rateLimit: 'imageProxy' }),

  // Temporadas: a lista é a Minha Área; uma temporada publicada pode ser vista por qualquer pessoa logada
  'seasons.create': route({ method: 'POST', path: '/seasons', access: 'user' }),
  'seasons.list': route({ method: 'GET', path: '/seasons', access: 'user' }),
  'seasons.get': route({ method: 'GET', path: SEASON, access: 'user', guard: 'seasonRead' }),
  'seasons.update': route({ method: 'PATCH', path: SEASON, access: 'user', guard: 'seasonWrite' }),
  'seasons.remove': route({ method: 'DELETE', path: SEASON, access: 'user', guard: 'seasonWrite' }),
  'seasons.saveAsCast': route({ method: 'POST', path: `${SEASON}/save-as-cast`, access: 'user', guard: 'seasonWrite' }),
  'seasons.prizeAdjustment': route({ method: 'POST', path: `${SEASON}/prize-adjustments`, access: 'user', guard: 'seasonWrite' }),

  // Jogadores
  'players.add': route({ method: 'POST', path: `${SEASON}/players`, access: 'user', guard: 'seasonWrite' }),
  'players.list': route({ method: 'GET', path: `${SEASON}/players`, access: 'user', guard: 'seasonRead' }),
  'players.update': route({ method: 'PATCH', path: PLAYER, access: 'user', guard: 'seasonWrite' }),
  'players.remove': route({ method: 'DELETE', path: PLAYER, access: 'user', guard: 'seasonWrite' }),
  'players.withdraw': route({ method: 'POST', path: `${PLAYER}/withdraw`, access: 'user', guard: 'seasonWrite' }),

  // Fluxo do jogo
  'game.start': route({ method: 'POST', path: `${SEASON}/start`, access: 'user', guard: 'seasonWrite' }),
  'game.state': route({ method: 'GET', path: `${SEASON}/state`, access: 'user', guard: 'seasonRead' }),
  'game.history': route({ method: 'GET', path: `${SEASON}/history`, access: 'user', guard: 'seasonRead' }),
  'game.advance': route({ method: 'POST', path: `${SEASON}/advance`, access: 'user', guard: 'seasonWrite' }),
  'game.back': route({ method: 'POST', path: `${SEASON}/back`, access: 'user', guard: 'seasonWrite' }),
  'game.endgame': route({ method: 'POST', path: `${SEASON}/endgame`, access: 'user', guard: 'seasonWrite' }),

  // Simulação automática e modo Jogador
  'simulation.simulate': route({ method: 'POST', path: `${SEASON}/simulate`, access: 'user', guard: 'seasonWrite' }),
  'simulation.interact': route({ method: 'POST', path: `${SEASON}/interactions`, access: 'user', guard: 'seasonWrite' }),
  'simulation.answerInvite': route({ method: 'POST', path: `${SEASON}/invites`, access: 'user', guard: 'seasonWrite' }),
  'simulation.relationships': route({ method: 'GET', path: `${SEASON}/relationships`, access: 'user', guard: 'seasonRead' }),
  'simulation.updateRelationship': route({ method: 'PATCH', path: `${SEASON}/relationships`, access: 'user', guard: 'seasonWrite' }),
  'simulation.regenerate': route({ method: 'POST', path: `${SEASON}/relationships/regenerate`, access: 'user', guard: 'seasonWrite' }),

  // Registro das decisões da fase atual
  'phase.notes': route({ method: 'POST', path: `${PHASE}/notes`, access: 'user', guard: 'seasonWrite' }),
  'phase.traitorSelection': route({ method: 'POST', path: `${PHASE}/traitor-selection`, access: 'user', guard: 'seasonWrite' }),
  'phase.mission': route({ method: 'POST', path: `${PHASE}/mission`, access: 'user', guard: 'seasonWrite' }),
  'phase.roundTable': route({ method: 'POST', path: `${PHASE}/round-table`, access: 'user', guard: 'seasonWrite' }),
  'phase.traitorsMeeting': route({ method: 'POST', path: `${PHASE}/traitors-meeting`, access: 'user', guard: 'seasonWrite' }),
  'phase.endgameRoundTable': route({ method: 'POST', path: `${PHASE}/endgame-round-table`, access: 'user', guard: 'seasonWrite' }),
} as const satisfies Record<string, RouteSpec>;

export type RouteId = keyof typeof API_ROUTES;

/** Prefixo comum das rotas da API. */
export const API_PREFIX = '/api';

/** Limites por grupo: tentativas por IP numa janela (login/cadastro seguram adivinhação de senha). */
export const RATE_LIMITS: Readonly<Record<RateLimitGroup, { windowMs: number; max: number }>> = {
  auth: { windowMs: 15 * 60 * 1000, max: 20 },
  imageProxy: { windowMs: 60 * 1000, max: 60 },
};

/** Nome do cookie da sessão (httpOnly): o gateway só confere se ele veio; quem valida é o backend. */
export const SESSION_COOKIE = 'traitors_session';

/** Cabeçalho com o id da requisição, repassado do gateway ao backend (para cruzar os logs). */
export const REQUEST_ID_HEADER = 'x-request-id';
