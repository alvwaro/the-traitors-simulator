import { describe, expect, it } from 'vitest';
import { createSeason, ok, signUp } from '../helpers';
import { playAsHuman } from '../player-bot';

describe('simulação automática e modo Jogador', () => {
  it('simula temporadas automáticas inteiras em cada temporada do programa', async () => {
    const { agent } = await signUp('auto');
    for (const [i, missionPool] of ['US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'MIX'].entries()) {
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
});
