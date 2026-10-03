import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { ConfirmModal } from '../../../components/ui/Modal';
import { phaseLabel } from '../../../domain/labels';
import type { GameState } from '../../../domain/models';
import { nextPhase } from '../../../domain/phaseTrack';
import { useAction } from '../../../hooks/useAction';
import { cx } from '../../../lib/cx';
import { toRoman } from '../../../lib/format';
import { useGame } from '../context/GameContext';
import { useDrama } from '../drama/DramaContext';
import { EliminationReveal, type Elimination } from './EliminationReveal';
import styles from './AdvanceBar.module.css';
import { fireAndForget } from '../../../lib/async';

/** Botão de avançar a simulação, com o que ainda falta registrar (ou simular, nas automáticas). */
export function AdvanceBar() {
  const { state, seasonId, refresh } = useGame();
  const { game, simulation } = useServices();
  const [revealed, setRevealed] = useState<Elimination | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const drama = useDrama();

  const advance = useAction(() => game.advance(seasonId), {
    success: (s) => (s.phase === 'FINALE' ? 'O jogo terminou' : `Agora: dia ${toRoman(s.day ?? 1)}, ${phaseLabel[s.phase!]}`),
  });
  const back = useAction(() => game.back(seasonId), {
    success: (s) => `De volta: dia ${toRoman(s.day ?? 1)}, ${phaseLabel[s.phase!]}`,
  });
  const simulate = useAction(() => simulation.simulate(seasonId));
  const simulateAll = useAction(() => simulation.simulate(seasonId, true), { success: 'Temporada simulada até a revelação final' });

  if (!state.day || !state.phase) return null;

  const automatic = state.season.mode !== 'MANUAL';
  const me = state.player;
  // No modo Jogador, só a simulação conta como "fase simulada" (as conversas do usuário não).
  const needsSimulation = automatic && !state.phaseSimulated && !me?.need;
  const playing = !!me && !me.spectator;
  const waitingDecision = playing && !!me.need;
  const next = nextPhase(state.day, state.phase, state.season.status === 'ENDGAME');
  const ready = !state.pendingRequirement;
  // Drama: só dá para avançar depois de ver toda a história do momento.
  const telling = !!drama && !drama.done;

  /** Mostra a saída de quem foi eliminado nesta fase (banido na mesa, morto na torre). No drama, ela vem na história. */
  function revealNewEliminations(after: GameState) {
    if (drama) return;
    const before = new Set(state.eliminatedPlayers.map((p) => p.id));
    const out = after.eliminatedPlayers.filter((p) => !before.has(p.id));
    const last = out.at(-1);
    if (last && last.status !== 'ACTIVE') setRevealed({ player: last, kind: last.status, role: last.role, roleHidden: last.roleHidden });
  }

  async function handleSimulate() {
    const result = await simulate.run();
    if (!result) return;
    revealNewEliminations(result);
    refresh();
  }

  async function handleBack() {
    if (await back.run()) refresh();
  }

  // Temporada manual: desfaz o último registro (a mesa redonda volta para a votação, a final volta para a mesa...).
  const backButton = state.canGoBack && (
    <Button variant="quiet" pending={back.pending} disabled={advance.pending} onClick={fireAndForget(handleBack)}>
      Voltar
    </Button>
  );

  async function handleAdvance() {
    if (await advance.run()) refresh();
  }

  async function handleSimulateAll() {
    setConfirmingAll(false);
    if (await simulateAll.run()) refresh();
  }

  if (state.phase === 'FINALE') {
    return backButton ? (
      <div className={styles.bar}>
        <p className={styles.status}>O jogo terminou. Dá para voltar e desfazer o último registro.</p>
        <div className={styles.buttons}>{backButton}</div>
      </div>
    ) : null;
  }

  return (
    <div className={cx(styles.bar, (ready || needsSimulation) && styles.ready)}>
      <div>
        <p className={styles.status}>
          {statusText({ telling, waitingDecision, needsSimulation, playing, ready, phaseName: phaseLabel[state.phase], pending: state.pendingRequirement })}
        </p>
        {next && (
          <p className={styles.next}>
            A seguir: {next.day !== state.day ? `dia ${toRoman(next.day)}, ` : ''}
            {phaseLabel[next.phase]}
          </p>
        )}
      </div>
      <div className={styles.buttons}>
        {automatic && !playing && (
          <Button variant="quiet" pending={simulateAll.pending} disabled={simulate.pending} onClick={() => setConfirmingAll(true)}>
            Simular até o fim
          </Button>
        )}
        {!waitingDecision && needsSimulation && (
          <Button size="lg" pending={simulate.pending} disabled={simulateAll.pending} onClick={fireAndForget(handleSimulate)}>
            {playing ? 'Continuar' : 'Simular'}
          </Button>
        )}
        {backButton}
        {!waitingDecision && !needsSimulation && (
          <Button size="lg" pending={advance.pending} disabled={back.pending || !ready || telling || simulateAll.pending} onClick={fireAndForget(handleAdvance)}>
            Avançar
          </Button>
        )}
      </div>

      <ConfirmModal open={confirmingAll} title="Simular o resto da temporada?" onClose={() => setConfirmingAll(false)} confirmLabel="Simular tudo" onConfirm={handleSimulateAll}>
        <p>Todas as fases serão simuladas e avançadas até a revelação final. A narrativa de cada dia fica na crônica.</p>
      </ConfirmModal>
      <EliminationReveal elimination={revealed} onClose={() => setRevealed(null)} />
    </div>
  );
}

/** A frase da barra: história em andamento, sua vez, pronto para simular/continuar, tudo registrado ou o que ainda falta. */
function statusText(o: { telling: boolean; waitingDecision: boolean; needsSimulation: boolean; playing: boolean; ready: boolean; phaseName: string; pending: string | null }): string | null {
  if (o.telling) return 'A história deste momento ainda não terminou: continue acima';
  if (o.waitingDecision) return 'Sua vez: faça a sua escolha acima';
  if (o.needsSimulation) return o.playing ? `Quando estiver pronto(a), continue: ${o.phaseName}` : `Pronto para simular: ${o.phaseName}`;
  return o.ready ? 'Tudo registrado nesta fase' : o.pending;
}
