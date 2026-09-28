import { Router } from 'express';
import { SeasonController } from '../controllers/SeasonController';
import { PlayerController } from '../controllers/PlayerController';
import { GameController } from '../controllers/GameController';
import { PhaseController } from '../controllers/PhaseController';
import { CharacterController } from '../controllers/CharacterController';
import { CastController } from '../controllers/CastController';
import { PhraseController } from '../controllers/PhraseController';
import { ImageProxyController } from '../controllers/ImageProxyController';
import { BehaviorController } from '../controllers/BehaviorController';
import { SimulationController } from '../controllers/SimulationController';
import { AuthController } from '../controllers/AuthController';
import { PublicationController } from '../controllers/PublicationController';
import { EditionController } from '../controllers/EditionController';
import { AccessGuards } from '../middlewares/access';
import { rateLimit } from '../middlewares/rateLimit';
import { requireSiteOwner, requireUser } from '../middlewares/session';

export interface Controllers {
  auth: AuthController;
  publication: PublicationController;
  season: SeasonController;
  player: PlayerController;
  game: GameController;
  phase: PhaseController;
  character: CharacterController;
  cast: CastController;
  phrase: PhraseController;
  imageProxy: ImageProxyController;
  behavior: BehaviorController;
  simulation: SimulationController;
  edition: EditionController;
}

/** Tentativas de login/cadastro por IP a cada 15 minutos. */
const AUTH_LIMIT = { windowMs: 15 * 60 * 1000, max: 20 };

/**
 * Rotas da API com a política de acesso de cada uma. O site só funciona logado:
 *  - sem sessão: só cadastro, login, logout e "quem sou eu";
 *  - logado: vitrines (publicações), temporadas publicadas (só leitura) e a Minha Área
 *    (temporadas, casts e personagens de quem criou);
 *  - donos do site: alterar comportamentos e frases (valem para todos).
 */
export function buildRouter(c: Controllers, guard: AccessGuards): Router {
  const router = Router();
  const seasonRead = guard.season('read');
  const seasonWrite = guard.season('write');
  const cast = [requireUser, guard.cast()];
  const character = [requireUser, guard.character()];

  // Contas
  const authLimit = rateLimit(AUTH_LIMIT);
  router.post('/auth/register', authLimit, c.auth.register);
  router.post('/auth/login', authLimit, c.auth.login);
  router.post('/auth/logout', c.auth.logout);
  router.get('/auth/me', c.auth.me);

  // Áreas públicas: Castelo (oficial) e Fãs
  router.get('/publications', requireUser, c.publication.list);
  router.post('/publications', requireUser, c.publication.publish);
  router.delete('/publications/:publicationId', requireUser, c.publication.remove);
  router.post('/publications/:publicationId/copy', requireUser, c.publication.copy);

  // Minha Área: personagens e casts
  router.post('/characters', requireUser, c.character.create);
  router.get('/characters', requireUser, c.character.list);
  router.get('/characters/:characterId', ...character, c.character.get);
  router.patch('/characters/:characterId', ...character, c.character.update);
  router.delete('/characters/:characterId', ...character, c.character.remove);

  router.post('/casts', requireUser, c.cast.create);
  router.get('/casts', requireUser, c.cast.list);
  router.get('/casts/:castId', ...cast, c.cast.get);
  router.patch('/casts/:castId', ...cast, c.cast.update);
  router.delete('/casts/:castId', ...cast, c.cast.remove);
  router.get('/casts/:castId/relationships', ...cast, c.cast.relationships);
  router.patch('/casts/:castId/relationships', ...cast, c.cast.updateRelationships);
  router.get('/casts/:castId/ranking', ...cast, c.cast.ranking);
  router.post('/casts/:castId/randomize-behaviors', ...cast, c.cast.randomize);

  // Frases e comportamentos: todos leem, só os donos do site alteram
  router.get('/phrases', requireUser, c.phrase.list);
  router.post('/phrases', requireSiteOwner, c.phrase.create);
  router.patch('/phrases/:phraseId', requireSiteOwner, c.phrase.update);
  router.delete('/phrases/:phraseId', requireSiteOwner, c.phrase.remove);

  router.get('/behaviors', requireUser, c.behavior.list);
  router.post('/behaviors', requireSiteOwner, c.behavior.create);
  router.patch('/behaviors/:behaviorId', requireSiteOwner, c.behavior.update);
  router.delete('/behaviors/:behaviorId', requireSiteOwner, c.behavior.remove);

  // Guia das temporadas do programa: missões e reviravoltas de cada versão
  router.get('/editions', requireUser, c.edition.list);

  // Imagens externas com a mesma origem (arte do Instagram)
  router.get('/image-proxy', requireUser, c.imageProxy.get);

  // Temporadas: a lista é a Minha Área; uma temporada publicada pode ser vista por qualquer pessoa logada
  router.post('/seasons', requireUser, c.season.create);
  router.get('/seasons', requireUser, c.season.list);
  router.get('/seasons/:seasonId', seasonRead, c.season.get);
  router.patch('/seasons/:seasonId', seasonWrite, c.season.update);
  router.delete('/seasons/:seasonId', seasonWrite, c.season.remove);
  router.post('/seasons/:seasonId/save-as-cast', seasonWrite, c.season.saveAsCast);
  router.post('/seasons/:seasonId/prize-adjustments', seasonWrite, c.season.prizeAdjustment);

  // Jogadores
  router.post('/seasons/:seasonId/players', seasonWrite, c.player.add);
  router.get('/seasons/:seasonId/players', seasonRead, c.player.list);
  router.patch('/seasons/:seasonId/players/:playerId', seasonWrite, c.player.update);
  router.delete('/seasons/:seasonId/players/:playerId', seasonWrite, c.player.remove);
  router.post('/seasons/:seasonId/players/:playerId/withdraw', seasonWrite, c.player.withdraw);

  // Fluxo do jogo
  router.post('/seasons/:seasonId/start', seasonWrite, c.game.start);
  router.get('/seasons/:seasonId/state', seasonRead, c.game.state);
  router.get('/seasons/:seasonId/history', seasonRead, c.game.history);
  router.post('/seasons/:seasonId/advance', seasonWrite, c.game.advance);
  router.post('/seasons/:seasonId/back', seasonWrite, c.game.back);
  router.post('/seasons/:seasonId/endgame', seasonWrite, c.game.endgame);

  // Simulação automática
  router.post('/seasons/:seasonId/simulate', seasonWrite, c.simulation.simulate);
  router.post('/seasons/:seasonId/interactions', seasonWrite, c.simulation.interact);
  router.post('/seasons/:seasonId/invites', seasonWrite, c.simulation.answerInvite);
  router.get('/seasons/:seasonId/relationships', seasonRead, c.simulation.relationships);
  router.patch('/seasons/:seasonId/relationships', seasonWrite, c.simulation.update);
  router.post('/seasons/:seasonId/relationships/regenerate', seasonWrite, c.simulation.regenerate);

  // Registro das decisões da fase atual
  router.post('/seasons/:seasonId/phase/notes', seasonWrite, c.phase.notes);
  router.post('/seasons/:seasonId/phase/traitor-selection', seasonWrite, c.phase.traitorSelection);
  router.post('/seasons/:seasonId/phase/mission', seasonWrite, c.phase.mission);
  router.post('/seasons/:seasonId/phase/round-table', seasonWrite, c.phase.roundTable);
  router.post('/seasons/:seasonId/phase/traitors-meeting', seasonWrite, c.phase.traitorsMeeting);
  router.post('/seasons/:seasonId/phase/endgame-round-table', seasonWrite, c.phase.endgameRoundTable);

  return router;
}
