import { describe, expect, it } from 'vitest';
import { createSeason, ok, signUp } from '../helpers';
import { playAsHuman } from '../player-bot';

describe('simulação automática e modo Jogador', () => {
  it('simula temporadas automáticas inteiras em cada temporada do programa', async () => {
    const { agent } = await signUp('auto');
    for (const [i, missionPool] of ['US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'US_S4', 'MIX'].entries()) {
      const season = await createSeason(agent, 12 + (i % 3) * 2, { mode: 'AUTOMATIC', chaos: (i * 15) % 100, missionPool, withdrawals: i % 2 === 0, maxPrizePot: 60000 });
      ok(await agent.patch(`/api/seasons/${season.id}`).send({ chaos: 40, missionPool }));
      ok(await agent.post(`/api/seasons/${season.id}/relationships/regenerate`));
      ok(await agent.post(`/api/seasons/${season.id}/start`));
      expect((await agent.post(`/api/seasons/${season.id}/relationships/regenerate`)).status).toBe(422);

      // Primeiro uma fase por vez, com o termômetro do castelo.
      ok(await agent.post(`/api/seasons/${season.id}/simulate`).send({}));
      const relationships = ok(await agent.get(`/api/seasons/${season.id}/relationships`));
      expect(relationships.standings.length).toBeGreaterThan(0);
      const { fromId, toId } = relationships.relationships[0];
      ok(await agent.patch(`/api/seasons/${season.id}/relationships`).send({ fromId, toId, trust: 10, liking: 5, hatred: 90, allied: false }));
      expect((await agent.post(`/api/seasons/${season.id}/simulate`).send({})).status).toBe(422);

      const end = ok(await agent.post(`/api/seasons/${season.id}/simulate`).send({ untilEnd: true }));
      expect(end.season.status).toBe('FINISHED');
      expect(ok(await agent.get(`/api/seasons/${season.id}/history`)).days.length).toBeGreaterThan(2);
    }
  });

  it('joga temporadas no modo Jogador respondendo a tudo o que a tela pede', async () => {
    const { agent } = await signUp('jogador');
    const needs = new Set<string>();
    let talked = 0;
    const runs: [string, number, boolean][] = [
      ['US_S3', 16, true],
      ['US_S3', 14, false],
      ['UK_S2', 14, true],
      ['MIX', 12, false],
      ['UK_S3', 12, true],
    ];
    for (const [i, [missionPool, size, forceTraitor]] of runs.entries()) {
      const season = await createSeason(agent, size - 1, {
        mode: 'PLAYER',
        missionPool,
        chaos: 20 * i,
        interactionLimit: 3,
        human: { name: `Eu ${i}`, imageUrl: 'https://example.com/eu.png' },
      });
      ok(await agent.post(`/api/seasons/${season.id}/start`));
      expect((await agent.post(`/api/seasons/${season.id}/simulate`).send({ untilEnd: true })).status).toBe(422);
      const result = await playAsHuman(agent, season.id, 7 + i * 31, { forceTraitor });
      result.seenNeeds.forEach((n) => needs.add(n));
      talked += result.talked;
    }
    expect(talked).toBeGreaterThan(10);
    expect(needs.has('VOTE')).toBe(true);
    expect(needs.has('MISSION')).toBe(true);
  });

  it('drama e frases só mudam a tela: valem em qualquer momento, e sem frases sobra o que importa', async () => {
    const { agent } = await signUp('falas');
    type Event = { kind: string; playerIds: string[] };
    const events = async (seasonId: string): Promise<Event[]> => ok(await agent.get(`/api/seasons/${seasonId}/history`)).days.flatMap((d: { events: Event[] }) => d.events);
    const dialogues = async (seasonId: string) => (await events(seasonId)).filter((e) => e.kind === 'DIALOGUE');

    // Automática sem frases: a narrativa fica com eliminações, votos e missões.
    const auto = await createSeason(agent, 10, { mode: 'AUTOMATIC', showPhrases: false });
    expect(auto).toMatchObject({ drama: false, showPhrases: false });
    ok(await agent.post(`/api/seasons/${auto.id}/start`));
    ok(await agent.post(`/api/seasons/${auto.id}/simulate`).send({ untilEnd: true }));
    expect(await dialogues(auto.id)).toHaveLength(0);
    expect((await events(auto.id)).some((e) => e.kind === 'VOTE')).toBe(true);
    // As falas continuam guardadas: ligar de novo traz tudo de volta, mesmo com a temporada encerrada.
    expect(ok(await agent.patch(`/api/seasons/${auto.id}`).send({ showPhrases: true }))).toMatchObject({ status: 'FINISHED', showPhrases: true });
    expect((await dialogues(auto.id)).length).toBeGreaterThan(0);

    // Modo Jogador sem frases: só as que envolvem o jogador.
    const played = await createSeason(agent, 11, { mode: 'PLAYER', human: { name: 'Eu' }, drama: true, showPhrases: false });
    expect(played).toMatchObject({ drama: true, showPhrases: false });
    const humanId = played.players.find((p: { isHuman: boolean }) => p.isHuman).id;
    ok(await agent.post(`/api/seasons/${played.id}/start`));
    ok(await agent.post(`/api/seasons/${played.id}/simulate`).send({}));
    // No meio do jogo, drama e frases mudam; o resto das configurações, não.
    expect(ok(await agent.patch(`/api/seasons/${played.id}`).send({ drama: false }))).toMatchObject({ status: 'IN_PROGRESS', drama: false, showPhrases: false });
    expect((await agent.patch(`/api/seasons/${played.id}`).send({ chaos: 90 })).status).toBe(422);
    await playAsHuman(agent, played.id, 3);
    const mine = await dialogues(played.id);
    expect(mine.every((e) => e.playerIds.includes(humanId))).toBe(true);
    ok(await agent.patch(`/api/seasons/${played.id}`).send({ showPhrases: true }));
    const all = await dialogues(played.id);
    expect(all.length).toBeGreaterThan(mine.length);
    expect(all.some((e) => !e.playerIds.includes(humanId))).toBe(true);
  });
});
