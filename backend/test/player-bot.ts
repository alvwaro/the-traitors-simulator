import { pool } from '../src/infrastructure/database/connection';
import { SUBJECT_ACTIONS } from '../src/domain/simulation/humanActions';
import { Agent, ok } from './helpers';

export type Player = { id: string; name: string; role: string; status: string };
export type View = {
  playerId: string;
  isActive: boolean;
  spectator: boolean;
  canTalk: boolean;
  towerTalk: boolean;
  interactionsLeft: number;
  allowedActions: string[];
  need: string | null;
  pendingOffer: { ultimatum: boolean } | null;
  canRecruit: boolean;
  canUltimatum: boolean;
  fellowTraitorIds: string[];
  dungeonIds: string[];
  tiedIds: string[];
  coffinNight: boolean;
  seerPending: boolean;
  invites: { fromId: string; groupId: string | null }[];
  mission: { options: { id: string }[] } | null;
};
export type State = { phase: string; day: number; phaseSimulated: boolean; activePlayers: Player[]; season: { status: string }; player: View | null };

export const getState = async (agent: Agent, id: string) => ok<State>(await agent.get(`/api/seasons/${id}/state`));

/** Sorteio simples e reproduzível para as escolhas do "jogador robô". */
export function picker(seed: number) {
  let x = seed;
  return <T>(items: readonly T[]): T => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return items[x % items.length];
  };
}

/** O que o jogador decide quando a tela pede uma escolha. */
export function decisionFor(s: State, me: View, pick: ReturnType<typeof picker>): Record<string, unknown> {
  const others = s.activePlayers.filter((p) => p.id !== me.playerId);
  const faithful = others.filter((p) => !me.fellowTraitorIds.includes(p.id));
  if (me.pendingOffer) {
    const accept = pick([true, false]);
    return { offerResponse: accept ? 'ACCEPT' : 'DECLINE', ...(accept && me.pendingOffer.ultimatum ? { victimId: pick(faithful).id } : {}) };
  }
  switch (me.need) {
    case 'VOTE':
    case 'FIRE_VOTE':
      return { voteTargetId: pick(others).id };
    case 'REVOTE':
      return { voteTargetId: pick(me.tiedIds) };
    case 'FINAL_TABLE':
      return { endgameChoice: pick(['END_GAME', 'BANISH_AGAIN']) };
    case 'SEER':
      return { seerGuestId: pick(others).id };
    case 'SEER_ANNOUNCE':
      return { seerAnnouncement: pick(['TRUTH', 'LIE', 'SECRET']) };
    case 'MISSION':
      return { missionAnswer: pick(me.mission!.options).id };
    case 'TOWER':
      // Traidor(a) e Vidente na mesma noite: a torre também pede o jantar.
      return { ...towerDecision(me, others, faithful, pick), ...(me.seerPending ? { seerGuestId: pick(others).id } : {}) };
    default:
      return {};
  }
}

/** Na torre: assassinar (na masmorra, só os condenados), pregar um caixão ou recrutar. */
function towerDecision(me: View, others: Player[], faithful: Player[], pick: ReturnType<typeof picker>): Record<string, unknown> {
  const pool = me.dungeonIds.length ? faithful.filter((p) => me.dungeonIds.includes(p.id)) : faithful;
  const target = pick(pool.length ? pool : faithful);
  if (me.coffinNight) return { murderTargetId: target.id, coffinIds: [target.id, ...others.filter((p) => p.id !== target.id).slice(0, 2).map((p) => p.id)] };
  if (me.canUltimatum && pick([true, false])) {
    const victim = faithful.find((p) => p.id !== target.id);
    if (victim) return { recruit: { targetId: target.id, ultimatum: true, victimIfAcceptedId: victim.id } };
  }
  if (me.canRecruit && pick([true, false, false])) return { recruit: { targetId: target.id, ultimatum: false } };
  return { murderTargetId: target.id };
}

/** Joga uma temporada inteira no modo Jogador, como um usuário faria pela tela. */
export async function playAsHuman(agent: Agent, id: string, seed: number, options: { forceTraitor?: boolean; onStep?: (s: State) => Promise<void> } = {}) {
  const pick = picker(seed);
  const seenNeeds = new Set<string>();
  let talked = 0;
  for (let step = 0; step < 800; step++) {
    const s = await getState(agent, id);
    await options.onStep?.(s);
    if (s.season.status === 'FINISHED') return { seenNeeds, talked };
    const me = s.player!;
    if (!me.isActive || me.spectator) {
      ok(await agent.post(`/api/seasons/${id}/simulate`).send({ untilEnd: true }));
      continue;
    }
    if (options.forceTraitor && s.phase === 'TRAITOR_SELECTION' && s.phaseSimulated) {
      await pool.query("UPDATE players SET role = 'TRAITOR', is_original_traitor = true WHERE id = $1", [me.playerId]);
      options.forceTraitor = false;
    }
    if (me.invites.length) {
      const invite = me.invites[0];
      ok(await agent.post(`/api/seasons/${id}/invites`).send({ inviterId: invite.fromId, groupId: invite.groupId, accept: pick([true, false]) }));
      continue;
    }
    if (me.pendingOffer || me.need) {
      if (me.need) seenNeeds.add(me.need);
      ok(await agent.post(`/api/seasons/${id}/simulate`).send({ decision: decisionFor(s, me, pick) }));
      continue;
    }
    if (me.canTalk && me.interactionsLeft > 0 && pick([true, true, false])) {
      const others = s.activePlayers.filter((p) => p.id !== me.playerId);
      const action = pick(me.allowedActions);
      const target = pick(me.towerTalk ? others.filter((p) => me.fellowTraitorIds.includes(p.id)) : others);
      const subjects = others.filter((p) => p.id !== target?.id);
      if (target) {
        const subjectId = SUBJECT_ACTIONS.includes(action as never) && subjects.length ? pick(subjects).id : undefined;
        ok(await agent.post(`/api/seasons/${id}/interactions`).send({ targetId: target.id, action, subjectId }));
        talked++;
        continue;
      }
    }
    if (!s.phaseSimulated) ok(await agent.post(`/api/seasons/${id}/simulate`).send({}));
    else ok(await agent.post(`/api/seasons/${id}/advance`));
  }
  throw new Error('a temporada não terminou');
}
