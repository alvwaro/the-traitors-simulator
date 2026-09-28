// Composition root: único lugar que conhece as implementações concretas.
import { pool } from '../infrastructure/database/connection';
import { PgUnitOfWork } from '../infrastructure/database/PgUnitOfWork';
import { ImageProxyController } from '../presentation/http/controllers/ImageProxyController';
import { RemoteImageFetcher } from '../infrastructure/http/RemoteImageFetcher';
import { createRepositories } from '../infrastructure/repositories';
import { PhaseFlowPolicy, VoteTallyService, WinnerPolicy } from '../domain/services';

import { CreateSeasonUseCase } from '../application/use-cases/season/CreateSeasonUseCase';
import { ListSeasonsUseCase } from '../application/use-cases/season/ListSeasonsUseCase';
import { GetSeasonUseCase } from '../application/use-cases/season/GetSeasonUseCase';
import { UpdateSeasonUseCase } from '../application/use-cases/season/UpdateSeasonUseCase';
import { DeleteSeasonUseCase } from '../application/use-cases/season/DeleteSeasonUseCase';
import { SaveSeasonAsCastUseCase } from '../application/use-cases/season/SaveSeasonAsCastUseCase';
import { RegisterPrizeAdjustmentUseCase } from '../application/use-cases/season/RegisterPrizeAdjustmentUseCase';
import { AddPlayerUseCase } from '../application/use-cases/player/AddPlayerUseCase';
import { ListPlayersUseCase } from '../application/use-cases/player/ListPlayersUseCase';
import { UpdatePlayerUseCase } from '../application/use-cases/player/UpdatePlayerUseCase';
import { RemovePlayerUseCase } from '../application/use-cases/player/RemovePlayerUseCase';
import { WithdrawPlayerUseCase } from '../application/use-cases/player/WithdrawPlayerUseCase';
import { StartSeasonUseCase } from '../application/use-cases/game/StartSeasonUseCase';
import { GetGameStateUseCase } from '../application/use-cases/game/GetGameStateUseCase';
import { AdvancePhaseUseCase } from '../application/use-cases/game/AdvancePhaseUseCase';
import { StartEndgameUseCase } from '../application/use-cases/game/StartEndgameUseCase';
import { GetSeasonHistoryUseCase } from '../application/use-cases/game/GetSeasonHistoryUseCase';
import { RegisterPhaseNotesUseCase } from '../application/use-cases/phases/RegisterPhaseNotesUseCase';
import { SelectTraitorsUseCase } from '../application/use-cases/phases/SelectTraitorsUseCase';
import { RegisterMissionUseCase } from '../application/use-cases/phases/RegisterMissionUseCase';
import { RegisterRoundTableUseCase } from '../application/use-cases/phases/RegisterRoundTableUseCase';
import { RegisterTraitorsMeetingUseCase } from '../application/use-cases/phases/RegisterTraitorsMeetingUseCase';
import { RegisterEndgameRoundTableUseCase } from '../application/use-cases/phases/RegisterEndgameRoundTableUseCase';
import { CreateCharacterUseCase } from '../application/use-cases/character/CreateCharacterUseCase';
import { ListCharactersUseCase } from '../application/use-cases/character/ListCharactersUseCase';
import { GetCharacterUseCase } from '../application/use-cases/character/GetCharacterUseCase';
import { UpdateCharacterUseCase } from '../application/use-cases/character/UpdateCharacterUseCase';
import { DeleteCharacterUseCase } from '../application/use-cases/character/DeleteCharacterUseCase';
import { CreateCastUseCase } from '../application/use-cases/cast/CreateCastUseCase';
import { ListCastsUseCase } from '../application/use-cases/cast/ListCastsUseCase';
import { GetCastUseCase } from '../application/use-cases/cast/GetCastUseCase';
import { UpdateCastUseCase } from '../application/use-cases/cast/UpdateCastUseCase';
import { DeleteCastUseCase } from '../application/use-cases/cast/DeleteCastUseCase';
import { GetCastRelationshipsUseCase, UpdateCastRelationshipUseCase } from '../application/use-cases/cast/CastRelationshipsUseCases';
import { GetCastRankingUseCase } from '../application/use-cases/cast/GetCastRankingUseCase';
import { CreatePhraseUseCase } from '../application/use-cases/phrase/CreatePhraseUseCase';
import { ListPhrasesUseCase } from '../application/use-cases/phrase/ListPhrasesUseCase';
import { UpdatePhraseUseCase } from '../application/use-cases/phrase/UpdatePhraseUseCase';
import { DeletePhraseUseCase } from '../application/use-cases/phrase/DeletePhraseUseCase';
import { CreateBehaviorUseCase } from '../application/use-cases/behavior/CreateBehaviorUseCase';
import { ListBehaviorsUseCase } from '../application/use-cases/behavior/ListBehaviorsUseCase';
import { UpdateBehaviorUseCase } from '../application/use-cases/behavior/UpdateBehaviorUseCase';
import { DeleteBehaviorUseCase } from '../application/use-cases/behavior/DeleteBehaviorUseCase';
import { SimulatePhaseUseCase } from '../application/use-cases/simulation/SimulatePhaseUseCase';
import { GetRelationshipsUseCase } from '../application/use-cases/simulation/GetRelationshipsUseCase';
import { RegenerateRelationshipsUseCase } from '../application/use-cases/simulation/RegenerateRelationshipsUseCase';
import { UpdateRelationshipUseCase } from '../application/use-cases/simulation/UpdateRelationshipUseCase';
import { InteractUseCase } from '../application/use-cases/simulation/InteractUseCase';
import { AnswerInviteUseCase } from '../application/use-cases/simulation/AnswerInviteUseCase';

import { SeasonController } from '../presentation/http/controllers/SeasonController';
import { PlayerController } from '../presentation/http/controllers/PlayerController';
import { GameController } from '../presentation/http/controllers/GameController';
import { PhaseController } from '../presentation/http/controllers/PhaseController';
import { CharacterController } from '../presentation/http/controllers/CharacterController';
import { CastController } from '../presentation/http/controllers/CastController';
import { RandomizeCastBehaviorsUseCase } from '../application/use-cases/cast/RandomizeCastBehaviorsUseCase';
import { PhraseController } from '../presentation/http/controllers/PhraseController';
import { BehaviorController } from '../presentation/http/controllers/BehaviorController';
import { EditionController } from '../presentation/http/controllers/EditionController';
import { ListEditionsUseCase } from '../application/use-cases/edition/ListEditionsUseCase';
import { SimulationController } from '../presentation/http/controllers/SimulationController';
import { AuthController } from '../presentation/http/controllers/AuthController';
import { PublicationController } from '../presentation/http/controllers/PublicationController';
import { RegisterUseCase } from '../application/use-cases/auth/RegisterUseCase';
import { LoginUseCase } from '../application/use-cases/auth/LoginUseCase';
import { GetSessionUserUseCase, LogoutUseCase } from '../application/use-cases/auth/SessionUseCases';
import { PublishUseCase } from '../application/use-cases/publication/PublishUseCase';
import { CopyPublicationUseCase, ListPublicationsUseCase, UnpublishUseCase } from '../application/use-cases/publication/PublicationUseCases';
import { ScryptPasswordHasher } from '../infrastructure/security/ScryptPasswordHasher';
import { RandomSessionTokens } from '../infrastructure/security/RandomSessionTokens';
import { AccessGuards } from '../presentation/http/middlewares/access';
import { Controllers } from '../presentation/http/routes';

/** Tudo que a aplicação HTTP precisa: controllers, política de acesso e leitura da sessão. */
export interface Container {
  controllers: Controllers;
  guards: AccessGuards;
  getSessionUser: GetSessionUserUseCase;
}

export function buildContainer(): Container {
  const repos = createRepositories(pool);
  const uow = new PgUnitOfWork(pool);
  const phaseFlow = new PhaseFlowPolicy();
  const voteTally = new VoteTallyService();
  const winnerPolicy = new WinnerPolicy();
  const hasher = new ScryptPasswordHasher();
  const tokens = new RandomSessionTokens();

  const selectTraitors = new SelectTraitorsUseCase(uow);
  const registerMission = new RegisterMissionUseCase(uow);
  const registerRoundTable = new RegisterRoundTableUseCase(uow, voteTally);
  const registerTraitorsMeeting = new RegisterTraitorsMeetingUseCase(uow);
  const registerEndgameRoundTable = new RegisterEndgameRoundTableUseCase(uow, voteTally);
  const startEndgame = new StartEndgameUseCase(uow);
  const advancePhase = new AdvancePhaseUseCase(uow, phaseFlow, winnerPolicy);

  const controllers: Controllers = {
    auth: new AuthController(new RegisterUseCase(uow, hasher, tokens), new LoginUseCase(uow, hasher, tokens), new LogoutUseCase(repos, tokens)),
    publication: new PublicationController(
      new ListPublicationsUseCase(repos),
      new PublishUseCase(uow),
      new UnpublishUseCase(uow),
      new CopyPublicationUseCase(uow),
    ),
    character: new CharacterController(
      new CreateCharacterUseCase(uow),
      new ListCharactersUseCase(repos),
      new GetCharacterUseCase(repos),
      new UpdateCharacterUseCase(uow),
      new DeleteCharacterUseCase(uow),
    ),
    cast: new CastController(
      new CreateCastUseCase(uow),
      new ListCastsUseCase(repos),
      new GetCastUseCase(repos),
      new UpdateCastUseCase(uow),
      new DeleteCastUseCase(uow),
      new GetCastRelationshipsUseCase(repos),
      new UpdateCastRelationshipUseCase(uow),
      new GetCastRankingUseCase(repos),
      new RandomizeCastBehaviorsUseCase(uow),
    ),
    phrase: new PhraseController(
      new CreatePhraseUseCase(uow),
      new ListPhrasesUseCase(repos),
      new UpdatePhraseUseCase(uow),
      new DeletePhraseUseCase(uow),
    ),
    season: new SeasonController(
      new CreateSeasonUseCase(uow),
      new ListSeasonsUseCase(repos.seasons),
      new GetSeasonUseCase(repos),
      new UpdateSeasonUseCase(uow),
      new DeleteSeasonUseCase(uow),
      new SaveSeasonAsCastUseCase(uow),
      new RegisterPrizeAdjustmentUseCase(uow),
    ),
    player: new PlayerController(
      new AddPlayerUseCase(uow),
      new ListPlayersUseCase(repos),
      new UpdatePlayerUseCase(uow),
      new RemovePlayerUseCase(uow),
      new WithdrawPlayerUseCase(uow),
    ),
    game: new GameController(
      new StartSeasonUseCase(uow, phaseFlow),
      new GetGameStateUseCase(repos),
      advancePhase,
      startEndgame,
      new GetSeasonHistoryUseCase(repos),
    ),
    imageProxy: new ImageProxyController(new RemoteImageFetcher()),
    phase: new PhaseController(
      new RegisterPhaseNotesUseCase(uow),
      selectTraitors,
      registerMission,
      registerRoundTable,
      registerTraitorsMeeting,
      registerEndgameRoundTable,
    ),
    edition: new EditionController(new ListEditionsUseCase()),
    behavior: new BehaviorController(
      new CreateBehaviorUseCase(repos),
      new ListBehaviorsUseCase(repos),
      new UpdateBehaviorUseCase(uow),
      new DeleteBehaviorUseCase(uow),
    ),
    simulation: new SimulationController(
      new SimulatePhaseUseCase(uow, {
        selectTraitors,
        mission: registerMission,
        roundTable: registerRoundTable,
        traitorsMeeting: registerTraitorsMeeting,
        endgameRoundTable: registerEndgameRoundTable,
        startEndgame,
        advance: advancePhase,
      }),
      new GetRelationshipsUseCase(repos),
      new RegenerateRelationshipsUseCase(uow),
      new UpdateRelationshipUseCase(uow),
      new InteractUseCase(uow),
      new AnswerInviteUseCase(uow),
    ),
  };

  return { controllers, guards: new AccessGuards(repos.access), getSessionUser: new GetSessionUserUseCase(repos, tokens) };
}
