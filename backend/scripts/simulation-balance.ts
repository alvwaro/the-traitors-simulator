/**
 * Roda temporadas inteiras só em memória para medir o equilíbrio da simulação.
 * Uso: npm run sim:balance -- [temporadas] [loucura 0-100] [US_S1|UK_S1|US_S2|UK_S2|US_S3|UK_S3|MIX]
 */
import { BehaviorEffects } from '../src/domain/entities/Behavior';
import { PlayerRole } from '../src/domain/enums';
import { fillMissingRelationships, RelationshipMatrix } from '../src/domain/simulation/RelationshipMatrix';
import { normalizeMissionPool } from '../src/domain/entities/Season';
import { editionFor, missionFor } from '../src/domain/simulation/missions/catalog';
import { SimulationFlags } from '../src/domain/simulation/SimulationEngine';
import { SimulationEngine } from '../src/domain/simulation/SimulationEngine';
import { isTraitor, SimPlayer, traitsOf } from '../src/domain/simulation/traits';
import { gameRng } from '../src/domain/simulation/random';

const TAGS: Record<string, BehaviorEffects> = {
  Fiel: { loyalty: 50, trustGiven: 10, trustReceived: 10 },
  Amado: { likeReceived: 30, trustReceived: 10, hateReceived: -10 },
  Invejoso: { envy: 40, likeGiven: -10, hateGiven: 10, hateReceived: 5 },
  Astuto: { deception: 35, influence: 10, paranoia: 10, trustReceived: -5 },
  Paranoico: { paranoia: 45, trustGiven: -25 },
  Explosivo: { aggression: 40, volatility: 35, hateReceived: 10 },
  Carismatico: { influence: 40, likeReceived: 15, sociability: 20 },
  Ingenuo: { trustGiven: 30, paranoia: -35, deception: -30 },
  Manipulador: { deception: 40, influence: 20, loyalty: -25, trustReceived: -10 },
};
const TAG_NAMES = Object.keys(TAGS);
const CHAOS = Number(process.argv[3] ?? 0) / 100;
const POOL = normalizeMissionPool(process.argv[4] ?? 'US_S3');
const COFFINS = editionFor(POOL).coffins;

function season(size: number): { winner: 'TRAITORS' | 'FAITHFUL'; days: number; traitorsBanished: number; faithfulBanished: number } {
  const players: SimPlayer[] = Array.from({ length: size }, (_, i) => {
    const tags = [TAG_NAMES[Math.floor(gameRng() * TAG_NAMES.length)], ...(gameRng() < 0.4 ? [TAG_NAMES[Math.floor(gameRng() * TAG_NAMES.length)]] : [])];
    return { id: `p${i}`, name: `P${i}`, role: PlayerRole.FAITHFUL, behaviorIds: tags, traits: traitsOf(tags.map((t) => TAGS[t])) };
  });
  const matrix = new RelationshipMatrix();
  fillMissingRelationships(matrix, players, gameRng, CHAOS);
  const flags: SimulationFlags = {};
  let day = 1;
  let active = players.map((p) => p.id);
  const engine = () => new SimulationEngine({ rng: gameRng, matrix, everyone: players, activeIds: active, phrases: [], money: String, chaos: CHAOS, day, flags, coffins: COFFINS });
  const byId = new Map(players.map((p) => [p.id, p]));

  engine().arrival();
  engine().selectTraitors();
  const originals = players.filter(isTraitor).length;
  let missions = 0;
  let recruitments = 0;
  let recruitedLastNight = false;
  const declined: string[] = [];
  let news = {};
  let traitorsBanished = 0;
  let faithfulBanished = 0;

  for (day = 1; day < 40; day++) {
    if (day > 1) {
      const { withdrawnId } = engine().breakfast(news);
      if (withdrawnId) active = active.filter((id) => id !== withdrawnId);
    }
    const outcome = engine().mission(missionFor(missions++, POOL, 'seed'));
    if (day > 1) {
      if (active.length <= 5) {
        for (const round of engine().endgame()) {
          if (round.banishedId) {
            active = active.filter((id) => id !== round.banishedId);
            if (isTraitor(byId.get(round.banishedId)!)) traitorsBanished++;
            else faithfulBanished++;
          }
        }
        const traitorsLeft = active.some((id) => isTraitor(byId.get(id)!));
        return { winner: traitorsLeft ? 'TRAITORS' : 'FAITHFUL', days: day, traitorsBanished, faithfulBanished };
      }
      // Sem jogador humano a mesa nunca espera um desempate.
      const { banishedId } = engine().roundTable()!;
      active = active.filter((id) => id !== banishedId);
      if (isTraitor(byId.get(banishedId)!)) traitorsBanished++;
      else faithfulBanished++;
    }
    const decision = engine().traitorsMeeting({ originalTraitors: originals, recruitmentsSoFar: recruitments, declinedIds: declined, recruitedLastNight });
    recruitedLastNight = !!decision.recruitment;
    news = {};
    if (decision.recruitment) {
      recruitments++;
      if (!decision.recruitment.accepted) declined.push(decision.recruitment.targetId);
      if (!decision.recruitment.accepted && decision.recruitment.isUltimatum) {
        active = active.filter((id) => id !== decision.recruitment!.targetId);
        news = { murderedId: decision.recruitment.targetId };
      }
    }
    if (decision.murderTargetId) {
      if (!decision.plainSight && outcome.shieldIds.includes(decision.murderTargetId)) news = { savedId: decision.murderTargetId };
      else {
        active = active.filter((id) => id !== decision.murderTargetId);
        news = { murderedId: decision.murderTargetId };
      }
    }
  }
  return { winner: 'TRAITORS', days: 40, traitorsBanished, faithfulBanished };
}

const runs = Number(process.argv[2] ?? 200);
let traitorWins = 0;
let days = 0;
let tb = 0;
let fb = 0;
for (let i = 0; i < runs; i++) {
  const r = season(16 + Math.floor(gameRng() * 8));
  if (r.winner === 'TRAITORS') traitorWins++;
  days += r.days;
  tb += r.traitorsBanished;
  fb += r.faithfulBanished;
}
console.log(`traidores venceram ${((traitorWins / runs) * 100).toFixed(0)}% · ${(days / runs).toFixed(1)} dias · banidos por temporada: ${(tb / runs).toFixed(1)} traidores, ${(fb / runs).toFixed(1)} fiéis`);
