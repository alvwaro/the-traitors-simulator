import { describe, expect, it } from 'vitest';
import { GamePhase, PlayerRole } from '../../src/domain/enums';
import { AllianceBook } from '../../src/domain/simulation/alliances';
import { answerInvite, expireInvites, HUMAN_ACTIONS, HumanAction, HumanMemory, performHumanAction, SUBJECT_ACTIONS, TOWER_ACTIONS, actionsFor } from '../../src/domain/simulation/humanActions';
import { EDITIONS, editionFor, finaleFor, missionFor, missionSequence, seerMissionFor } from '../../src/domain/simulation/missions/catalog';
import { MissionDefinition } from '../../src/domain/simulation/missions/MissionContext';
import { fillMissingRelationships, RelationshipMatrix } from '../../src/domain/simulation/RelationshipMatrix';
import { seededRng } from '../../src/domain/simulation/random';
import { SimulationEngine, SimulationFlags } from '../../src/domain/simulation/SimulationEngine';
import { SimPlayer, traitsOf } from '../../src/domain/simulation/traits';

/** Elenco de teste: os primeiros `traitors` são Traidores; traços variados por posição. */
function cast(size: number, traitors = 2): SimPlayer[] {
  const tags = [{ loyalty: 40 }, { aggression: 40, volatility: 35 }, { influence: 40, sociability: 20 }, { paranoia: 45 }, { deception: 40 }, {}];
  return Array.from({ length: size }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    role: i < traitors ? PlayerRole.TRAITOR : PlayerRole.FAITHFUL,
    behaviorIds: [],
    traits: traitsOf([tags[i % tags.length]]),
  }));
}

function matrixFor(players: SimPlayer[], seed: string, chaos = 0): RelationshipMatrix {
  const matrix = new RelationshipMatrix();
  fillMissingRelationships(matrix, players, seededRng(seed), chaos);
  return matrix;
}

describe('missões de todas as temporadas', () => {
  const all: [string, MissionDefinition][] = EDITIONS.flatMap((e) => [...e.missions, ...e.finale, ...(e.seer ? [e.seer] : [])].map((m) => [e.pool, m] as [string, MissionDefinition]));

  it.each(all.map(([pool, m], i) => [`${pool} · ${m.name}`, m, i] as const))('%s: joga com e sem o jogador e respeita o prêmio', (_, def, i) => {
    for (let run = 0; run < 6; run++) {
      const size = [6, 9, 13, 18, 21, 7][run];
      const players = cast(size, 2 + (run % 2));
      const humanId = run % 2 ? players[run % size].id : undefined;
      const answers: string[] = [];
      const pick = seededRng(`answers${i}:${run}`);
      for (let step = 0; step < 80; step++) {
        const flags: SimulationFlags = {};
        const engine = new SimulationEngine({
          rng: seededRng(`${def.key}:${i}:${run}`),
          matrix: matrixFor(players, `m${run}`, run / 6),
          everyone: players,
          activeIds: players.map((p) => p.id),
          phrases: [],
          money: (n) => `$${n}`,
          day: 3,
          chaos: [0, 0.3, 0.7, 1][run % 4],
          flags,
          humanId,
        });
        const out = engine.mission(def, answers);
        if (out.pending) {
          answers.splice(out.pending.answered);
          const q = out.pending.question;
          expect(q.options.length).toBeGreaterThan(0);
          answers.push(q.options[Math.floor(pick() * q.options.length)].id);
          continue;
        }
        expect(out.prizeEarned).toBeGreaterThanOrEqual(0);
        expect(out.prizeEarned).toBeLessThanOrEqual(def.prizeAvailable);
        expect(engine.events.length).toBeGreaterThan(1);
        break;
      }
    }
  });

  it('monta a sequência, a final e o Vidente de cada temporada', () => {
    for (const edition of EDITIONS) {
      expect(missionSequence(edition.pool, 'x').length).toBe(edition.missions.length);
      expect(finaleFor(edition.pool, 'x')).toBeTruthy();
      expect(!!seerMissionFor(edition.pool)).toBe(edition.season === 3 || edition.pool === 'MIX');
    }
    const lap = editionFor('US_S1').missions.length;
    expect(missionFor(lap, 'US_S1').name).toContain('revanche');
    expect(missionFor(lap * 2, 'US_S1').name).toContain('revanche 2');
    expect(editionFor('S2').pool).toBe('US_S2');
    expect(editionFor('qualquer').pool).toBe('US_S3');
  });
});

describe('escudo misterioso', () => {
  const effigies = editionFor('US_S4').missions.find((m) => m.key === 'effigies')!;

  function run(hiddenShields: number) {
    const players = cast(14, 3);
    const engine = new SimulationEngine({
      rng: seededRng('escudos'),
      matrix: matrixFor(players, 'escudos'),
      everyone: players,
      activeIds: players.map((p) => p.id),
      phrases: [],
      money: (n) => `$${n}`,
      day: 3,
      hiddenShields,
    });
    return { out: engine.mission(effigies), events: engine.events };
  }

  it('com 100%, a missão dá os escudos mas não mostra de quem são', () => {
    const { out, events } = run(1);
    expect(out.shieldIds.length).toBeGreaterThan(0);
    expect(out.shieldsHidden).toBe(true);
    const shields = events.filter((e) => e.kind === 'SHIELD');
    expect(shields.length).toBeGreaterThan(0);
    expect(shields.every((e) => e.playerIds.length === 0 && e.text.includes('?'))).toBe(true);
  });

  it('com 0%, os escudos aparecem como sempre', () => {
    const { out, events } = run(0);
    expect(out.shieldsHidden).toBe(false);
    expect(events.some((e) => e.kind === 'SHIELD' && e.playerIds.length > 0)).toBe(true);
  });
});

describe('ações do jogador', () => {
  const PHASES = [GamePhase.ARRIVAL, GamePhase.BREAKFAST, GamePhase.MISSION, GamePhase.ROUND_TABLE, GamePhase.ENDGAME_ROUND_TABLE, GamePhase.TRAITORS_MEETING];

  it('cada ação produz fala, reação e mexe nos relacionamentos, em todas as situações', () => {
    let events = 0;
    for (const humanIsTraitor of [false, true]) {
      for (const [pi, phase] of PHASES.entries()) {
        for (const [ai, action] of HUMAN_ACTIONS.entries()) {
          for (let variant = 0; variant < 3; variant++) {
            const players = cast(10, 3);
            const human = humanIsTraitor ? players[0] : players[5];
            const matrix = matrixFor(players, `h${pi}${ai}${variant}`, variant / 3);
            const tower = TOWER_ACTIONS.includes(action as HumanAction);
            const present = tower ? players.filter((p) => p.role === PlayerRole.TRAITOR) : players;
            const target = tower ? players[1] : players[[1, 6, 8][variant]];
            if (target.id === human.id) continue;
            const subject = SUBJECT_ACTIONS.includes(action as HumanAction) ? players.find((p) => p !== human && p !== target && (!tower || p.role === PlayerRole.FAITHFUL)) : undefined;
            // Relações extremas em algumas variantes (amigos, inimigos) para passar pelas respostas diferentes.
            if (variant === 1) matrix.set(target.id, human.id, { trust: 95, liking: 95, hatred: 0, allied: true });
            if (variant === 2) matrix.set(target.id, human.id, { trust: 5, liking: 5, hatred: 95, allied: false });
            const memory: HumanMemory = {
              accused: variant ? [players[7].id] : [],
              defended: variant === 2 ? [players[1].id] : [],
              hits: variant,
              misses: 2 - variant,
              tower: { day: 4, pledges: { p1: 'p7' }, spares: { p1: ['p8'] }, recruits: {} },
              talkedOn: { [target.id]: 1 },
            };
            const flags: SimulationFlags = {};
            const alliances = new AllianceBook(matrix, flags, players.map((p) => p.id));
            if (variant === 1) alliances.create([target.id, human.id]);
            const out = performHumanAction({
              rng: seededRng(`a${pi}${ai}${variant}${humanIsTraitor}`),
              matrix,
              alliances,
              human,
              target,
              subject,
              present,
              active: players,
              action: action as HumanAction,
              phase,
              day: 4,
              victim: phase === GamePhase.BREAKFAST ? players[9] : undefined,
              memory,
              dungeonIds: variant === 2 ? ['p7', 'p8'] : [],
              chaos: variant / 2,
            });
            expect(out.length).toBeGreaterThan(0);
            events += out.length;
          }
        }
      }
    }
    expect(events).toBeGreaterThan(500);
    expect(actionsFor(GamePhase.ARRIVAL, false)).not.toContain('ACCUSE');
    expect(actionsFor(GamePhase.TRAITORS_MEETING, true)).toEqual([...TOWER_ACTIONS]);
  });

  it('aceita, recusa e deixa expirar convites para alianças', () => {
    for (const accept of [true, false]) {
      for (const withGroup of [false, true]) {
        const players = cast(8, 2);
        const matrix = matrixFor(players, `inv${accept}${withGroup}`);
        const flags: SimulationFlags = {};
        const alliances = new AllianceBook(matrix, flags, players.map((p) => p.id));
        const group = withGroup ? alliances.create([players[2].id, players[3].id]) ?? undefined : undefined;
        const memory: HumanMemory = {};
        const invite = { fromId: players[2].id, groupId: group?.id ?? null, memberIds: group ? group.memberIds : [players[2].id], day: 2, phase: GamePhase.BREAKFAST };
        const events = answerInvite({ matrix, alliances, invite, human: players[5], inviter: players[2], active: players, accept, memory, day: 2 });
        expect(events).not.toBeNull();
      }
    }
    const players = cast(6, 1);
    const matrix = matrixFor(players, 'exp');
    const memory: HumanMemory = { invites: [{ fromId: 'p2', groupId: null, memberIds: ['p2'], day: 1, phase: GamePhase.ARRIVAL }] };
    expireInvites(matrix, memory, 'p4', 1, GamePhase.BREAKFAST);
    expect(memory.invites?.length ?? 0).toBe(0);
  });
});
