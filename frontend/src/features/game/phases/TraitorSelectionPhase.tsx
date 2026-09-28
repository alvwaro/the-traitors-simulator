import { useState } from 'react';
import { useServices } from '../../../app/services';
import { PortraitGrid, toggleIn } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Form';
import { useAction } from '../../../hooks/useAction';
import { sample } from '../../../lib/random';
import { useGame } from '../context/GameContext';
import styles from './shared/Shared.module.css';
import { fireAndForget } from '../../../lib/async';

/** Sugestão de quantos traidores sortear: cerca de 1 para cada 6 jogadores (de 1 a 4). */
const suggestedTraitors = (players: number) => Math.max(1, Math.min(4, Math.round(players / 6)));

/** Clique nas fotos para escolher os traidores originais, ou sorteie. */
export function TraitorSelectionPhase() {
  const { state, seasonId, refresh } = useGame();
  const { phases } = useServices();
  const active = state.activePlayers;
  const confirmed = active.filter((p) => p.role === 'TRAITOR').map((p) => p.id);
  const [selected, setSelected] = useState(confirmed);
  const [drawCount, setDrawCount] = useState(String(suggestedTraitors(active.length)));
  const unchanged = selected.length === confirmed.length && selected.every((id) => confirmed.includes(id));
  const count = Number(drawCount);
  const canDraw = Number.isInteger(count) && count >= 1 && count < active.length;

  const save = useAction(() => phases.selectTraitors(seasonId, selected), { success: 'Traidores escolhidos' });

  return (
    <>
      <div className={styles.drawBar}>
        <Input type="number" min={1} max={active.length - 1} value={drawCount} onChange={(e) => setDrawCount(e.target.value)} aria-label="Quantidade de traidores" className={styles.drawCount} />
        <Button variant="ghost" disabled={!canDraw} onClick={() => setSelected(sample(active, count).map((p) => p.id))}>
          Sortear traidores
        </Button>
      </div>

      <PortraitGrid items={active} selectedIds={selected} onToggle={(id) => setSelected((list) => toggleIn(list, id))} caption={(p) => (selected.includes(p.id) ? 'Traidor' : null)} />

      <div className={styles.submitRow}>
        <span className={styles.muted}>
          {selected.length} traidores · {active.length - selected.length} fiéis
        </span>
        <Button pending={save.pending} disabled={!selected.length || selected.length >= active.length || unchanged} onClick={fireAndForget(async () => (await save.run()) && refresh())}>
          Confirmar traidores
        </Button>
      </div>
    </>
  );
}
