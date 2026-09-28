import { useMemo, useState } from 'react';
import { PortraitGrid } from '../../../../components/player/PortraitGrid';
import { Button } from '../../../../components/ui/Button';
import { renderEvent } from '../../../../domain/events';
import type { Player, PlayerView, SimulationEventRecord } from '../../../../domain/models';
import { fireAndForget } from '../../../../lib/async';
import { cx } from '../../../../lib/cx';
import { EventFeed } from '../../auto/EventFeed';
import { useGame } from '../../context/GameContext';
import { toggleOne, useDecision, type OnResult } from '../useDecision';
import styles from '../Player.module.css';

/**
 * Missão interativa: o que já aconteceu na missão e a escolha da vez (portas, pontões, retratos...).
 * Cada resposta faz a missão continuar até a próxima escolha ou até o fim.
 */
export function MissionPanel({ me, onResult }: Readonly<{ me: PlayerView; onResult: OnResult }>) {
  const { seasonId, playersById, today } = useGame();
  const { send, pending } = useDecision(onResult);
  const [person, setPerson] = useState<string | null>(null);
  const mission = me.mission;

  // O que já aconteceu, no formato dos acontecimentos gravados (para reaproveitar a narrativa).
  const preview = useMemo<SimulationEventRecord[]>(
    () =>
      (mission?.preview ?? []).map((e, i) => ({
        ...e,
        id: `mission-preview-${i}`,
        seasonId,
        dayId: today?.day.id ?? '',
        phase: 'MISSION',
        sequence: i + 1,
        createdAt: '',
      })),
    [mission, seasonId, today],
  );
  if (!mission) return null;

  const people = mission.options.filter((o) => o.playerId).map((o) => playersById.get(o.playerId!)).filter((p): p is Player => !!p);
  const plain = mission.options.filter((o) => !o.playerId);
  const chosen = people.find((p) => p.id === person);
  const answer = (id: string) =>
    fireAndForget(async () => {
      setPerson(null);
      await send({ missionAnswer: id });
    });

  return (
    <>
      {preview.length > 0 && <EventFeed events={preview} playersById={playersById} />}
      <section className={cx(styles.panel, styles.mission)}>
        <h3 className={styles.panelTitle}>Sua vez na missão</h3>
        <p className={styles.missionPrompt}>
          <Prompt text={mission.prompt} playerIds={mission.playerIds} playersById={playersById} />
        </p>
        {people.length > 0 && <PortraitGrid items={people} size="sm" selectedIds={person ? [person] : []} onToggle={(id) => setPerson(toggleOne(person, id))} />}
        <div className={styles.panelActions}>
          {plain.map((o) => (
            <Button key={o.id} variant={people.length ? 'quiet' : undefined} pending={pending} onClick={answer(o.id)}>
              {o.label}
            </Button>
          ))}
          {people.length > 0 && (
            <Button pending={pending} disabled={!chosen} onClick={answer(chosen?.id ?? '')}>
              {chosen ? `Escolher ${chosen.name}` : 'Escolha alguém'}
            </Button>
          )}
        </div>
      </section>
    </>
  );
}

/** Enunciado com os nomes no lugar de {user}, {user1}... */
function Prompt({ text, playerIds, playersById }: Readonly<{ text: string; playerIds: string[]; playersById: Map<string, Player> }>) {
  const { parts } = renderEvent({ id: 'prompt', seasonId: '', dayId: '', phase: 'MISSION', sequence: 0, kind: 'MISSION_STEP', tone: null, text, playerIds, createdAt: '' }, playersById);
  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'text' ? <span key={`t${i}`}>{part.text}</span> : <strong key={`p${i}`}>{part.player.name}</strong>,
      )}
    </>
  );
}
