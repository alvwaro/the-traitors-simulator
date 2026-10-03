import { describe, expect, it } from 'vitest';
import { GamePhase, PhrasePhase, PhraseTone, PlayerRole, SimulationEventKind } from '../../src/domain/enums';
import { AllianceBook } from '../../src/domain/simulation/alliances';
import { approachHuman } from '../../src/domain/simulation/approaches';
import { APPROACH_TOO_NICE, ASIDE_TOO_NICE, REPLY_TOO_NICE } from '../../src/domain/simulation/dialogue/replies-wary';
import {
  answerInvite,
  coolKindness,
  expireInvites,
  HUMAN_ACTIONS,
  HumanAction,
  HumanMemory,
  performHumanAction,
  SUBJECT_ACTIONS,
  TOWER_ACTIONS,
  actionsFor,
} from '../../src/domain/simulation/humanActions';
import { EDITIONS, editionFor, finaleFor, missionFor, missionSequence, seerMissionFor } from '../../src/domain/simulation/missions/catalog';
import { MissionDefinition } from '../../src/domain/simulation/missions/MissionContext';
import { fillMissingRelationships, RelationshipMatrix } from '../../src/domain/simulation/RelationshipMatrix';
import { seededRng } from '../../src/domain/simulation/random';
import { SimulationEngine, SimulationFlags } from '../../src/domain/simulation/SimulationEngine';
import { Social } from '../../src/domain/simulation/social';
import { Attributes, boldTaste, SimPlayer, traitsOf, wariness } from '../../src/domain/simulation/traits';

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

describe('confiança e amizade: gentileza demais e coragem', () => {
  /** Personagem com os traços escolhidos (o resto no meio). */
  function person(id: string, traits: Partial<Attributes> = {}): SimPlayer {
    return { id, name: id.toUpperCase(), role: PlayerRole.FAITHFUL, behaviorIds: [], traits: { ...traitsOf([]), ...traits } };
  }

  /** Todo mundo neutro com todo mundo. */
  function neutral(players: readonly SimPlayer[]): RelationshipMatrix {
    const matrix = new RelationshipMatrix();
    for (const from of players) for (const to of players) matrix.set(from.id, to.id, { trust: 50, liking: 50, hatred: 0, allied: false });
    return matrix;
  }

  const human = person('eu');
  const wary = person('desconfiada', { insight: 95, paranoia: 95 });
  const fan = person('brava', { aggression: 90, conformity: 10 });
  const calm = person('calma', { aggression: 10, conformity: 90 });
  const castle = [human, wary, fan, calm, person('neutro')];

  /** O jogador fala com alguém na mesa redonda (todo mundo ouve). */
  function act(action: HumanAction, target: SimPlayer, memory: HumanMemory, seed = 'x') {
    const matrix = neutral(castle);
    const alliances = new AllianceBook(matrix, {}, castle.map((p) => p.id));
    const events = performHumanAction({ rng: seededRng(seed), matrix, alliances, human, target, present: castle, active: castle, action, phase: GamePhase.ROUND_TABLE, day: 3, memory });
    return { matrix, events };
  }

  it('gentileza demais vira suspeita: quem recebe e quem ouve confia menos, e alguém deixa isso claro', () => {
    expect(wariness(wary)).toBeGreaterThan(wariness(calm));
    const first = act('PRAISE', wary, {});
    const memory: HumanMemory = { kindness: 6 };
    const later = act('PRAISE', wary, memory);
    expect(memory.kindness).toBe(7);
    // O elogio em si não mexe na confiança; a fama de bonzinho(a), sim (mais em quem é desconfiado).
    expect(later.matrix.get(wary.id, human.id).trust).toBeLessThan(first.matrix.get(wary.id, human.id).trust - 6);
    for (const p of [fan, calm]) expect(later.matrix.get(p.id, human.id).trust).toBeLessThan(first.matrix.get(p.id, human.id).trust);

    const suspicious = [...REPLY_TOO_NICE, ...ASIDE_TOO_NICE];
    const tries = (kindness?: number) => Array.from({ length: 8 }, (_, i) => act('PRAISE', wary, { kindness }, `n${i}`).events).flat();
    const noticed = tries(6).filter((e) => suspicious.includes(e.text));
    expect(noticed.length).toBeGreaterThan(0);
    expect(noticed.every((e) => e.tone === PhraseTone.SUSPICION)).toBe(true);
    // Sem a fama, ninguém estranha.
    expect(tries().some((e) => suspicious.includes(e.text))).toBe(false);
    // Quem estranha pode ser alguém que só ouviu: comenta à parte.
    const asides = Array.from({ length: 8 }, (_, i) => act('PRAISE', calm, { kindness: 6 }, 'a' + i).events)
      .flat()
      .filter((e) => ASIDE_TOO_NICE.includes(e.text));
    expect(asides.length).toBeGreaterThan(0);
    expect(asides.every((e) => e.kind === SimulationEventKind.REACTION && e.playerIds[0] === wary.id)).toBe(true);

    // Tomar partido apaga boa parte da fama; e ela esfria a cada manhã.
    const harsh: HumanMemory = { kindness: 3 };
    act('ACCUSE', calm, harsh);
    expect(harsh.kindness).toBe(1);
    const cooling: HumanMemory = { kindness: 5 };
    coolKindness(cooling);
    expect(cooling.kindness).toBe(3);
    const almost: HumanMemory = { kindness: 0.5 };
    coolKindness(almost);
    expect(almost.kindness).toBe(0);
  });

  it('acusar e provocar não pegam mal com todo mundo: quem gosta de gente brava admira', () => {
    expect(boldTaste(fan)).toBeGreaterThan(1);
    expect(boldTaste(calm)).toBeLessThan(-0.9);
    for (const action of ['ACCUSE', 'INSULT', 'SUSPECT'] as const) {
      const { matrix } = act(action, wary, {});
      expect(matrix.get(fan.id, human.id).liking).toBeGreaterThan(50);
      expect(matrix.get(calm.id, human.id).liking).toBeLessThan(50);
    }
  });

  it('entre os personagens: quem acusa ganha fãs entre os bravos, e quem é querido(a) demais desperta suspeita', () => {
    const accuser = person('acusa');
    const accused = person('acusado');
    const table = [accuser, accused, fan, calm];
    const matrix = neutral(table);
    const social = new Social(() => 0.99, matrix, () => table, new AllianceBook(matrix, {}, table.map((p) => p.id)));
    const phrase = { id: 'f', phase: PhrasePhase.ROUND_TABLE, tone: PhraseTone.ACCUSATION, behaviorId: null, text: '{user} acusou {user1}.' };
    social.applyLine({ phrase, speaker: accuser, target: accused, event: { kind: SimulationEventKind.DIALOGUE, tone: phrase.tone, text: phrase.text, playerIds: [accuser.id, accused.id] } });
    expect(matrix.get(fan.id, accuser.id).liking).toBeGreaterThan(50);
    expect(matrix.get(calm.id, accuser.id).liking).toBeLessThan(50);

    // A mesma pessoa, adorada por todos, perde mais confiança de quem observa do que alguém comum.
    const darling = person('querida');
    const plain = person('comum');
    const observer = person('observa', { insight: 95, paranoia: 95 });
    const fans = [1, 2, 3].map((i) => person(`fã${i}`));
    const everyone = [darling, plain, observer, ...fans];
    const feelings = neutral(everyone);
    for (const p of [plain, observer, ...fans]) feelings.set(p.id, darling.id, { liking: 100 });
    feelings.set(observer.id, plain.id, { liking: 100 });
    new Social(() => 0.5, feelings, () => everyone, new AllianceBook(feelings, {}, everyone.map((p) => p.id))).dailyDrift();
    expect(feelings.get(observer.id, darling.id).trust).toBeLessThan(feelings.get(observer.id, plain.id).trust);
  });

  it('quem é bonzinho(a) demais recebe visita: tanta gentileza assusta', () => {
    const visits = (kindness: number) =>
      Array.from({ length: 10 }, (_, i) => {
        const matrix = neutral(castle);
        const alliances = new AllianceBook(matrix, {}, castle.map((p) => p.id));
        const byId = new Map(castle.map((p) => [p.id, p]));
        return approachHuman({ rng: seededRng(`v${i}`), matrix, alliances, human, active: castle, byId, moment: 'BREAKFAST', phase: GamePhase.BREAKFAST, day: 3, memory: { kindness } }).events;
      }).flat();
    const tooNice = (kindness: number) => visits(kindness).filter((e) => APPROACH_TOO_NICE.includes(e.text));
    const warned = tooNice(8);
    expect(warned.length).toBeGreaterThan(0);
    expect(warned.every((e) => e.tone === PhraseTone.SUSPICION && e.playerIds.includes(human.id))).toBe(true);
    expect(tooNice(0)).toHaveLength(0);
  });
});
