import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import type { RoundTableRecord } from '../../../domain/models';
import { tally } from '../../../domain/votes';
import { useAction } from '../../../hooks/useAction';
import type { RoundTableInput } from '../../../services/api/PhaseService';
import { EliminationReveal, type Elimination } from '../components/EliminationReveal';
import { useGame } from '../context/GameContext';
import { BanishmentPicker, banishmentOf, useBallot } from './shared/Banishment';
import styles from './shared/Shared.module.css';
import { BanishedRole } from '../components/BanishedRole';
import { fireAndForget } from '../../../lib/async';

export function RoundTablePhase() {
  const { today } = useGame();
  const [revealed, setRevealed] = useState<Elimination | null>(null);
  const existing = today?.roundTables.find((t) => t.kind === 'REGULAR');

  return (
    <>
      {existing ? <RoundTableResult record={existing} /> : <RoundTableForm onBanished={setRevealed} />}
      <EliminationReveal elimination={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}

export function RoundTableResult({ record }: Readonly<{ record: RoundTableRecord }>) {
  const { playersById } = useGame();
  const banished = record.banishedPlayerId ? playersById.get(record.banishedPlayerId) : undefined;
  const result = tally(record.votes);
  if (!banished) return null;

  return (
    <div className={styles.result}>
      <Portrait name={banished.name} imageUrl={banished.imageUrl} status="BANISHED" size="lg" hideName />
      <div className={styles.resultText}>
        <p className={styles.resultTitle}>{banished.name} foi banido(a)</p>
        <p>
          <BanishedRole player={banished} traitorClass={styles.traitorText} faithfulClass={styles.faithfulText} />
        </p>
        {result.counts.length > 0 && (
          <p className={styles.resultMeta}>{result.counts.map(([id, n]) => `${playersById.get(id)?.name ?? '?'} ${n}`).join(' · ')}</p>
        )}
      </div>
    </div>
  );
}

function RoundTableForm({ onBanished }: Readonly<{ onBanished: (e: Elimination) => void }>) {
  const { state, seasonId, refresh } = useGame();
  const { phases } = useServices();
  const ballot = useBallot();
  const banished = state.activePlayers.find((p) => p.id === ballot.banishedId);

  const save = useAction((input: RoundTableInput) => phases.roundTable(seasonId, input));

  async function handleSubmit() {
    if (!banished) return;
    const record = await save.run({ banishedPlayerId: banished.id, votes: ballot.votes });
    if (record) {
      onBanished(banishmentOf(banished, record));
      refresh();
    }
  }

  return (
    <div className={styles.formStack}>
      <BanishmentPicker players={state.activePlayers} ballot={ballot} markLeaders />

      <div className={styles.submitRow}>
        <Button pending={save.pending} disabled={!banished} onClick={fireAndForget(handleSubmit)}>
          {banished ? `Banir ${banished.name}` : 'Escolha quem será banido(a)'}
        </Button>
      </div>
    </div>
  );
}
