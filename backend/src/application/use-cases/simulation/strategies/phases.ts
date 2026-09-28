import { Day, Season } from '../../../../domain/entities';
import { EndgameChoice, GamePhase, MurderOutcome, PlayerStatus, RecruitmentOutcome, RoundTableKind, SeasonStatus } from '../../../../domain/enums';
import {
  finaleFor,
  HumanEndgameChoice,
  isFinalTableRound,
  isSeerMissionDay,
  MeetingDecision,
  missionFor,
  murdersOver,
  NightNews,
  RecruitmentContext,
  seerMissionFor,
  SimulationFlags,
} from '../../../../domain/simulation';
import { DomainError } from '../../../../domain/errors/DomainError';
import { Repositories } from '../../../ports/IUnitOfWork';
import { activeSim } from '../../../services/simulation';
import { PhaseContext, PhaseSimulation } from './PhaseSimulation';

/** Chegada: primeiras impressões, conversas de canto e as primeiras alianças. */
export class ArrivalSimulation implements PhaseSimulation {
  readonly phase = GamePhase.ARRIVAL;
  run({ engine }: PhaseContext): Promise<void> {
    engine.arrival();
    return Promise.resolve();
  }
}

/** Meia-noite: o toque no ombro. */
export class TraitorSelectionSimulation implements PhaseSimulation {
  readonly phase = GamePhase.TRAITOR_SELECTION;
  async run({ engine, recorders, repos, season }: PhaseContext): Promise<void> {
    await recorders.selectTraitors.record(repos, { seasonId: season.id, traitorIds: engine.selectTraitors() });
  }
}

/** Café da manhã: a chegada ao salão, a revelação da noite e quem desistiu do jogo. */
export class BreakfastSimulation implements PhaseSimulation {
  readonly phase = GamePhase.BREAKFAST;
  async run({ engine, recorders, repos, season, day, state, decision, mode }: PhaseContext): Promise<void> {
    // Com poucos jogadores, este é o último dia: sem assassinatos, missão final, última mesa e Fogo da Verdade.
    const final = season.status === SeasonStatus.IN_PROGRESS && murdersOver(activeSim(state).length);
    const { withdrawnId } = engine.breakfast(await this.lastNight(repos, season, day), { final, seerAnnouncement: mode.seerAnnouncement(decision) });
    const leaving = withdrawnId ? state.players.find((p) => p.id === withdrawnId) : undefined;
    if (leaving) {
      leaving.eliminate(PlayerStatus.WITHDRAWN, day.id);
      await repos.players.update(leaving);
    }
    if (final && activeSim(state).length >= 2) await recorders.startEndgame.record(repos, { seasonId: season.id });
  }

  /** O que aconteceu na reunião dos traidores de ontem (revelado no café da manhã). */
  private async lastNight(repos: Repositories, season: Season, day: Day): Promise<NightNews> {
    const yesterday = await repos.days.findBySeasonAndNumber(season.id, day.number - 1);
    const meeting = yesterday ? await repos.traitorMeetings.findByDay(yesterday.id) : null;
    if (!meeting) return {};
    const murder = meeting.murder;
    return {
      murderedId: murder?.outcome === MurderOutcome.SUCCESS ? murder.targetId : null,
      savedId: murder?.outcome === MurderOutcome.BLOCKED_BY_SHIELD ? murder.targetId : null,
      recruitedIds: meeting.recruitments.filter((r) => r.outcome === RecruitmentOutcome.ACCEPTED).map((r) => r.targetId),
      declinedIds: meeting.recruitments.filter((r) => r.outcome === RecruitmentOutcome.DECLINED && !r.isUltimatum).map((r) => r.targetId),
    };
  }
}

/** Missão do dia: cada um joga pelas próprias habilidades; o prêmio respeita o teto do pote. */
export class MissionSimulation implements PhaseSimulation {
  readonly phase = GamePhase.MISSION;
  async run({ engine, recorders, repos, season, day, state, flags, decision }: PhaseContext): Promise<void> {
    // O último dia tem a missão final; na 3ª temporada, perto dela, uma missão vale o poder do Vidente.
    const active = activeSim(state).length;
    let def = finaleFor(season.missionPool, season.id);
    if (!season.isEndgame()) {
      const seer = seerMissionFor(season.missionPool);
      def = seer && isSeerMissionDay(flags, day.number, active) ? seer : missionFor(await repos.missions.countBySeason(season.id), season.missionPool, season.id);
    }
    // Modo Jogador: a missão pode parar para perguntar algo; cada resposta faz a missão rodar de novo até a próxima.
    const pending = flags.pendingMission?.day === day.number ? flags.pendingMission : undefined;
    const answers = [...(pending?.answers ?? [])];
    if (pending) {
      const answer = decision.missionAnswer;
      if (!answer || !pending.question.options.some((o) => o.id === answer)) throw new DomainError('Escolha uma das opções da missão');
      answers.push(answer);
    }
    const outcome = engine.mission(def, answers);
    if (outcome.pending) {
      flags.pendingMission = { day: day.number, answers: answers.slice(0, outcome.pending.answered), question: outcome.pending.question, preview: engine.events.map((e) => ({ ...e })) };
      return;
    }
    delete flags.pendingMission;
    const pot = await repos.prizes.getPrizePot(season.id);
    const room = season.maxPrizePot === null ? Infinity : Math.max(0, season.maxPrizePot - pot);
    await recorders.mission.record(repos, {
      seasonId: season.id,
      name: def.name,
      description: def.description,
      prizeAvailable: def.prizeAvailable,
      prizeEarned: Math.min(outcome.prizeEarned, room),
      shieldedPlayerIds: outcome.shieldIds,
    });
  }
}

/** Mesa redonda: debate, votos e o banimento. Empate com o jogador na mesa: a revotação espera o voto dele. */
export class RoundTableSimulation implements PhaseSimulation {
  readonly phase = GamePhase.ROUND_TABLE;
  async run({ engine, recorders, repos, season, day, flags, decision, mode }: PhaseContext): Promise<void> {
    const tie = pendingTie(flags, day, 'ROUND_TABLE');
    const result = engine.roundTable(tie ? mode.revote(decision, tie.tiedIds) : mode.vote(decision));
    if (!result) return;
    await recorders.roundTable.record(repos, { seasonId: season.id, banishedPlayerId: result.banishedId, votes: result.votes });
  }
}

/** Empate desta mesa esperando o voto do jogador na revotação. */
function pendingTie(flags: SimulationFlags, day: Day, table: 'ROUND_TABLE' | 'ENDGAME') {
  const tie = flags.pendingRevote;
  return tie?.day === day.number && tie.table === table ? tie : undefined;
}

/** Mesa final: rodadas de "encerrar ou banir de novo" (com o jogador, uma rodada por vez). */
export class EndgameSimulation implements PhaseSimulation {
  readonly phase = GamePhase.ENDGAME_ROUND_TABLE;

  /**
   * O que o jogador decidiu nesta rodada: na última mesa (ou na revotação), só o voto;
   * no Fogo da Verdade, "encerrar ou banir" e o voto.
   */
  private humanChoice(vote: string | undefined, voteOnly: boolean, fire: () => HumanEndgameChoice | undefined): HumanEndgameChoice | undefined {
    if (!voteOnly) return fire();
    return vote ? { choice: EndgameChoice.BANISH_AGAIN, voteTargetId: vote } : undefined;
  }

  async run({ engine, recorders, repos, season, day, state, flags, decision, mode }: PhaseContext): Promise<void> {
    // Continuando um empate, o jogador só escolhe em quem vota na revotação.
    const tie = pendingTie(flags, day, 'ENDGAME');
    const revote = tie ? mode.revote(decision, tie.tiedIds) : undefined;
    const played = (await repos.roundTables.findByDay(day.id)).filter((t) => t.kind === RoundTableKind.ENDGAME).length;
    // A última mesa redonda é um voto simples; o Fogo da Verdade pede "encerrar ou banir" e o voto.
    const lastTable = !tie && isFinalTableRound(played + 1, activeSim(state).length);
    const vote = lastTable ? mode.vote(decision) : revote;
    const choice = this.humanChoice(vote, !!tie || lastTable, () => mode.finalChoice(decision));
    for (const round of engine.endgame(choice, played + 1)) {
      await recorders.endgameRoundTable.record(repos, {
        seasonId: season.id,
        endgameVotes: round.endgameVotes,
        banishedPlayerId: round.banishedId,
        votes: round.votes,
      });
    }
  }
}

/** Torre: assassinato ou recrutamento. Um convite ao jogador deixa a noite em suspenso até a resposta. */
export class TraitorsMeetingSimulation implements PhaseSimulation {
  readonly phase = GamePhase.TRAITORS_MEETING;
  async run(ctx: PhaseContext): Promise<void> {
    const { engine, recorders, repos, season, day, state, flags, offer, decision, mode } = ctx;
    let meeting: MeetingDecision;
    if (offer) {
      meeting = mode.answerOffer(engine, offer, decision);
      delete flags.pendingOffer;
    } else {
      // O jantar do Vidente acontece antes da torre (a resposta é sempre verdadeira).
      engine.seerDinner(mode.seerGuest(flags, day, decision));
      const originals = state.players.filter((p) => p.isOriginalTraitor).length;
      const towerChoice = await mode.towerChoice(repos, season, day, decision);
      meeting = engine.traitorsMeeting(await this.recruitmentContext(repos, season, day, originals), towerChoice);
    }
    if (meeting.awaitingHuman) {
      // A noite só termina quando o usuário responder ao convite.
      flags.pendingOffer = meeting.awaitingHuman;
    } else if (activeSim(state).some((p) => state.players.find((x) => x.id === p.id)?.isTraitor())) {
      await recorders.traitorsMeeting.record(repos, {
        seasonId: season.id,
        murderTargetId: meeting.murderTargetId,
        recruitment: meeting.recruitment,
        plainSight: meeting.plainSight,
      });
    }
  }

  private async recruitmentContext(repos: Repositories, season: Season, today: Day, originalTraitors: number): Promise<RecruitmentContext> {
    const context: RecruitmentContext = { originalTraitors, recruitmentsSoFar: 0, declinedIds: [], recruitedLastNight: false };
    for (const day of await repos.days.findBySeason(season.id)) {
      const recruitments = (await repos.traitorMeetings.findByDay(day.id))?.recruitments ?? [];
      context.recruitmentsSoFar += recruitments.length;
      context.declinedIds.push(...recruitments.filter((r) => r.outcome === RecruitmentOutcome.DECLINED).map((r) => r.targetId));
      if (day.number === today.number - 1 && recruitments.length > 0) context.recruitedLastNight = true;
    }
    return context;
  }
}

/** Registro das estratégias: uma por momento do dia. */
export const PHASE_SIMULATIONS: ReadonlyMap<GamePhase, PhaseSimulation> = new Map(
  [
    new ArrivalSimulation(),
    new TraitorSelectionSimulation(),
    new BreakfastSimulation(),
    new MissionSimulation(),
    new RoundTableSimulation(),
    new EndgameSimulation(),
    new TraitorsMeetingSimulation(),
  ].map((s) => [s.phase, s]),
);
