import { Day, Player, PlayerProps, Season, SimulationEventProps, TraitorMeetingProps } from '../../domain/entities';
import { GamePhase, MurderOutcome, PlayerRole, PlayerStatus, RoundTableKind, SimulationEventKind } from '../../domain/enums';
import {
  editionFor,
  actionsFor,
  AllianceBook,
  HumanOffer,
  isCoffinNight,
  isFinalTableRound,
  isTraitor,
  murdersOver,
  REASON_TEXT,
  RelationshipMatrix,
  seerDinnerTonight,
  seerNewsToday,
  SimulationFlags,
  traitorPreference,
} from '../../domain/simulation';
import { activeSim, loadSimulationState } from './simulation';
import { PlayerNeed, PlayerView, TowerIntent } from '../dtos/GameDTOs';
import { Repositories } from '../ports/IUnitOfWork';

/** Momentos em que o jogador humano pode conversar. */
const TALK_PHASES: GamePhase[] = [GamePhase.ARRIVAL, GamePhase.BREAKFAST, GamePhase.MISSION, GamePhase.ROUND_TABLE, GamePhase.ENDGAME_ROUND_TABLE];
/** Momentos em que a conversa vem depois do que acontece (no café, primeiro se descobre quem morreu). */
const TALK_AFTER: GamePhase[] = [GamePhase.BREAKFAST];

/** A fase atual (se houver) está na lista. */
function isAny(phases: readonly GamePhase[], phase: GamePhase | null): boolean {
  return phase !== null && phases.includes(phase);
}

/** Acontecimentos que só os traidores (ou quem está envolvido) veem. */
const SECRET_KINDS: string[] = [SimulationEventKind.SECRET, SimulationEventKind.RECRUITMENT];

/**
 * Quem está olhando a temporada. No modo Jogador, enquanto o usuário está no jogo,
 * ele só vê o que um participante veria: fiel não sabe quem é traidor nem o que acontece na torre.
 * Eliminado(a) ou com a temporada encerrada, vira espectador e vê tudo.
 */
export interface Viewer {
  human: Player | null;
  /** Esconder o que o participante não poderia saber. */
  hide: boolean;
  humanIsTraitor: boolean;
  /** Dia cuja noite ainda não foi revelada (o fiel só descobre a vítima no café da manhã). */
  tonightDayId: string | null;
  /** Banidos na reta final: a mesa não soube o papel (até o fim do jogo). */
  hiddenRoles: string[];
}

export function viewerOf(season: Season, players: readonly Player[], currentDayId: string | null = null): Viewer {
  const human = season.isPlayerMode() ? players.find((p) => p.isHuman) ?? null : null;
  return {
    human,
    hide: !!human && human.isActive() && !season.isFinished(),
    humanIsTraitor: !!human?.isTraitor(),
    tonightDayId: season.currentPhase === GamePhase.TRAITORS_MEETING ? currentDayId : null,
    hiddenRoles: season.isFinished() ? [] : ((season.simState as SimulationFlags).hiddenRoles ?? []),
  };
}

/** Papel escondido: todo mundo parece fiel, menos quem já foi revelado (ou os parceiros, para o traidor). */
export function maskPlayer(p: PlayerProps, viewer: Viewer): PlayerProps {
  // Banido(a) sem revelação: quem assiste sabe o papel, mas a tela avisa que a mesa não soube.
  if (viewer.hiddenRoles.includes(p.id)) {
    const partner = viewer.humanIsTraitor && p.role === PlayerRole.TRAITOR;
    if (!viewer.hide || !viewer.human || p.id === viewer.human.id || partner) return { ...p, roleHidden: true };
    return { ...p, role: PlayerRole.FAITHFUL, isOriginalTraitor: false, roleHidden: true, roleUnknown: true };
  }
  if (!viewer.hide || !viewer.human || p.id === viewer.human.id) return p;
  if (viewer.humanIsTraitor && p.role === PlayerRole.TRAITOR) return p;
  // Morto(a) esta noite: para o fiel, ainda está no castelo até o café da manhã.
  if (!viewer.humanIsTraitor && p.status === PlayerStatus.MURDERED && p.eliminatedDayId === viewer.tonightDayId) {
    return { ...p, status: PlayerStatus.ACTIVE, eliminatedDayId: null, role: PlayerRole.FAITHFUL, isOriginalTraitor: false };
  }
  // Banido revela o papel na mesa; assassinado é sempre fiel.
  if (p.status === PlayerStatus.BANISHED || p.status === PlayerStatus.MURDERED) return p;
  return { ...p, role: PlayerRole.FAITHFUL, isOriginalTraitor: false };
}

/**
 * O que o participante vê da narrativa:
 *  - conversas particulares (cochichos, alianças fechadas num canto) só quando está nelas;
 *    mesa redonda e missão são à vista de todos;
 *  - sendo fiel, da torre só o convite dos traidores dirigido a ele (carta ou ultimato);
 *  - segredos (escudo escondido, poder do Vidente, recrutamento...) só quando ele é o protagonista,
 *    isto é, o primeiro nome da frase; ser citado numa conversa dos traidores não conta.
 */
export function visibleEvents(events: readonly SimulationEventProps[], viewer: Viewer): SimulationEventProps[] {
  if (!viewer.hide || !viewer.human) return [...events];
  const me = viewer.human.id;
  const protagonist = (e: SimulationEventProps) => e.playerIds[0] === me;
  return events.filter((e) => {
    if (e.isPrivate && !e.playerIds.includes(me)) return false;
    if (viewer.humanIsTraitor) return true;
    // Da noite, o fiel vê o convite dirigido a ele e o jantar do Vidente de que participou.
    if (e.phase === GamePhase.TRAITORS_MEETING) return (e.kind === SimulationEventKind.RECRUITMENT && protagonist(e)) || (!!e.isPrivate && e.kind !== SimulationEventKind.SECRET);
    if (SECRET_KINDS.includes(e.kind)) return protagonist(e);
    return true;
  });
}

/**
 * Reunião dos traidores vista por um fiel: a de hoje ainda é segredo; das anteriores só se sabe
 * quem morreu (o alvo salvo pelo escudo nunca é anunciado) e os convites feitos a ele mesmo.
 */
export function visibleMeeting(meeting: TraitorMeetingProps | null, isTonight: boolean, viewer: Viewer): TraitorMeetingProps | null {
  if (!meeting || !viewer.hide || viewer.humanIsTraitor || !viewer.human) return meeting;
  if (isTonight) return null;
  const me = viewer.human.id;
  return {
    ...meeting,
    murder: meeting.murder?.outcome === MurderOutcome.SUCCESS ? meeting.murder : null,
    recruitments: meeting.recruitments.filter((r) => r.targetId === me),
    notes: null,
  };
}

/** Convite dos traidores esperando resposta do jogador (fica guardado na temporada). */
export function pendingOffer(season: Season, dayNumber: number | null): HumanOffer | null {
  const offer = (season.simState as SimulationFlags).pendingOffer;
  return offer && offer.day === dayNumber ? offer : null;
}

/** Situação do jogador humano para a tela: conversas restantes, o que precisa decidir, convites... */
export async function buildPlayerView(repos: Repositories, season: Season, players: readonly Player[], day: Day | null): Promise<PlayerView | null> {
  const viewer = viewerOf(season, players);
  const human = viewer.human;
  if (!human) return null;

  const phase = season.currentPhase;
  const active = players.filter((p) => p.isActive());
  const events = day && phase ? (await repos.simulationEvents.findByDay(day.id)).filter((e) => e.phase === phase).map((e) => e.toJSON()) : [];
  const used = events.filter((e) => e.kind === SimulationEventKind.PLAYER).length;
  const simulated = events.some((e) => e.kind !== SimulationEventKind.PLAYER && e.kind !== SimulationEventKind.REACTION);
  const offer = pendingOffer(season, season.currentDay);
  const playing = human.isActive() && season.isInProgress() && !!day && !!phase;
  const traitors = active.filter((p) => p.isTraitor());
  const faithful = active.filter((p) => !p.isTraitor());

  let finalOpen = false;
  let finalStage: PlayerView['finalStage'] = null;
  if (playing && phase === GamePhase.ENDGAME_ROUND_TABLE) {
    const tables = (await repos.roundTables.findByDay(day.id)).filter((t) => t.kind === RoundTableKind.ENDGAME);
    finalOpen = !tables.at(-1)?.isEndgameUnanimous();
    finalStage = isFinalTableRound(tables.length + 1, active.length) ? 'TABLE' : 'FIRE';
  }

  const towerTalk = playing && phase === GamePhase.TRAITORS_MEETING && human.isTraitor() && traitors.length > 1 && !simulated;
  const talkTime = isAny(TALK_AFTER, phase) ? simulated : !simulated || finalOpen;
  const talkWindow = playing && !offer && ((isAny(TALK_PHASES, phase) && talkTime) || towerTalk);
  const left = Math.max(0, season.interactionLimit - used);

  const flags = season.simState as SimulationFlags;
  const today = season.currentDay ?? 0;
  const tie = flags.pendingRevote?.day === today ? flags.pendingRevote : undefined;
  const night = playing && phase === GamePhase.TRAITORS_MEETING && !simulated;
  const towerNeed = night && human.isTraitor() && faithful.length > 0 && !murdersOver(active.length) && flags.noMurderDay !== today;
  const seerPending = night && flags.seer?.seerId === human.id && seerDinnerTonight(flags, today);
  const coffinNight = towerNeed && isCoffinNight(flags, today, active.length, editionFor(season.missionPool).coffins);
  const missionPending = playing && phase === GamePhase.MISSION && flags.pendingMission?.day === today ? flags.pendingMission : undefined;
  let need: PlayerNeed | null = null;
  if (playing) {
    if (offer) need = 'OFFER';
    else if (missionPending) need = 'MISSION';
    else if (tie) need = 'REVOTE';
    else if (phase === GamePhase.BREAKFAST && !simulated && flags.seer?.seerId === human.id && seerNewsToday(flags, today)) need = 'SEER_ANNOUNCE';
    else if (phase === GamePhase.ROUND_TABLE && !simulated) need = 'VOTE';
    else if (phase === GamePhase.ENDGAME_ROUND_TABLE && finalOpen && flags.pendingFire?.day === today) need = 'FIRE_VOTE';
    else if (phase === GamePhase.ENDGAME_ROUND_TABLE && finalOpen) need = finalStage === 'TABLE' ? 'VOTE' : 'FINAL_TABLE';
    else if (towerNeed) need = 'TOWER';
    else if (seerPending) need = 'SEER';
  }

  const dungeonToday = flags.dungeon?.day === today ? flags.dungeon.playerIds : [];
  const tonight = coffinNight || flags.dungeon?.day === today || (flags.poisonArmedDay === today && flags.poisonDay === undefined);
  const originals = players.filter((p) => p.isOriginalTraitor).length;
  const recruitedLastNight = day ? await hadRecruitment(repos, season, day.number - 1) : false;

  // Alianças do jogador (cada uma um grupo) e quem o(a) chamou neste momento.
  // A cópia de `alliances` não é gravada: aqui só se lê.
  const activeIds = active.map((p) => p.id);
  const matrix = playing ? new RelationshipMatrix(await repos.relationships.findBySeason(season.id)) : null;
  const book = matrix ? new AllianceBook(matrix, { alliances: flags.alliances }, activeIds) : null;
  const alliances = book ? book.of(human.id).map((g) => ({ id: g.id, memberIds: g.memberIds.filter((id) => id !== human.id) })) : [];
  const invites =
    book && matrix && !offer
      ? (flags.human?.invites ?? []).flatMap((i) => {
          if (i.day !== season.currentDay || i.phase !== phase || !activeIds.includes(i.fromId)) return [];
          const group = i.groupId ? book.get(i.groupId) : undefined;
          if (i.groupId ? !group || group.memberIds.includes(human.id) : matrix.isAllied(human.id, i.fromId)) return [];
          return [{ fromId: i.fromId, groupId: i.groupId ?? null, memberIds: group ? group.memberIds : [i.fromId] }];
        })
      : [];

  return {
    tiedIds: tie ? tie.tiedIds.filter((id) => id !== human.id) : [],
    finalStage,
    seerPending,
    seer: seerKnowledge(flags, human.id),
    coffinNight,
    invites,
    alliances,
    allyIds: book ? book.allies(human.id) : [],
    towerIntents: towerTalk || need === 'TOWER' ? await towerIntents(repos, season, human.id, dungeonToday) : [],
    record: { hits: flags.human?.hits ?? 0, misses: flags.human?.misses ?? 0 },
    playerId: human.id,
    name: human.name,
    imageUrl: human.imageUrl,
    role: human.role,
    status: human.status,
    isActive: human.isActive(),
    spectator: !viewer.hide,
    interactionLimit: season.interactionLimit,
    interactionsLeft: left,
    canTalk: talkWindow && left > 0 && !tie && !missionPending,
    towerTalk,
    allowedActions: actionsFor(phase, towerTalk),
    need,
    mission: missionPending
      ? {
          ...missionPending.question,
          preview: visibleEvents(
            missionPending.preview.map((e) => ({ ...e, phase: GamePhase.MISSION }) as SimulationEventProps),
            viewer,
          ).map((e) => ({ kind: e.kind, tone: e.tone, text: e.text, playerIds: e.playerIds })),
        }
      : null,
    pendingOffer: offer ? { ultimatum: offer.ultimatum } : null,
    canRecruit: need === 'TOWER' && !tonight && !recruitedLastNight && (traitors.length < originals || traitors.length === 1) && faithful.length >= 2,
    canUltimatum: need === 'TOWER' && !tonight && !recruitedLastNight && traitors.length === 1 && active.length >= 4,
    fellowTraitorIds: human.isTraitor() ? traitors.filter((p) => p.id !== human.id).map((p) => p.id) : [],
    dungeonIds: human.isTraitor() && flags.dungeon?.day === today ? flags.dungeon.playerIds : [],
  };
}

/** O que o jogador, como Vidente, descobriu no jantar (e se já contou no café). */
function seerKnowledge(flags: SimulationFlags, humanId: string): PlayerView['seer'] {
  const seer = flags.seer;
  if (seer?.seerId !== humanId || !seer.guestId || !seer.guestRole) return null;
  return { guestId: seer.guestId, role: seer.guestRole, announced: !!seer.announced };
}

async function hadRecruitment(repos: Repositories, season: Season, dayNumber: number): Promise<boolean> {
  if (dayNumber < 1) return false;
  const day = await repos.days.findBySeasonAndNumber(season.id, dayNumber);
  const meeting = day ? await repos.traitorMeetings.findByDay(day.id) : null;
  return !!meeting && meeting.recruitments.length > 0;
}

/** Plano de cada parceiro na torre: o combinado com o jogador ou a vítima que ele mesmo escolheria. */
async function towerIntents(repos: Repositories, season: Season, humanId: string, dungeon: string[]): Promise<TowerIntent[]> {
  const state = await loadSimulationState(repos, season.id);
  const active = activeSim(state);
  const traitors = active.filter(isTraitor);
  const plan = (season.simState as SimulationFlags).human?.tower;
  const tonight = plan?.day === (season.currentDay ?? 0) ? plan : undefined;
  const intents: TowerIntent[] = [];
  for (const partner of traitors.filter((t) => t.id !== humanId)) {
    const pledged = tonight?.pledges[partner.id];
    if (pledged && active.some((p) => p.id === pledged)) {
      intents.push({ traitorId: partner.id, targetId: pledged, reason: 'combinou com você', pledged: true });
      continue;
    }
    const pref = traitorPreference(state.matrix, partner, traitors, active, tonight?.spares[partner.id] ?? [], dungeon);
    if (pref) intents.push({ traitorId: partner.id, targetId: pref.targetId, reason: REASON_TEXT[pref.reason], pledged: false });
  }
  return intents;
}
