import { countVotes, leadersOf, tally } from '@traitors/shared';
import { EndgameChoice } from '../enums';
import { blendWithUniform, surpriseChance, surprises } from './chaos';
import { RelationshipMatrix } from './RelationshipMatrix';
import { chance, clamp, pickOne, Rng, shuffle, softmax, softmaxPick, weightedPick } from './random';
import { isTraitor, SimPlayer } from './traits';

/** Quanto menor, mais os votos seguem a pontuação (e menos o acaso). */
const VOTE_TEMPERATURE = 9;
const MURDER_TEMPERATURE = 8;

export interface SimVote {
  voterId: string;
  targetId: string;
  round: number;
}

/** Suspeita média do resto do castelo sobre cada jogador ("pressão" da mesa). */
export function publicSuspicion(matrix: RelationshipMatrix, players: readonly SimPlayer[]): Map<string, number> {
  const ids = players.map((p) => p.id);
  return new Map(players.map((p) => [p.id, 100 - matrix.toward(p.id, ids).trust]));
}

/**
 * Pontuação do voto de `voter` em `target`.
 *  - Fiel: suspeita (pesa mais para paranoicos) + ódio (agressivos e rancorosos) + pressão da mesa
 *    (conformistas seguem a maioria, rebeldes fogem dela), menos simpatia; aliado recebe proteção
 *    proporcional à lealdade.
 *  - Traidor: vota com a mesa em fiéis que o ameaçam; poupa os outros traidores, a não ser que
 *    um deles já esteja condenado e o traidor seja pouco leal (joga o parceiro "embaixo do ônibus").
 */
export function voteScore(
  matrix: RelationshipMatrix,
  voter: SimPlayer,
  target: SimPlayer,
  pressure: ReadonlyMap<string, number>,
): number {
  const f = matrix.get(voter.id, target.id);
  const t = voter.traits;
  const press = pressure.get(target.id) ?? 50;
  const allyShield = f.allied ? 30 + t.loyalty * 0.5 : 0;
  const herd = t.conformity / 50; // 0 (do contra) a 2 (ovelha)
  const hate = f.hatred * (t.aggression / 150) * (0.6 + t.grudge / 125);

  if (isTraitor(voter)) {
    if (isTraitor(target)) {
      const top = Math.max(...pressure.values());
      const doomed = press >= top - 2;
      return doomed && t.loyalty < 55 ? press + 5 : -80;
    }
    const threat = matrix.suspicion(target.id, voter.id);
    return press * 0.8 + threat * 0.4 + hate * 0.6 - f.liking * 0.1 - allyShield * 0.5;
  }

  const suspicion = 100 - f.trust;
  return suspicion * (0.55 + t.paranoia / 200) + hate - f.liking * 0.2 + press * 0.35 * herd - allyShield;
}

/** Pontos extras no voto de `voterId` em `targetId` (ex.: quem acabou de acusar alguém na mesa tende a votar nele). */
export type VoteBias = (voterId: string, targetId: string) => number;

function castVote(
  rng: Rng,
  matrix: RelationshipMatrix,
  voter: SimPlayer,
  candidates: readonly SimPlayer[],
  pressure: ReadonlyMap<string, number>,
  chaos: number,
  bias?: VoteBias,
): SimPlayer | undefined {
  const options = candidates.filter((c) => c.id !== voter.id);
  if (surprises(rng, chaos, voter)) return pickOne(rng, options);
  return softmaxPick(rng, options, (c) => voteScore(matrix, voter, c, pressure) + (bias?.(voter.id, c.id) ?? 0), VOTE_TEMPERATURE);
}

export interface VoteResult {
  votes: SimVote[];
  banishedId: string;
  /** true quando nem a revotação desempatou e o banido saiu no sorteio. */
  decidedByLot: boolean;
}

/**
 * Votação completa: rodada 1 e, havendo empate, revotação só entre os empatados.
 * `confessorId`: alguém confessou ser traidor(a) e todos votam nele(a).
 * `forced`: votos já decididos (o jogador humano). Na revotação, se o escolhido não
 * estiver entre os empatados, o voto vai para o empatado em quem ele menos confia.
 */
export function runBanishmentVote(
  rng: Rng,
  matrix: RelationshipMatrix,
  players: readonly SimPlayer[],
  chaos = 0,
  confessorId?: string,
  forced?: ReadonlyMap<string, string>,
  bias?: VoteBias,
): VoteResult {
  const votes = firstVoteRound(rng, matrix, players, chaos, confessorId, forced, bias);
  const leaders = tally(votes, 1).leaders;
  if (leaders.length > 1) return revoteRound(rng, matrix, players, votes, leaders, chaos, forced, bias);
  return { votes, banishedId: leaders[0], decidedByLot: false };
}

/** Primeira rodada: todos votam em qualquer um (menos em si). */
export function firstVoteRound(
  rng: Rng,
  matrix: RelationshipMatrix,
  players: readonly SimPlayer[],
  chaos = 0,
  confessorId?: string,
  forced?: ReadonlyMap<string, string>,
  bias?: VoteBias,
): SimVote[] {
  const pressure = publicSuspicion(matrix, players);
  // Voto já decidido (jogador, quem acusou na mesa), confissão (todos votam em quem confessou) ou o voto de cada um.
  const firstVote = (voter: SimPlayer) => {
    if (forced?.has(voter.id)) return players.find((p) => p.id === forced.get(voter.id));
    if (confessorId && voter.id !== confessorId) return players.find((p) => p.id === confessorId);
    return castVote(rng, matrix, voter, players, pressure, chaos, bias);
  };
  const votes: SimVote[] = [];
  for (const voter of players) {
    const target = firstVote(voter);
    if (target) votes.push({ voterId: voter.id, targetId: target.id, round: 1 });
  }
  return votes;
}

/**
 * Revotação só entre os empatados da primeira rodada. `forced`: votos já decididos (o jogador humano);
 * se o escolhido não estiver entre os empatados, o voto vai para o empatado em quem ele menos confia.
 * Persistindo o empate, o banido sai no sorteio.
 */
export function revoteRound(
  rng: Rng,
  matrix: RelationshipMatrix,
  players: readonly SimPlayer[],
  firstRound: readonly SimVote[],
  tiedIds: readonly string[],
  chaos = 0,
  forced?: ReadonlyMap<string, string>,
  bias?: VoteBias,
): VoteResult {
  const pressure = publicSuspicion(matrix, players);
  const votes = [...firstRound];
  const tied = players.filter((p) => tiedIds.includes(p.id));
  for (const voter of players) {
    const wanted = forced?.get(voter.id);
    const options = tied.filter((p) => p.id !== voter.id);
    const target = wanted
      ? options.find((p) => p.id === wanted) ?? [...options].sort((a, b) => matrix.get(voter.id, a.id).trust - matrix.get(voter.id, b.id).trust)[0]
      : castVote(rng, matrix, voter, tied, pressure, chaos, bias);
    if (target) votes.push({ voterId: voter.id, targetId: target.id, round: 2 });
  }
  const leaders = tally(votes, 2).leaders;
  const decidedByLot = leaders.length > 1;
  return { votes, banishedId: decidedByLot ? shuffle(rng, leaders)[0] : leaders[0], decidedByLot };
}

/** Chance (0 a 1) de cada jogador ser banido: repete a primeira rodada várias vezes (Monte Carlo). */
export function banishChances(rng: Rng, matrix: RelationshipMatrix, players: readonly SimPlayer[], chaos = 0, iterations = 300): Map<string, number> {
  const wins = new Map<string, number>(players.map((p) => [p.id, 0]));
  if (players.length < 2) return wins;
  const pressure = publicSuspicion(matrix, players);
  const distributions = players.map((voter) => {
    const options = players.filter((c) => c.id !== voter.id);
    const expected = softmax(options.map((c) => voteScore(matrix, voter, c, pressure)), VOTE_TEMPERATURE);
    return { options, probabilities: blendWithUniform(expected, surpriseChance(chaos, voter)) };
  });

  for (let i = 0; i < iterations; i++) {
    const counts = new Map<string, number>();
    for (const { options, probabilities } of distributions) {
      const target = weightedPick(rng, options.map((o, j) => ({ o, p: probabilities[j] })), (x) => x.p)?.o;
      if (target) counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
    }
    const leaders = leadersOf(counts);
    for (const id of leaders) wins.set(id, (wins.get(id) ?? 0) + 1 / leaders.length);
  }
  for (const [id, n] of wins) wins.set(id, n / iterations);
  return wins;
}

/**
 * Interesse dos traidores em assassinar cada fiel: quem desconfia deles é ameaça,
 * quem é influente ou querido pesa mais, e quem já está na mira da mesa fica vivo para ser banido.
 */
export function murderScores(matrix: RelationshipMatrix, traitors: readonly SimPlayer[], players: readonly SimPlayer[]): Map<string, number> {
  const pressure = publicSuspicion(matrix, players);
  const ids = players.map((p) => p.id);
  const scores = new Map<string, number>();
  for (const target of players.filter((p) => !isTraitor(p))) {
    const fromTraitors = traitors.reduce((sum, k) => {
      const f = matrix.get(k.id, target.id);
      return sum + matrix.suspicion(target.id, k.id) * 0.6 + f.hatred * 0.3 - f.liking * 0.15;
    }, 0) / Math.max(1, traitors.length);
    const popularity = matrix.toward(target.id, ids).liking;
    scores.set(
      target.id,
      fromTraitors + target.traits.influence * 0.2 + target.traits.insight * 0.15 + popularity * 0.15 - (pressure.get(target.id) ?? 50) * 0.45,
    );
  }
  return scores;
}

/** Por que um traidor quer matar alguém (o maior peso na conta dele). */
export type MurderReason = 'THREAT' | 'HATE' | 'INFLUENCE' | 'POPULAR' | 'EASY';

export interface TraitorPreference {
  targetId: string;
  reason: MurderReason;
}

/**
 * A vítima que um traidor defenderia na torre, sem sorteio: a mesma conta da decisão
 * (ameaça aos traidores, ódio, influência, popularidade) do ponto de vista dele.
 * `excluded`: fiéis que ele foi convencido a poupar.
 */
export function traitorPreference(
  matrix: RelationshipMatrix,
  traitor: SimPlayer,
  traitors: readonly SimPlayer[],
  players: readonly SimPlayer[],
  excluded: readonly string[] = [],
  allowedIds: readonly string[] = [],
): TraitorPreference | null {
  const base = murderScores(matrix, traitors, players);
  const ids = players.map((p) => p.id);
  let options = players.filter((p) => !isTraitor(p) && !excluded.includes(p.id));
  if (allowedIds.length) options = options.filter((p) => allowedIds.includes(p.id));
  if (!options.length) return null;
  const score = (f: SimPlayer) => (base.get(f.id) ?? 0) + matrix.get(traitor.id, f.id).hatred * 0.3 * (0.6 + traitor.traits.grudge / 125) - matrix.get(traitor.id, f.id).liking * 0.2;
  const best = [...options].sort((a, b) => score(b) - score(a))[0];
  const parts: [MurderReason, number][] = [
    ['THREAT', traitors.reduce((s, k) => s + matrix.suspicion(best.id, k.id), 0) / Math.max(1, traitors.length) * 0.6],
    ['HATE', matrix.get(traitor.id, best.id).hatred * 0.6],
    ['INFLUENCE', best.traits.influence * 0.4],
    ['POPULAR', matrix.toward(best.id, ids).liking * 0.3],
  ];
  parts.sort((a, b) => b[1] - a[1]);
  const [reason, weight] = parts[0];
  return { targetId: best.id, reason: weight < 20 ? 'EASY' : reason };
}

export function murderChances(matrix: RelationshipMatrix, traitors: readonly SimPlayer[], players: readonly SimPlayer[], chaos = 0): Map<string, number> {
  const scores = murderScores(matrix, traitors, players);
  const ids = [...scores.keys()];
  const probabilities = blendWithUniform(softmax(ids.map((id) => scores.get(id) ?? 0), MURDER_TEMPERATURE), clamp(chaos, 0, 1));
  return new Map(ids.map((id, i) => [id, probabilities[i]]));
}

export interface MurderDecision {
  targetId: string | null;
  proposals: { traitorId: string; targetId: string }[];
}

/**
 * Cada traidor sugere um alvo; vence o mais sugerido (empate: decide o traidor mais influente).
 * `allowedIds`: só estes podem ser escolhidos (ex.: condenados da masmorra).
 */
export function decideMurder(
  rng: Rng,
  matrix: RelationshipMatrix,
  traitors: readonly SimPlayer[],
  players: readonly SimPlayer[],
  chaos = 0,
  allowedIds?: readonly string[],
): MurderDecision {
  let faithful = players.filter((p) => !isTraitor(p));
  if (allowedIds?.length) {
    const allowed = faithful.filter((p) => allowedIds.includes(p.id));
    if (allowed.length) faithful = allowed;
  }
  if (traitors.length === 0 || faithful.length === 0) return { targetId: null, proposals: [] };
  const base = murderScores(matrix, traitors, players);

  const proposals = traitors.map((traitor) => {
    const target = surprises(rng, chaos, traitor)
      ? pickOne(rng, faithful)!
      : softmaxPick(
          rng,
          faithful,
          (f) => (base.get(f.id) ?? 0) + matrix.get(traitor.id, f.id).hatred * 0.3 * (0.6 + traitor.traits.grudge / 125) - matrix.get(traitor.id, f.id).liking * 0.2,
          MURDER_TEMPERATURE,
        )!;
    return { traitorId: traitor.id, targetId: target.id };
  });

  const tied = leadersOf(countVotes(proposals.map((p) => p.targetId)));
  const leader = [...traitors].sort((a, b) => b.traits.influence - a.traits.influence)[0];
  const leaderPick = proposals.find((p) => p.traitorId === leader.id)?.targetId;
  const targetId = tied.length > 1 && leaderPick && tied.includes(leaderPick) ? leaderPick : tied[0];
  return { targetId, proposals };
}

/** Quem os traidores tentam recrutar: alguém de quem gostam, pouco leal e que não esteja na mira da mesa. */
export function recruitmentTarget(matrix: RelationshipMatrix, traitors: readonly SimPlayer[], players: readonly SimPlayer[]): SimPlayer | undefined {
  const pressure = publicSuspicion(matrix, players);
  const score = (p: SimPlayer) =>
    traitors.reduce((sum, k) => sum + matrix.get(k.id, p.id).liking * 0.5 + matrix.get(k.id, p.id).trust * 0.3, 0) / Math.max(1, traitors.length) +
    (100 - p.traits.loyalty) * 0.5 +
    p.traits.deception * 0.3 -
    (pressure.get(p.id) ?? 50) * 0.4;
  return [...players.filter((p) => !isTraitor(p))].sort((a, b) => score(b) - score(a))[0];
}

/** Aceita virar traidor? Fiéis leais resistem; no ultimato, recusar é morrer. */
export function acceptsRecruitment(rng: Rng, player: SimPlayer, ultimatum: boolean, chaos = 0): boolean {
  if (surprises(rng, chaos, player)) return chance(rng, 0.5);
  const t = player.traits;
  const probability = ultimatum
    ? clamp(1 - t.loyalty / 200 + (t.deception - 50) / 400, 0.2, 0.95)
    : clamp(0.2 + (100 - t.loyalty) / 180 + (t.deception - 50) / 300, 0.08, 0.9);
  return chance(rng, probability);
}

/**
 * Mesa final: fiel só encerra quando confia em todos que sobraram (paranoicos exigem mais,
 * intuitivos percebem quem ainda mente); traidor quase sempre quer encerrar.
 * A cada rodada a paciência diminui.
 */
export function endgameChoice(rng: Rng, matrix: RelationshipMatrix, voter: SimPlayer, players: readonly SimPlayer[], round: number, chaos = 0): EndgameChoice {
  const others = players.filter((p) => p.id !== voter.id);
  if (others.length <= 1) return EndgameChoice.END_GAME;
  if (surprises(rng, chaos, voter)) return chance(rng, 0.5) ? EndgameChoice.END_GAME : EndgameChoice.BANISH_AGAIN;
  if (isTraitor(voter)) {
    return chance(rng, 0.72 + voter.traits.deception / 500) ? EndgameChoice.END_GAME : EndgameChoice.BANISH_AGAIN;
  }
  const worst = Math.max(...others.map((o) => matrix.suspicion(voter.id, o.id)));
  const tolerance = 48 - (voter.traits.paranoia - 50) * 0.4 + (round - 1) * 8 + (rng() * 2 - 1) * 8;
  return worst <= tolerance ? EndgameChoice.END_GAME : EndgameChoice.BANISH_AGAIN;
}
