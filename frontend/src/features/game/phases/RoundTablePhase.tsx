import { useMemo, useState } from 'react';
import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import type { RoundTableRecord } from '../../../domain/models';
import { tally } from '../../../domain/votes';
import { useAction } from '../../../hooks/useAction';
import type { RoundTableInput, VoteDraft } from '../../../services/api/PhaseService';
import { EliminationReveal, type Elimination } from '../components/EliminationReveal';
import { useGame } from '../context/GameContext';
import { useShareVotes } from '../story/StoryContext';
import { VoteBoard } from './shared/VoteBoard';
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
  const [votes, setVotes] = useState<VoteDraft[]>([]);
  useShareVotes(votes);
  const [chosen, setChosen] = useState<string | null>(null);

  const leaders = useMemo(() => tally(votes).leaders, [votes]);
  // Sem escolha manual, o mais votado (sem empate) é sugerido.
  const banishedId = chosen ?? (leaders.length === 1 ? leaders[0] : null);
  const banished = state.activePlayers.find((p) => p.id === banishedId);

  const save = useAction((input: RoundTableInput) => phases.roundTable(seasonId, input));

  async function handleSubmit() {
    if (!banished) return;
    const record = await save.run({ banishedPlayerId: banished.id, votes });
    if (record) {
      onBanished({ player: banished, kind: 'BANISHED', role: record.revealedRole ?? banished.role });
      refresh();
    }
  }

  return (
    <div className={styles.formStack}>
      <VoteBoard players={state.activePlayers} value={votes} onChange={setVotes} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Banido(a)</h3>
        <PortraitGrid
          items={state.activePlayers}
          size="sm"
          selectedIds={banishedId ? [banishedId] : []}
          onToggle={(id) => setChosen(id === banishedId ? null : id)}
          caption={(p) => (leaders.includes(p.id) ? 'Mais votado(a)' : null)}
        />
      </div>

      <div className={styles.submitRow}>
        <Button pending={save.pending} disabled={!banished} onClick={fireAndForget(handleSubmit)}>
          {banished ? `Banir ${banished.name}` : 'Escolha quem será banido(a)'}
        </Button>
      </div>
    </div>
  );
}
