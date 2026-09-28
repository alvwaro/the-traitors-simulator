import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Form';
import { Modal } from '../../../components/ui/Modal';
import { Panel } from '../../../components/ui/Panel';
import { GamePhase } from '../../../domain/enums';
import { ENDGAME_MAX_ACTIVE_PLAYERS } from '../../../domain/rules';
import { useAction } from '../../../hooks/useAction';
import { formatMoney } from '../../../lib/format';
import type { PrizeAdjustmentInput } from '../../../services/api/SeasonService';
import { SaveAsCastModal } from '../../seasons/components/SaveAsCastModal';
import { useGame } from '../context/GameContext';
import { EliminationReveal, type Elimination } from './EliminationReveal';
import styles from './ManagerTools.module.css';
import { fireAndForget } from '../../../lib/async';

const ENDGAME_PHASES: GamePhase[] = [GamePhase.BREAKFAST, GamePhase.MISSION, GamePhase.ROUND_TABLE, GamePhase.TRAITORS_MEETING];

/** Ações fora do fluxo normal, no fim da página. */
export function ManagerTools() {
  const { state } = useGame();
  const [savingCast, setSavingCast] = useState(false);
  const running = state.season.status === 'IN_PROGRESS' || state.season.status === 'ENDGAME';

  return (
    <Panel title="Ferramentas" actions={<Button variant="ghost" size="sm" onClick={() => setSavingCast(true)}>Salvar elenco como cast</Button>}>
      {running && (
        <div className={styles.grid}>
          <EndgameControl />
          <PrizeAdjustment />
          <Withdrawal />
        </div>
      )}
      <SaveAsCastModal open={savingCast} seasonId={state.season.id} defaultName={`Elenco de ${state.season.name}`} onClose={() => setSavingCast(false)} />
    </Panel>
  );
}

function EndgameControl() {
  const { state, seasonId, refresh } = useGame();
  const { game } = useServices();
  const [confirming, setConfirming] = useState(false);
  const start = useAction(() => game.startEndgame(seasonId), { success: 'A final começou' });
  const remaining = state.activePlayers.length;

  if (state.season.status === 'ENDGAME') {
    return (
      <section className={styles.tool}>
        <h3 className={styles.toolTitle}>Final</h3>
        <p className={styles.note}>Em andamento.</p>
      </section>
    );
  }

  const enoughPlayers = remaining <= ENDGAME_MAX_ACTIVE_PLAYERS;
  const allowed = enoughPlayers && !!state.phase && ENDGAME_PHASES.includes(state.phase);

  return (
    <section className={styles.tool}>
      <h3 className={styles.toolTitle}>Final</h3>
      <p className={styles.note}>
        {enoughPlayers ? `${remaining} jogadores restantes.` : `Libera com ${ENDGAME_MAX_ACTIVE_PLAYERS} jogadores (restam ${remaining}).`}
      </p>
      <Button variant="danger" disabled={!allowed} onClick={() => setConfirming(true)}>
        Iniciar a final
      </Button>
      <Modal
        open={confirming}
        title="Iniciar a final?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button pending={start.pending} onClick={fireAndForget(async () => {
                if (await start.run()) refresh();
                setConfirming(false);
              })}>
              Iniciar
            </Button>
          </>
        }
      >
        <p>A próxima mesa redonda passa a ser a Mesa Final.</p>
      </Modal>
    </section>
  );
}

function PrizeAdjustment() {
  const { state, seasonId, refresh } = useGame();
  const { seasons } = useServices();
  const [type, setType] = useState<PrizeAdjustmentInput['type']>('PENALTY');
  const [amount, setAmount] = useState('');
  const adjust = useAction((input: PrizeAdjustmentInput) => seasons.adjustPrize(seasonId, input), {
    success: (r) => `Prêmio: ${formatMoney(r.prizePot, state.season.currency)}`,
  });

  async function handleSubmit() {
    if (await adjust.run({ type, amount: Number(amount) })) {
      setAmount('');
      refresh();
    }
  }

  return (
    <section className={styles.tool}>
      <h3 className={styles.toolTitle}>Prêmio</h3>
      <div className={styles.row}>
        <Select value={type} onChange={(e) => setType(e.target.value as PrizeAdjustmentInput['type'])} aria-label="Tipo">
          <option value="PENALTY">Penalidade</option>
          <option value="ADJUSTMENT">Ajuste</option>
        </Select>
        <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor" aria-label="Valor" />
      </div>
      <Button variant="ghost" pending={adjust.pending} disabled={!Number(amount)} onClick={fireAndForget(handleSubmit)}>
        Aplicar
      </Button>
    </section>
  );
}

function Withdrawal() {
  const { state, seasonId, refresh } = useGame();
  const { players } = useServices();
  const [playerId, setPlayerId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState<Elimination | null>(null);
  const withdraw = useAction(() => players.withdraw(seasonId, playerId));
  const player = state.activePlayers.find((p) => p.id === playerId);

  async function handleConfirm() {
    const result = await withdraw.run();
    setConfirming(false);
    if (result) {
      setRevealed({ player: result, kind: 'WITHDRAWN', role: result.role });
      setPlayerId('');
      refresh();
    }
  }

  return (
    <section className={styles.tool}>
      <h3 className={styles.toolTitle}>Desistência</h3>
      <Field label="Jogador">
        {(id) => (
          <Select id={id} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Escolha</option>
            {state.activePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button variant="danger" disabled={!player} onClick={() => setConfirming(true)}>
        Registrar saída
      </Button>
      <Modal
        open={confirming}
        title={`${player?.name ?? ''} vai deixar o jogo?`}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="danger" pending={withdraw.pending} onClick={fireAndForget(handleConfirm)}>
              Confirmar
            </Button>
          </>
        }
      >
        <p>Não dá para desfazer.</p>
      </Modal>
      <EliminationReveal elimination={revealed} onClose={() => setRevealed(null)} />
    </section>
  );
}
