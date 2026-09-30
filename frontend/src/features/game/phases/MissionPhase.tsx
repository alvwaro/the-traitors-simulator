import { useState, type SubmitEvent } from 'react';
import { useServices } from '../../../app/services';
import { PortraitGrid, toggleIn } from '../../../components/player/PortraitGrid';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { Field, FormRow, Input } from '../../../components/ui/Form';
import { ShieldIcon } from '../../../components/ui/Icons';
import type { MissionRecord } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { formatMoney } from '../../../lib/format';
import { sample } from '../../../lib/random';
import type { MissionInput } from '../../../services/api/PhaseService';
import { useGame } from '../context/GameContext';
import { ConversationFeed } from '../phrases/ConversationFeed';
import { useShareShields } from '../story/StoryContext';
import styles from './shared/Shared.module.css';
import { fireAndForget } from '../../../lib/async';

export function MissionPhase() {
  const { today } = useGame();
  const missions = today?.missions ?? [];
  const [adding, setAdding] = useState(false);

  return (
    <>
      {missions.map((m) => (
        <MissionSummary key={m.id} mission={m} />
      ))}
      {missions.length === 0 || adding ? (
        <MissionForm onDone={() => setAdding(false)} />
      ) : (
        <div className={styles.actions} style={{ marginTop: '1rem' }}>
          <Button variant="quiet" onClick={() => setAdding(true)}>
            Registrar outra missão
          </Button>
        </div>
      )}
      <ConversationFeed phase="MISSION" />
    </>
  );
}

export function MissionSummary({ mission }: Readonly<{ mission: MissionRecord }>) {
  const { playersById, state } = useGame();
  // Escudo misterioso: ninguém (nem quem assiste) sabe quem ficou protegido.
  const hidden = !!mission.shieldsHidden;
  const shielded = hidden ? [] : mission.rewards.flatMap((r) => playersById.get(r.playerId) ?? []);
  return (
    <div className={styles.section}>
      <div className={styles.result}>
        <div className={styles.resultText} style={{ textAlign: 'center' }}>
          <p className={styles.resultTitle}>{mission.name}</p>
          <p className={styles.resultMeta}>
            +{formatMoney(mission.prizeEarned, state.season.currency)} · {hidden ? 'escudo misterioso' : `${shielded.length} escudo(s)`}
          </p>
        </div>
      </div>
      {shielded.length > 0 && <PortraitGrid items={shielded} size="sm" badge={() => <ShieldIcon size={13} />} />}
      {hidden && (
        <div className={styles.mysteryShield}>
          <Portrait name="?" imageUrl={null} mystery size="sm" badge={<ShieldIcon size={13} />} caption="Escudo misterioso" />
        </div>
      )}
    </div>
  );
}

function MissionForm({ onDone }: Readonly<{ onDone: () => void }>) {
  const { state, history, seasonId, refresh } = useGame();
  const { phases } = useServices();
  const missionCount = history.days.reduce((total, d) => total + d.missions.length, 0);
  const [name, setName] = useState('');
  const [prizeEarned, setPrizeEarned] = useState('');
  const [shields, setShields] = useState<string[]>([]);
  const [drawCount, setDrawCount] = useState('1');
  useShareShields(shields);

  const players = state.activePlayers;
  const toDraw = Math.min(Math.max(Math.floor(Number(drawCount) || 0), 0), players.length);

  function drawShields() {
    setShields(sample(players, toDraw).map((p) => p.id));
  }

  const save = useAction((input: MissionInput) => phases.mission(seasonId, input), { success: 'Missão registrada' });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (await save.run({ name: name.trim() || null, prizeEarned: Number(prizeEarned || 0), shieldedPlayerIds: shields })) {
      onDone();
      refresh();
    }
  }

  return (
    <form className={styles.formStack} onSubmit={fireAndForget(handleSubmit)}>
      <FormRow>
        <Field label="Missão">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={`Missão ${String(missionCount + 1).padStart(2, '0')}`} />}</Field>
        <Field label="Dinheiro ganho">{(id) => <Input id={id} type="number" min={0} step="0.01" value={prizeEarned} onChange={(e) => setPrizeEarned(e.target.value)} placeholder="0" />}</Field>
      </FormRow>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Escudos</h3>
        <div className={styles.drawRow}>
          <Field label="Quantos sortear">
            {(id) => <Input id={id} type="number" min={1} max={players.length} step={1} value={drawCount} onChange={(e) => setDrawCount(e.target.value)} />}
          </Field>
          <Button variant="ghost" disabled={toDraw < 1} onClick={drawShields}>
            <ShieldIcon size={14} /> Sortear escudos
          </Button>
          {shields.length > 0 && (
            <Button variant="quiet" onClick={() => setShields([])}>
              Limpar
            </Button>
          )}
        </div>
        <PortraitGrid
          items={players}
          size="sm"
          selectedIds={shields}
          onToggle={(id) => setShields((list) => toggleIn(list, id))}
          badge={(p) => (shields.includes(p.id) ? <ShieldIcon size={13} /> : null)}
        />
      </div>

      <div className={styles.submitRow}>
        <Button type="submit" pending={save.pending}>
          Registrar missão
        </Button>
      </div>
    </form>
  );
}
