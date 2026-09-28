import { useServices } from '../../../app/services';
import type { GameState, Player, PlayerView } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import type { HumanDecision } from '../../../services/api/SimulationService';
import type { Elimination } from '../components/EliminationReveal';
import { useGame } from '../context/GameContext';

/** Quem saiu do jogo com a decisão (para a cena de eliminação). */
export type OnResult = (e: Elimination | null) => void;

/** Envia a decisão do usuário, mostra quem saiu e recarrega a tela. */
export function useDecision(onResult: OnResult) {
  const { state, seasonId, refresh } = useGame();
  const { simulation } = useServices();
  const run = useAction((decision: HumanDecision) => simulation.simulate(seasonId, false, decision));
  async function send(decision: HumanDecision) {
    const after = await run.run(decision);
    if (!after) return;
    onResult(newElimination(state, after));
    refresh();
  }
  return { send, pending: run.pending };
}

function newElimination(before: GameState, after: GameState): Elimination | null {
  const known = new Set(before.eliminatedPlayers.map((p) => p.id));
  const out = after.eliminatedPlayers.filter((p) => !known.has(p.id)).at(-1);
  return out && out.status !== 'ACTIVE' ? { player: out, kind: out.status, role: out.role, roleHidden: out.roleHidden } : null;
}

/** Todos que estão no jogo, menos você. */
export function othersThan(state: GameState, me: PlayerView): Player[] {
  return state.activePlayers.filter((p) => p.id !== me.playerId);
}

/** Seleção única numa grade de fotos: clicar de novo desmarca. */
export function toggleOne(current: string | null, id: string): string | null {
  return id === current ? null : id;
}
