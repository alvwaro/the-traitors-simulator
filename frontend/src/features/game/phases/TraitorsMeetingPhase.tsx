import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { Check } from '../../../components/ui/Form';
import { ShieldIcon } from '../../../components/ui/Icons';
import type { TraitorMeetingRecord } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import type { TraitorsMeetingInput } from '../../../services/api/PhaseService';
import { EliminationReveal, type Elimination } from '../components/EliminationReveal';
import { useGame } from '../context/GameContext';
import styles from './shared/Shared.module.css';
import { fireAndForget } from '../../../lib/async';

export function TraitorsMeetingPhase() {
  const { today, state } = useGame();
  const [revealed, setRevealed] = useState<Elimination | null>(null);
  const traitors = state.activePlayers.filter((p) => p.role === 'TRAITOR');

  return (
    <>
      <div className={styles.section} style={{ marginTop: 0 }}>
        <h3 className={styles.sectionTitle}>Traidores</h3>
        {traitors.length ? <PortraitGrid items={traitors} size="sm" /> : <p className={styles.muted}>Nenhum traidor restante. Pode avançar.</p>}
      </div>
      {today?.traitorsMeeting ? <MeetingResult meeting={today.traitorsMeeting} /> : traitors.length > 0 && <MeetingForm onMurder={setRevealed} />}
      <EliminationReveal elimination={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}

export function MeetingResult({ meeting }: Readonly<{ meeting: TraitorMeetingRecord }>) {
  const { playersById } = useGame();
  const target = meeting.murder ? playersById.get(meeting.murder.targetId) : undefined;
  const killed = meeting.murder?.outcome === 'SUCCESS';

  return (
    <div className={styles.section}>
      {target ? (
        <div className={styles.result}>
          <Portrait name={target.name} imageUrl={target.imageUrl} status={killed ? 'MURDERED' : undefined} size="lg" hideName />
          <div className={styles.resultText}>
            <p className={styles.resultTitle}>{killed ? `${target.name} foi assassinado(a)` : `${target.name} escapou`}</p>
            {!killed && <p className={styles.resultMeta}>Protegido(a) pelo escudo.</p>}
          </div>
        </div>
      ) : (
        <p className={styles.center}>Sem assassinato esta noite.</p>
      )}
      {meeting.recruitments.map((r) => (
        <p key={r.id} className={styles.center}>
          {playersById.get(r.targetId)?.name} {r.outcome === 'ACCEPTED' ? 'aceitou' : 'recusou'} {r.isUltimatum ? 'o ultimato' : 'o recrutamento'}.
        </p>
      ))}
    </div>
  );
}

function MeetingForm({ onMurder }: Readonly<{ onMurder: (e: Elimination) => void }>) {
  const { state, today, seasonId, refresh, playersById } = useGame();
  const { phases } = useServices();
  const faithful = state.activePlayers.filter((p) => p.role !== 'TRAITOR');
  const shielded = new Set(today?.missions.flatMap((m) => m.rewards.map((r) => r.playerId)) ?? []);

  const [murderId, setMurderId] = useState<string | null>(null);
  const [recruiting, setRecruiting] = useState(false);
  const [recruitId, setRecruitId] = useState<string | null>(null);
  const [ultimatum, setUltimatum] = useState(false);
  const [accepted, setAccepted] = useState(true);

  const save = useAction((input: TraitorsMeetingInput) => phases.traitorsMeeting(seasonId, input), {
    success: (m) => (m.murder?.outcome === 'BLOCKED_BY_SHIELD' ? 'O alvo tinha escudo' : 'Reunião registrada'),
  });

  async function handleSubmit() {
    const result = await save.run({
      murderTargetId: murderId,
      recruitment: recruiting && recruitId ? { targetId: recruitId, accepted, isUltimatum: ultimatum } : null,
    });
    if (!result) return;
    const victim = result.murder?.outcome === 'SUCCESS' ? playersById.get(result.murder.targetId) : undefined;
    if (victim) onMurder({ player: victim, kind: 'MURDERED', role: victim.role });
    refresh();
  }

  return (
    <div className={styles.formStack}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Alvo</h3>
        <PortraitGrid
          items={faithful}
          size="sm"
          selectedIds={murderId ? [murderId] : []}
          onToggle={(id) => setMurderId(id === murderId ? null : id)}
          isDisabled={(p) => recruiting && p.id === recruitId}
          badge={(p) => (shielded.has(p.id) ? <ShieldIcon size={13} title="Escudo" /> : null)}
        />
      </div>

      <div className={styles.section}>
        <Check label="Recrutamento" checked={recruiting} onChange={(e) => setRecruiting(e.target.checked)} />
        {recruiting && (
          <>
            <PortraitGrid
              items={faithful}
              size="sm"
              selectedIds={recruitId ? [recruitId] : []}
              onToggle={(id) => setRecruitId(id === recruitId ? null : id)}
              isDisabled={(p) => p.id === murderId}
            />
            <div className={styles.actions} style={{ justifyContent: 'center', gap: '1.4rem' }}>
              <Check label="Ultimato" checked={ultimatum} onChange={(e) => setUltimatum(e.target.checked)} />
              <Check type="radio" name="recruit-answer" label="Aceitou" checked={accepted} onChange={() => setAccepted(true)} />
              <Check type="radio" name="recruit-answer" label="Recusou" checked={!accepted} onChange={() => setAccepted(false)} />
            </div>
          </>
        )}
      </div>

      <div className={styles.submitRow}>
        <Button pending={save.pending} disabled={recruiting && !recruitId} onClick={fireAndForget(handleSubmit)}>
          {murderId ? `Assassinar ${faithful.find((p) => p.id === murderId)?.name}` : 'Confirmar sem assassinato'}
        </Button>
      </div>
    </div>
  );
}
