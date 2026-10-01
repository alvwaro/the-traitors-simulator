import type { PlayerRole } from '../../../domain/enums';
import type { MissionRecord, Player } from '../../../domain/models';
import type { Conversation } from '../../../domain/phrases';
import { lastRound } from '../../../domain/votes';
import type { VoteDraft } from '../../../services/api/PhaseService';
import type { GameContextValue } from '../context/GameContext';

/** O que a arte do Instagram mostra em cada momento do jogo. */
export type StoryScene =
  | { kind: 'wall'; players: Player[]; headline?: string; tone?: 'bad' | 'good' }
  | { kind: 'conversations'; conversations: Conversation[] }
  | { kind: 'elimination'; player: Player; status: 'BANISHED' | 'MURDERED'; headline: string; role?: PlayerRole; detail?: string }
  /** Banido na mesa redonda: foto, o anúncio num cartão e os votos recebidos numa caixa. */
  | { kind: 'banishment'; player: Player; role?: PlayerRole; votes: number }
  /** `hidden`: quantos escudos escondidos entram como "?" (sem foto e sem nome). */
  | { kind: 'mission'; name: string; prize: number; shielded: Player[]; hidden?: number }
  | { kind: 'winners'; players: Player[]; headline: string }
  | { kind: 'shields'; players: Player[]; hidden?: number }
  /** Conclave na torre: um encapuzado no lugar dos Traidores, sem revelar ninguém. */
  | { kind: 'tower' }
  /** Conclave encerrado sem morte (ninguém escolhido ou alvo salvo pelo escudo): a moldura com uma interrogação. */
  | { kind: 'noMurder'; detail?: string }
  /**
   * Jogadores em volta da mesa; `votes` = votos recebidos por id e `ballots` = quem votou em quem
   * (vira uma seta na arte), sempre da rodada mais recente.
   */
  | { kind: 'roundTable'; players: Player[]; votes: Record<string, number>; ballots: { voterId: string; targetId: string }[] };

/** O que a tela mostra agora e ainda não foi registrado. */
export interface StoryDraft {
  conversations: Conversation[];
  shieldIds: string[];
  hiddenShieldIds: string[];
  votes: VoteDraft[];
}

/** Escudos que a arte mostra: quem aparece com foto e quantos ficam como "?". */
export interface ShieldedFaces {
  players: Player[];
  hidden: number;
}

/**
 * Escudos de um conjunto de missões (mais os escolhidos no formulário, ainda não registrados).
 * Escudo escondido vira "?"; missão com escudo misterioso (simulação) vira um único "?",
 * porque nem a quantidade de escudos é revelada.
 */
function shieldFaces(game: GameContextValue, missions: readonly MissionRecord[], draftIds: readonly string[] = [], draftHidden: readonly string[] = []): ShieldedFaces {
  const shown = new Set<string>();
  const hiddenIds = new Set<string>();
  let mysteryMissions = 0;
  for (const m of missions) {
    if (m.shieldsHidden) {
      if (m.rewards.length > 0) mysteryMissions++;
      continue;
    }
    for (const r of m.rewards) (r.hidden ? hiddenIds : shown).add(r.playerId);
  }
  const draftHiddenSet = new Set(draftHidden);
  for (const id of draftIds) (draftHiddenSet.has(id) ? hiddenIds : shown).add(id);
  // quem já aparece com foto em outra missão não precisa de "?"
  const hidden = [...hiddenIds].filter((id) => !shown.has(id)).length + mysteryMissions;
  return { players: [...shown].flatMap((id) => game.playersById.get(id) ?? []), hidden };
}

/** Escudos do dia: os já registrados nas missões de hoje mais os escolhidos no formulário. */
export function shieldedToday(game: GameContextValue, draftIds: string[], draftHidden: string[] = []): ShieldedFaces {
  return shieldFaces(game, game.today?.missions ?? [], draftIds, draftHidden);
}

export function shieldScene(game: GameContextValue, draftIds: string[], draftHidden: string[] = []): StoryScene {
  return { kind: 'shields', ...shieldedToday(game, draftIds, draftHidden) };
}

function roundTableScene(players: Player[], votes: VoteDraft[]): StoryScene {
  // numa revotação, a arte mostra só a rodada atual
  const round = lastRound(votes);
  const ballots = votes.filter((v) => v.round === round).map(({ voterId, targetId }) => ({ voterId, targetId }));
  const counts: Record<string, number> = {};
  for (const v of ballots) counts[v.targetId] = (counts[v.targetId] ?? 0) + 1;
  return { kind: 'roundTable', players, votes: counts, ballots };
}

/**
 * A votação de hoje já registrada: todos que estavam à mesa, com os votos. Quem saiu banido(a)
 * aparece ainda sentado(a), como no momento da votação. Null se ainda não há votos registrados.
 */
export function recordedVotesScene(game: GameContextValue): StoryScene | null {
  const table = game.today?.roundTables.findLast((t) => t.votes.length > 0);
  if (!table) return null;
  const atTable = new Set([...game.state.activePlayers.map((p) => p.id), ...table.votes.flatMap((v) => [v.voterId, v.targetId])]);
  const players = game.history.players
    .filter((p) => atTable.has(p.id))
    .map((p) => (p.id === table.banishedPlayerId ? { ...p, status: 'ACTIVE' as const, eliminatedDayId: null } : p));
  return roundTableScene(players, table.votes);
}

/** Elenco completo com os mortos e banidos atualizados (serve para qualquer dia). */
export function castScene(game: GameContextValue): StoryScene {
  return { kind: 'wall', players: game.history.players };
}

/**
 * Escolhe a cena da fase atual. Havendo conversas na tela, a arte mostra só as conversas;
 * senão mostra o resultado da fase ou, sem resultado ainda, a parede de retratos.
 */
export function storyScene(game: GameContextValue, draft: StoryDraft): StoryScene {
  const { conversations } = draft;
  const { state, history, today, yesterday, playersById } = game;
  const wall: StoryScene = { kind: 'wall', players: history.players };
  if (conversations.length > 0) return { kind: 'conversations', conversations };

  switch (state.phase) {
    case 'BREAKFAST': {
      const murder = yesterday?.traitorsMeeting?.murder;
      const target = murder && playersById.get(murder.targetId);
      if (!target) return { ...wall, headline: 'Ninguém foi assassinado esta noite', tone: 'good' };
      return murder.outcome === 'SUCCESS'
        ? { ...wall, headline: `${target.name} não apareceu no café da manhã`, tone: 'bad' }
        : { ...wall, headline: `${target.name} foi salvo(a) pelo escudo`, tone: 'good' };
    }

    case 'MISSION': {
      const mission = today?.missions.at(-1);
      if (!mission) return wall;
      const { players, hidden } = shieldFaces(game, today!.missions);
      return {
        kind: 'mission',
        name: mission.name ?? 'Missão',
        prize: today!.missions.reduce((total, m) => total + m.prizeEarned, 0),
        shielded: players,
        hidden,
      };
    }

    case 'ROUND_TABLE':
    case 'ENDGAME_ROUND_TABLE': {
      // votação em andamento: todos em volta da mesa
      if (draft.votes.length > 0) return roundTableScene(state.activePlayers, draft.votes);
      const table = today?.roundTables.findLast((t) => t.banishedPlayerId);
      const banished = table?.banishedPlayerId ? playersById.get(table.banishedPlayerId) : undefined;
      if (!banished) return roundTableScene(state.activePlayers, []);
      return {
        kind: 'banishment',
        player: banished,
        // Reta final: banido(a) sem revelação (a arte não entrega o papel).
        role: banished.roleHidden ? undefined : table!.revealedRole ?? banished.role,
        votes: table!.votes.filter((v) => v.targetId === banished.id).length,
      };
    }

    case 'TRAITORS_MEETING': {
      // Reunião ainda não registrada: o conclave está acontecendo.
      const meeting = today?.traitorsMeeting;
      if (!meeting) return { kind: 'tower' };
      const { murder } = meeting;
      if (murder?.outcome === 'SUCCESS') {
        const victim = playersById.get(murder.targetId);
        if (!victim) return wall;
        return { kind: 'elimination', player: victim, status: 'MURDERED', headline: `${victim.name} foi assassinado(a)`, detail: `Pela ordem dos Traidores, ${victim.name} foi assassinado(a).` };
      }
      // Ninguém morreu. Com escudo, a arte avisa, mas não revela quem era o alvo.
      return murder ? { kind: 'noMurder', detail: 'O alvo dos Traidores estava protegido por um escudo.' } : { kind: 'noMurder' };
    }

    case 'FINALE': {
      const winners = state.winners.flatMap((w) => playersById.get(w.playerId) ?? []);
      if (winners.length === 0) return { kind: 'wall', players: state.activePlayers };
      const traitorsWon = winners.some((p) => p.role === 'TRAITOR');
      return { kind: 'winners', players: winners, headline: traitorsWon ? 'Os Traidores venceram' : 'Os Fiéis venceram' };
    }

    default:
      return wall;
  }
}
