// Composition root: único lugar que conhece as implementações concretas.
import { pool } from '../infrastructure/database/connection';
import { PgUnitOfWork } from '../infrastructure/database/PgUnitOfWork';
import { RemoteImageFetcher } from '../infrastructure/http/RemoteImageFetcher';
import { createRepositories } from '../infrastructure/repositories';
import { RandomSessionTokens } from '../infrastructure/security/RandomSessionTokens';
import { ScryptPasswordHasher } from '../infrastructure/security/ScryptPasswordHasher';
import { PhaseFlowPolicy, WinnerPolicy } from '../domain/services';

import { LoginUseCase } from '../application/use-cases/auth/LoginUseCase';
import { RegisterUseCase } from '../application/use-cases/auth/RegisterUseCase';
import { GetSessionUserUseCase, LogoutUseCase } from '../application/use-cases/auth/SessionUseCases';
import { CreateBehaviorUseCase } from '../application/use-cases/behavior/CreateBehaviorUseCase';
import { DeleteBehaviorUseCase } from '../application/use-cases/behavior/DeleteBehaviorUseCase';
import { ListBehaviorsUseCase } from '../application/use-cases/behavior/ListBehaviorsUseCase';
import { UpdateBehaviorUseCase } from '../application/use-cases/behavior/UpdateBehaviorUseCase';
import { GetCastRelationshipsUseCase, UpdateCastRelationshipUseCase } from '../application/use-cases/cast/CastRelationshipsUseCases';
import { CreateCastUseCase } from '../application/use-cases/cast/CreateCastUseCase';
import { DeleteCastUseCase } from '../application/use-cases/cast/DeleteCastUseCase';
import { GetCastRankingUseCase } from '../application/use-cases/cast/GetCastRankingUseCase';
import { GetCastUseCase } from '../application/use-cases/cast/GetCastUseCase';
import { ListCastsUseCase } from '../application/use-cases/cast/ListCastsUseCase';
import { RandomizeCastBehaviorsUseCase } from '../application/use-cases/cast/RandomizeCastBehaviorsUseCase';
import { UpdateCastUseCase } from '../application/use-cases/cast/UpdateCastUseCase';
import { CreateCharacterUseCase } from '../application/use-cases/character/CreateCharacterUseCase';
import { DeleteCharacterUseCase } from '../application/use-cases/character/DeleteCharacterUseCase';
import { GetCharacterUseCase } from '../application/use-cases/character/GetCharacterUseCase';
import { ListCharactersUseCase } from '../application/use-cases/character/ListCharactersUseCase';
import { UpdateCharacterUseCase } from '../application/use-cases/character/UpdateCharacterUseCase';
import { ListEditionsUseCase } from '../application/use-cases/edition/ListEditionsUseCase';
import { AdvancePhaseUseCase } from '../application/use-cases/game/AdvancePhaseUseCase';
import { GetGameStateUseCase } from '../application/use-cases/game/GetGameStateUseCase';
import { GetSeasonHistoryUseCase } from '../application/use-cases/game/GetSeasonHistoryUseCase';
import { GoBackPhaseUseCase } from '../application/use-cases/game/GoBackPhaseUseCase';
import { StartEndgameUseCase } from '../application/use-cases/game/StartEndgameUseCase';
import { StartSeasonUseCase } from '../application/use-cases/game/StartSeasonUseCase';
import { RegisterEndgameRoundTableUseCase } from '../application/use-cases/phases/RegisterEndgameRoundTableUseCase';
import { RegisterMissionUseCase } from '../application/use-cases/phases/RegisterMissionUseCase';
import { RegisterPhaseNotesUseCase } from '../application/use-cases/phases/RegisterPhaseNotesUseCase';
import { RegisterRoundTableUseCase } from '../application/use-cases/phases/RegisterRoundTableUseCase';
import { RegisterTraitorsMeetingUseCase } from '../application/use-cases/phases/RegisterTraitorsMeetingUseCase';
import { SelectTraitorsUseCase } from '../application/use-cases/phases/SelectTraitorsUseCase';
import { CreatePhraseUseCase } from '../application/use-cases/phrase/CreatePhraseUseCase';
import { DeletePhraseUseCase } from '../application/use-cases/phrase/DeletePhraseUseCase';
import { ListPhrasesUseCase } from '../application/use-cases/phrase/ListPhrasesUseCase';
import { UpdatePhraseUseCase } from '../application/use-cases/phrase/UpdatePhraseUseCase';
import { AddPlayerUseCase } from '../application/use-cases/player/AddPlayerUseCase';
import { ListPlayersUseCase } from '../application/use-cases/player/ListPlayersUseCase';
import { RemovePlayerUseCase } from '../application/use-cases/player/RemovePlayerUseCase';
import { UpdatePlayerUseCase } from '../application/use-cases/player/UpdatePlayerUseCase';
import { WithdrawPlayerUseCase } from '../application/use-cases/player/WithdrawPlayerUseCase';
import { CopyPublicationUseCase, ListPublicationsUseCase, UnpublishUseCase } from '../application/use-cases/publication/PublicationUseCases';
import { PublishUseCase } from '../application/use-cases/publication/PublishUseCase';
import { CreateSeasonUseCase } from '../application/use-cases/season/CreateSeasonUseCase';
import { DeleteSeasonUseCase } from '../application/use-cases/season/DeleteSeasonUseCase';
import { GetSeasonUseCase } from '../application/use-cases/season/GetSeasonUseCase';
import { ListSeasonsUseCase } from '../application/use-cases/season/ListSeasonsUseCase';
import { RegisterPrizeAdjustmentUseCase } from '../application/use-cases/season/RegisterPrizeAdjustmentUseCase';
import { SaveSeasonAsCastUseCase } from '../application/use-cases/season/SaveSeasonAsCastUseCase';
import { UpdateSeasonUseCase } from '../application/use-cases/season/UpdateSeasonUseCase';
import { AnswerInviteUseCase } from '../application/use-cases/simulation/AnswerInviteUseCase';
import { GetRelationshipsUseCase } from '../application/use-cases/simulation/GetRelationshipsUseCase';
import { InteractUseCase } from '../application/use-cases/simulation/InteractUseCase';
import { RegenerateRelationshipsUseCase } from '../application/use-cases/simulation/RegenerateRelationshipsUseCase';
import { SimulatePhaseUseCase } from '../application/use-cases/simulation/SimulatePhaseUseCase';
import { UpdateRelationshipUseCase } from '../application/use-cases/simulation/UpdateRelationshipUseCase';

import { authController } from '../presentation/http/controllers/AuthController';
import { behaviorController } from '../presentation/http/controllers/BehaviorController';
import { castController } from '../presentation/http/controllers/CastController';
import { characterController } from '../presentation/http/controllers/CharacterController';
import { editionController } from '../presentation/http/controllers/EditionController';
import { gameController } from '../presentation/http/controllers/GameController';
import { imageProxyController } from '../presentation/http/controllers/ImageProxyController';
import { phaseController } from '../presentation/http/controllers/PhaseController';
import { phraseController } from '../presentation/http/controllers/PhraseController';
import { playerController } from '../presentation/http/controllers/PlayerController';
import { publicationController } from '../presentation/http/controllers/PublicationController';
import { seasonController } from '../presentation/http/controllers/SeasonController';
import { simulationController } from '../presentation/http/controllers/SimulationController';
import { Handlers } from '../presentation/http/endpoint';
import { AccessGuards } from '../presentation/http/middlewares/access';

/** Peças que os testes podem trocar (ex.: um buscador de imagens que aceita o servidor local de teste). */
export interface ContainerOverrides {
  imageFetcher?: RemoteImageFetcher;
}

/** Tudo que a aplicação HTTP precisa: um handler por rota, a política de acesso e a leitura da sessão. */
export interface Container {
  handlers: Handlers;
  guards: AccessGuards;
  getSessionUser: GetSessionUserUseCase;
}

export function buildContainer(overrides: ContainerOverrides = {}): Container {
  const repos = createRepositories(pool);
  const uow = new PgUnitOfWork(pool);
  const phaseFlow = new PhaseFlowPolicy();
  const hasher = new ScryptPasswordHasher();
  const tokens = new RandomSessionTokens();

  // Os casos de uso de registro das fases também são usados pela simulação (mesmas regras do modo manual).
  const recorders = {
    selectTraitors: new SelectTraitorsUseCase(uow),
    mission: new RegisterMissionUseCase(uow),
    roundTable: new RegisterRoundTableUseCase(uow),
    traitorsMeeting: new RegisterTraitorsMeetingUseCase(uow),
    endgameRoundTable: new RegisterEndgameRoundTableUseCase(uow),
    startEndgame: new StartEndgameUseCase(uow),
    advance: new AdvancePhaseUseCase(uow, phaseFlow, new WinnerPolicy()),
  };

  const handlers: Handlers = {
    ...authController({
      register: new RegisterUseCase(uow, hasher, tokens),
      login: new LoginUseCase(uow, hasher, tokens),
      logout: new LogoutUseCase(repos, tokens),
    }),
    ...publicationController({
      list: new ListPublicationsUseCase(repos),
      publish: new PublishUseCase(uow),
      unpublish: new UnpublishUseCase(uow),
      copy: new CopyPublicationUseCase(uow),
    }),
    ...characterController({
      create: new CreateCharacterUseCase(uow),
      list: new ListCharactersUseCase(repos),
      get: new GetCharacterUseCase(repos),
      update: new UpdateCharacterUseCase(uow),
      remove: new DeleteCharacterUseCase(uow),
    }),
    ...castController({
      create: new CreateCastUseCase(uow),
      list: new ListCastsUseCase(repos),
      get: new GetCastUseCase(repos),
      update: new UpdateCastUseCase(uow),
      remove: new DeleteCastUseCase(uow),
      relationships: new GetCastRelationshipsUseCase(repos),
      updateRelationship: new UpdateCastRelationshipUseCase(uow),
      ranking: new GetCastRankingUseCase(repos),
      randomizeBehaviors: new RandomizeCastBehaviorsUseCase(uow),
    }),
    ...phraseController({
      create: new CreatePhraseUseCase(uow),
      list: new ListPhrasesUseCase(repos),
      update: new UpdatePhraseUseCase(uow),
      remove: new DeletePhraseUseCase(uow),
    }),
    ...behaviorController({
      create: new CreateBehaviorUseCase(repos),
      list: new ListBehaviorsUseCase(repos),
      update: new UpdateBehaviorUseCase(uow),
      remove: new DeleteBehaviorUseCase(uow),
    }),
    ...editionController(new ListEditionsUseCase()),
    ...imageProxyController(overrides.imageFetcher ?? new RemoteImageFetcher()),
    ...seasonController({
      create: new CreateSeasonUseCase(uow),
      list: new ListSeasonsUseCase(repos.seasons),
      get: new GetSeasonUseCase(repos),
      update: new UpdateSeasonUseCase(uow),
      remove: new DeleteSeasonUseCase(uow),
      saveAsCast: new SaveSeasonAsCastUseCase(uow),
      prizeAdjustment: new RegisterPrizeAdjustmentUseCase(uow),
    }),
    ...playerController({
      add: new AddPlayerUseCase(uow),
      list: new ListPlayersUseCase(repos),
      update: new UpdatePlayerUseCase(uow),
      remove: new RemovePlayerUseCase(uow),
      withdraw: new WithdrawPlayerUseCase(uow),
    }),
    ...gameController({
      start: new StartSeasonUseCase(uow, phaseFlow),
      state: new GetGameStateUseCase(repos),
      history: new GetSeasonHistoryUseCase(repos),
      advance: recorders.advance,
      back: new GoBackPhaseUseCase(uow),
      endgame: recorders.startEndgame,
    }),
    ...simulationController({
      simulate: new SimulatePhaseUseCase(uow, recorders),
      interact: new InteractUseCase(uow),
      answerInvite: new AnswerInviteUseCase(uow),
      relationships: new GetRelationshipsUseCase(repos),
      updateRelationship: new UpdateRelationshipUseCase(uow),
      regenerate: new RegenerateRelationshipsUseCase(uow),
    }),
    ...phaseController({
      notes: new RegisterPhaseNotesUseCase(uow),
      selectTraitors: recorders.selectTraitors,
      mission: recorders.mission,
      roundTable: recorders.roundTable,
      traitorsMeeting: recorders.traitorsMeeting,
      endgameRoundTable: recorders.endgameRoundTable,
    }),
  };

  return { handlers, guards: new AccessGuards(repos.access), getSessionUser: new GetSessionUserUseCase(repos, tokens) };
}
