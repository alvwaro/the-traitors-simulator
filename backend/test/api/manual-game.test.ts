import { describe, expect, it } from 'vitest';
import { Agent, createSeason, ok, signUp } from '../helpers';

type Player = { id: string; name: string; role: string; status: string };
type State = { phase: string; day: number; activePlayers: Player[]; eliminatedPlayers: Player[]; pendingRequirement: string | null; canGoBack: boolean; season: { status: string } };

const state = async (agent: Agent, id: string) => ok<State>(await agent.get(`/api/seasons/${id}/state`));
const advance = async (agent: Agent, id: string) => ok<State>(await agent.post(`/api/seasons/${id}/advance`));

/** Todos votam em `target` (o próprio alvo vota no primeiro outro nome). */
function votesAgainst(players: Player[], target: Player) {
  return players.map((p) => ({ voterId: p.id, targetId: p.id === target.id ? players.find((q) => q.id !== target.id)!.id : target.id, round: 1 }));
}

describe('temporada manual do começo ao fim', () => {
  it('registra cada fase, desfaz com "voltar" e chega à revelação final', async () => {
    const { agent } = await signUp('manual');
    const season = await createSeason(agent, 10, { currency: 'USD', initialPrizePot: 1000, maxPrizePot: 500000 });
    const id = season.id;

    // Antes de começar: ajustes na temporada e no elenco.
    ok(await agent.patch(`/api/seasons/${id}`).send({ name: 'Castelo de Teste', initialPrizePot: 2000 }));
    const extra = ok(await agent.post(`/api/seasons/${id}/players`).send({ name: 'Convidado', saveToLibrary: true }), 201);
    ok(await agent.patch(`/api/seasons/${id}/players/${extra.id}`).send({ name: 'Convidado Especial' }));
    expect(ok<unknown[]>(await agent.get(`/api/seasons/${id}/players`)).length).toBe(11);
    ok(await agent.delete(`/api/seasons/${id}/players/${extra.id}`), 204);
    expect((await agent.post(`/api/seasons/${id}/advance`)).status).toBe(422);

    let s = ok<State>(await agent.post(`/api/seasons/${id}/start`));
    expect(s.phase).toBe('ARRIVAL');
    expect(s.canGoBack).toBe(false);
    expect((await agent.patch(`/api/seasons/${id}`).send({ initialPrizePot: 5 })).status).toBe(422);

    let undoneRoundTable = false;
    let recruited = false;
    let withdrew = false;
    for (let step = 0; step < 200 && s.phase !== 'FINALE'; step++) {
      const active = s.activePlayers;
      const traitors = active.filter((p) => p.role === 'TRAITOR');
      const faithful = active.filter((p) => p.role !== 'TRAITOR');
      switch (s.phase) {
        case 'ARRIVAL':
          ok(await agent.post(`/api/seasons/${id}/phase/notes`).send({ notes: 'Todos chegaram ao castelo.' }));
          break;
        case 'TRAITOR_SELECTION':
          expect(s.pendingRequirement).toBeTruthy();
          ok(await agent.post(`/api/seasons/${id}/phase/traitor-selection`).send({ traitorIds: active.slice(0, 3).map((p) => p.id) }));
          break;
        case 'BREAKFAST':
          if (s.day === 3 && !withdrew) {
            withdrew = true;
            ok(await agent.post(`/api/seasons/${id}/players/${faithful.at(-1)!.id}/withdraw`));
            ok(await agent.post(`/api/seasons/${id}/prize-adjustments`).send({ type: 'PENALTY', amount: 500, description: 'Celular escondido' }), 201);
            ok(await agent.post(`/api/seasons/${id}/prize-adjustments`).send({ type: 'ADJUSTMENT', amount: 250 }), 201);
          }
          break;
        case 'MISSION':
          ok(await agent.post(`/api/seasons/${id}/phase/mission`).send({ name: 'Missão do dia', prizeEarned: 5000, prizeAvailable: 10000, shieldedPlayerIds: [faithful[0].id] }), 201);
          break;
        case 'ROUND_TABLE': {
          if (active.length <= 6 && s.season.status === 'IN_PROGRESS') {
            s = ok<State>(await agent.post(`/api/seasons/${id}/endgame`));
            continue;
          }
          const target = s.day === 3 && traitors.length > 1 ? traitors[0] : faithful[faithful.length - 1];
          const table = ok(await agent.post(`/api/seasons/${id}/phase/round-table`).send({ banishedPlayerId: target.id, votes: votesAgainst(active, target), notes: 'Mesa tensa' }), 201);
          expect(table.banishedPlayerId).toBe(target.id);
          if (!undoneRoundTable) {
            // "Voltar": a mesa é desfeita e o banido volta ao jogo.
            undoneRoundTable = true;
            const back = ok<State>(await agent.post(`/api/seasons/${id}/back`));
            expect(back.phase).toBe('ROUND_TABLE');
            expect(back.activePlayers.some((p) => p.id === target.id)).toBe(true);
            expect(back.pendingRequirement).toBeTruthy();
            ok(await agent.post(`/api/seasons/${id}/phase/round-table`).send({ banishedPlayerId: target.id, votes: votesAgainst(active, target) }), 201);
          }
          break;
        }
        case 'TRAITORS_MEETING':
          if (traitors.length && faithful.length) {
            const body =
              !recruited
                ? { recruitment: { targetId: faithful[0].id, accepted: true, isUltimatum: false } }
                : { murderTargetId: faithful[s.day % faithful.length].id, plainSight: s.day === 4 };
            recruited ||= 'recruitment' in body;
            ok(await agent.post(`/api/seasons/${id}/phase/traitors-meeting`).send({ ...body, notes: 'Decisão na torre' }), 201);
          }
          break;
        case 'ENDGAME_ROUND_TABLE': {
          const tables = ok(await agent.get(`/api/seasons/${id}/history`)).days.at(-1).roundTables.filter((t: { kind: string }) => t.kind === 'ENDGAME');
          if (tables.length === 0 && active.length > 2) {
            const target = active[active.length - 1];
            ok(
              await agent.post(`/api/seasons/${id}/phase/endgame-round-table`).send({
                endgameVotes: active.map((p) => ({ voterId: p.id, choice: 'BANISH_AGAIN' })),
                banishedPlayerId: target.id,
                votes: votesAgainst(active, target),
              }),
              201,
            );
            s = await state(agent, id);
            continue;
          }
          ok(await agent.post(`/api/seasons/${id}/phase/endgame-round-table`).send({ endgameVotes: active.map((p) => ({ voterId: p.id, choice: 'END_GAME' })) }), 201);
          break;
        }
      }
      s = await advance(agent, id);
    }

    expect(s.phase).toBe('FINALE');
    expect(s.season.status).toBe('FINISHED');
    expect(undoneRoundTable).toBe(true);
    expect(recruited).toBe(true);
    expect(withdrew).toBe(true);
    const history = ok(await agent.get(`/api/seasons/${id}/history`));
    expect(history.days.length).toBeGreaterThan(3);
    expect((await state(agent, id)).season.status).toBe('FINISHED');
    expect(ok(await agent.get(`/api/seasons/${id}`)).players.length).toBe(10);

    // Até a revelação final dá para desfazer.
    expect((await state(agent, id)).canGoBack).toBe(true);
    const undone = ok<State>(await agent.post(`/api/seasons/${id}/back`));
    expect(undone.phase).not.toBe('FINALE');
    expect((await advance(agent, id)).phase).toBe('FINALE');

    // Publicar, copiar, salvar o elenco e apagar.
    const cast = ok(await agent.post(`/api/seasons/${id}/save-as-cast`).send({ name: 'Elenco do castelo' }), 201);
    expect(cast.characterIds.length).toBeGreaterThan(0);
    const publication = ok(await agent.post('/api/publications').send({ kind: 'SEASON', sourceId: id, description: 'Uma temporada inteira' }), 201);
    expect(ok<unknown[]>(await agent.get('/api/publications').query({ area: 'FAN', mine: 'true' })).length).toBeGreaterThan(0);
    const { agent: fan } = await signUp('leitor');
    expect(ok(await fan.get(`/api/seasons/${id}/history`)).days.length).toBeGreaterThan(0);
    expect((await fan.post(`/api/seasons/${id}/advance`)).status).toBe(403);
    const copy = ok(await fan.post(`/api/publications/${publication.id}/copy`).send({ name: 'Minha cópia' }), 201);
    expect(copy.kind).toBe('SEASON');
    expect((await fan.delete(`/api/publications/${publication.id}`)).status).toBe(403);
    ok(await agent.delete(`/api/publications/${publication.id}`), 204);
    ok(await agent.delete(`/api/seasons/${id}`), 204);
  });

  it('recusa registros fora da fase ou inconsistentes', async () => {
    const { agent } = await signUp('regras');
    const season = await createSeason(agent, 4);
    const id = season.id;
    ok(await agent.post(`/api/seasons/${id}/start`));
    expect((await agent.post(`/api/seasons/${id}/start`)).status).toBe(422);
    expect((await agent.post(`/api/seasons/${id}/phase/mission`).send({ prizeEarned: 10 })).status).toBe(422);
    let s = await advance(agent, id);
    const everyone = s.activePlayers.map((p) => p.id);
    expect((await agent.post(`/api/seasons/${id}/phase/traitor-selection`).send({ traitorIds: everyone })).status).toBe(422);
    expect((await agent.post(`/api/seasons/${id}/advance`)).status).toBe(422);
    ok(await agent.post(`/api/seasons/${id}/phase/traitor-selection`).send({ traitorIds: [everyone[0]] }));
    s = await advance(agent, id);
    expect(s.phase).toBe('MISSION');
    expect((await agent.post(`/api/seasons/${id}/phase/mission`).send({ prizeEarned: -1 })).status).toBe(400);
    expect((await agent.post(`/api/seasons/${id}/prize-adjustments`).send({ type: 'PENALTY', amount: 1_000_000 })).status).toBe(422);

    // Voltar desfaz um registro por vez até o começo; na chegada do dia 1 não há mais para onde ir.
    let backs = 0;
    while ((await state(agent, id)).canGoBack) {
      ok(await agent.post(`/api/seasons/${id}/back`));
      backs++;
    }
    expect(backs).toBeGreaterThanOrEqual(3);
    s = await state(agent, id);
    expect(s.phase).toBe('ARRIVAL');
    expect(s.activePlayers.every((p) => p.role === 'FAITHFUL')).toBe(true);
    expect((await agent.post(`/api/seasons/${id}/back`)).status).toBe(422);
  });
});
