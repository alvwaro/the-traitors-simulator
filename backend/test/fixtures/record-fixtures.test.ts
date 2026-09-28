import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { Agent, createCharacters, createSeason, ok, signUp } from '../helpers';
import { getState, playAsHuman, State } from '../player-bot';

/**
 * Grava respostas reais da API para os testes do frontend (frontend/src/test/fixtures/api.json).
 * Só roda no modo "fixtures": npm run test:fixtures
 */
const OUT = join(process.cwd(), '..', 'frontend', 'src', 'test', 'fixtures', 'api.json');

type History = { days: { day: { number: number }; events: unknown[] }[] };
type Snapshot = { label: string; details: unknown; state: unknown; history: History };

/** O que a tela do jogo carrega: a temporada, o estado e a crônica (só hoje e ontem, para o arquivo não crescer). */
async function snapshot(agent: Agent, id: string, label: string): Promise<Snapshot> {
  const state = ok<State>(await agent.get(`/api/seasons/${id}/state`));
  const history = ok<History>(await agent.get(`/api/seasons/${id}/history`));
  const day = state.day ?? 1;
  return {
    label,
    details: ok(await agent.get(`/api/seasons/${id}`)),
    state,
    // De ontem a tela só usa o resultado (noite, mesa); a narrativa fica só a de hoje.
    history: {
      ...history,
      days: history.days
        .filter((d) => d.day.number >= day - 1 && d.day.number <= day)
        .map((d) => (d.day.number === day ? d : { ...d, events: [] })),
    },
  };
}

type Player = { id: string; role: string };
function votesAgainst(players: Player[], target: Player) {
  return players.map((p) => ({ voterId: p.id, targetId: p.id === target.id ? players.find((q) => q.id !== target.id)!.id : target.id, round: 1 }));
}

/** Temporada manual: uma foto antes e outra depois do registro de cada fase. */
async function recordManual(agent: Agent): Promise<Snapshot[]> {
  const season = await createSeason(agent, 9, { currency: 'BRL', initialPrizePot: 1000 });
  const id = season.id;
  const shots: Snapshot[] = [await snapshot(agent, id, 'setup')];
  let s = ok<State>(await agent.post(`/api/seasons/${id}/start`));
  for (let step = 0; step < 120 && s.phase !== 'FINALE'; step++) {
    shots.push(await snapshot(agent, id, `${s.day}:${s.phase}:antes`));
    const active = s.activePlayers as unknown as Player[];
    const traitors = active.filter((p) => p.role === 'TRAITOR');
    const faithful = active.filter((p) => p.role !== 'TRAITOR');
    switch (s.phase) {
      case 'ARRIVAL':
        ok(await agent.post(`/api/seasons/${id}/phase/notes`).send({ notes: 'Chegada tranquila.' }));
        break;
      case 'TRAITOR_SELECTION':
        ok(await agent.post(`/api/seasons/${id}/phase/traitor-selection`).send({ traitorIds: active.slice(0, 2).map((p) => p.id) }));
        break;
      case 'MISSION':
        ok(await agent.post(`/api/seasons/${id}/phase/mission`).send({ name: 'Missão', prizeEarned: 3000, prizeAvailable: 5000, shieldedPlayerIds: [faithful[0].id] }), 201);
        break;
      case 'ROUND_TABLE':
        if (active.length <= 6 && s.season.status === 'IN_PROGRESS') {
          s = ok<State>(await agent.post(`/api/seasons/${id}/endgame`));
          continue;
        } else {
          const target = faithful.at(-1)!;
          ok(await agent.post(`/api/seasons/${id}/phase/round-table`).send({ banishedPlayerId: target.id, votes: votesAgainst(active, target) }), 201);
        }
        break;
      case 'TRAITORS_MEETING':
        if (traitors.length && faithful.length > 1) {
          ok(await agent.post(`/api/seasons/${id}/phase/traitors-meeting`).send({ murderTargetId: faithful[s.day % faithful.length].id }), 201);
        }
        break;
      case 'ENDGAME_ROUND_TABLE':
        ok(await agent.post(`/api/seasons/${id}/phase/endgame-round-table`).send({ endgameVotes: active.map((p) => ({ voterId: p.id, choice: 'END_GAME' })) }), 201);
        break;
    }
    shots.push(await snapshot(agent, id, `${s.day}:${s.phase}:depois`));
    s = ok<State>(await agent.post(`/api/seasons/${id}/advance`));
  }
  shots.push(await snapshot(agent, id, 'final'));
  return shots;
}

/** Temporada automática: antes e depois de simular cada fase (os primeiros dias e a reta final). */
async function recordAutomatic(agent: Agent): Promise<{ shots: Snapshot[]; relationships: unknown; fullHistory: unknown }> {
  const season = await createSeason(agent, 10, { mode: 'AUTOMATIC', missionPool: 'US_S3', chaos: 30 });
  const id = season.id;
  const shots: Snapshot[] = [await snapshot(agent, id, 'setup')];
  ok(await agent.post(`/api/seasons/${id}/start`));
  let relationships: unknown = null;
  for (let step = 0; step < 300; step++) {
    const s = await getState(agent, id);
    if (s.season.status === 'FINISHED') break;
    const record = s.day <= 2 || s.season.status === 'ENDGAME';
    if (record) shots.push(await snapshot(agent, id, `${s.day}:${s.phase}:antes`));
    ok(await agent.post(`/api/seasons/${id}/simulate`).send({}));
    if (record) shots.push(await snapshot(agent, id, `${s.day}:${s.phase}:depois`));
    if (!relationships && s.day === 2) relationships = ok(await agent.get(`/api/seasons/${id}/relationships`));
    ok(await agent.post(`/api/seasons/${id}/advance`));
  }
  shots.push(await snapshot(agent, id, 'final'));
  return { shots, relationships, fullHistory: ok(await agent.get(`/api/seasons/${id}/history`)) };
}

/** Modo Jogador: uma foto de cada situação diferente da tela (fase, decisão pedida, conversa...). */
/** Situações da tela do jogador já gravadas (valem para as três temporadas: não repete). */
const seen = new Set<string>();

async function recordPlayer(agent: Agent, missionPool: string, seed: number): Promise<Snapshot[]> {
  const season = await createSeason(agent, 13, { mode: 'PLAYER', missionPool, human: { name: 'Você' }, interactionLimit: 2 });
  const id = season.id;
  const shots: Snapshot[] = [await snapshot(agent, id, 'setup')];
  ok(await agent.post(`/api/seasons/${id}/start`));
  await playAsHuman(agent, id, seed, {
    forceTraitor: seed % 2 === 1,
    onStep: async (s) => {
      const me = (s as unknown as { player: { need: string | null; canTalk: boolean; spectator: boolean; invites: unknown[]; pendingOffer: unknown } }).player;
      const key = [s.phase, s.phaseSimulated, me.need, me.canTalk, me.spectator, me.invites.length > 0, !!me.pendingOffer, s.season.status].join(':');
      if (seen.has(key)) return;
      seen.add(key);
      shots.push(await snapshot(agent, id, key));
    },
  });
  return shots;
}

describe.runIf(import.meta.env.MODE === 'fixtures')('gravação das fixtures do frontend', () => {
  it('grava as respostas da API', async () => {
    const { agent, username } = await signUp('gravador');
    const { agent: owner } = await signUp('dono', true);
    const behaviors = ok<{ id: string }[]>(await agent.get('/api/behaviors'));
    const ids = await createCharacters(agent, ['Ana', 'Bruno', 'Carla', 'Diego']);
    ok(await agent.patch(`/api/characters/${ids[0]}`).send({ behaviorIds: [behaviors[0].id, behaviors[1].id] }));
    const cast = ok(await agent.post('/api/casts').send({ name: 'Quarteto', description: 'Quatro amigos', characterIds: ids }), 201);
    ok(await agent.patch(`/api/casts/${cast.id}/relationships`).send({ fromId: ids[0], toId: ids[1], trust: 90, liking: 85, hatred: 5, allied: true }));
    const castPub = ok(await agent.post('/api/publications').send({ kind: 'CAST', sourceId: cast.id }), 201);
    ok(await agent.post('/api/publications').send({ kind: 'CHARACTER', sourceId: ids[1] }), 201);

    const manual = await recordManual(agent);
    const automatic = await recordAutomatic(agent);
    const player = [...(await recordPlayer(agent, 'US_S3', 3)), ...(await recordPlayer(agent, 'UK_S2', 8)), ...(await recordPlayer(agent, 'US_S3', 11))];
    const official = await createSeason(owner, 5);
    ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: official.id, description: 'Temporada oficial' }), 201);

    const data = {
      me: ok(await agent.get('/api/auth/me')),
      owner: ok(await owner.get('/api/auth/me')),
      username,
      behaviors,
      phrases: ok<unknown[]>(await agent.get('/api/phrases')).slice(0, 250),
      editions: ok(await agent.get('/api/editions')),
      characters: ok(await agent.get('/api/characters')),
      casts: ok(await agent.get('/api/casts')),
      cast: ok(await agent.get(`/api/casts/${cast.id}`)),
      castRelationships: ok(await agent.get(`/api/casts/${cast.id}/relationships`)),
      castRanking: ok(await agent.get(`/api/casts/${cast.id}/ranking`)),
      publications: {
        official: ok(await agent.get('/api/publications').query({ area: 'OFFICIAL' })),
        fan: ok(await agent.get('/api/publications').query({ area: 'FAN' })),
        mine: ok(await agent.get('/api/publications').query({ mine: 'true' })),
      },
      castPublicationId: castPub.id,
      seasons: ok(await agent.get('/api/seasons')),
      games: { manual, automatic: automatic.shots, player },
      relationships: automatic.relationships,
      fullHistory: automatic.fullHistory,
    };
    mkdirSync(join(OUT, '..'), { recursive: true });
    writeFileSync(OUT, JSON.stringify(data));
  });
});
