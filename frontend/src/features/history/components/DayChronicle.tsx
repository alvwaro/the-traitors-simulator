import { phaseLabel, roleLabel } from '../../../domain/labels';
import type { DayHistory, MissionRecord, Player, RoundTableRecord } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { formatMoney, toRoman } from '../../../lib/format';
import { EventFeed } from '../../game/auto/EventFeed';
import type { GamePhase } from '../../../domain/enums';
import styles from './Chronicle.module.css';

interface DayChronicleProps {
  day: DayHistory;
  playersById: Map<string, Player>;
  currency: string;
}

/** Um dia da temporada contado em ordem: fases, missões, mesas e a noite. */
export function DayChronicle({ day, playersById, currency }: Readonly<DayChronicleProps>) {
  const name = (id: string) => playersById.get(id)?.name ?? 'alguém';
  const notes = day.phases.filter((p) => p.notes);

  return (
    <article className={styles.day}>
      <h2 className={styles.dayTitle}>
        Dia <span>{toRoman(day.day.number)}</span>
      </h2>

      {notes.map((p) => (
        <section key={p.id} className={styles.entry}>
          <h3 className={styles.entryTitle}>{phaseLabel[p.phase]}</h3>
          <p className={styles.prose}>{p.notes}</p>
        </section>
      ))}

      {day.missions.map((m) => (
        <section key={m.id} className={styles.entry}>
          <h3 className={styles.entryTitle}>Missão · {m.name}</h3>
          <p>
            {formatMoney(m.prizeEarned, currency)} para o prêmio
            {m.prizeAvailable !== null ? ` (de ${formatMoney(m.prizeAvailable, currency)})` : ''}.{' '}
            {shieldsLine(m, name)}
          </p>
          {m.description && <p className={styles.prose}>{m.description}</p>}
        </section>
      ))}

      {day.roundTables.map((rt) => (
        <RoundTableEntry key={rt.id} record={rt} name={name} playersById={playersById} />
      ))}

      {phasesWithEvents(day).map((phase) => (
        <details key={phase} className={styles.story}>
          <summary className={styles.storySummary}>Narrativa · {phaseLabel[phase]}</summary>
          <EventFeed events={day.events.filter((e) => e.phase === phase)} playersById={playersById} />
        </details>
      ))}

      {day.traitorsMeeting && (
        <section className={cx(styles.entry, styles.night)}>
          <h3 className={styles.entryTitle}>Conclave dos Traidores</h3>
          <p>
            {murderText(day.traitorsMeeting.murder, name)}
          </p>
          {day.traitorsMeeting.recruitments.map((r) => (
            <p key={r.id}>
              {name(r.targetId)} {r.outcome === 'ACCEPTED' ? 'aceitou' : 'recusou'} {r.isUltimatum ? 'o ultimato' : 'o convite para trair'}.
            </p>
          ))}
          {day.traitorsMeeting.notes && <p className={styles.prose}>{day.traitorsMeeting.notes}</p>}
        </section>
      )}
    </article>
  );
}

/** Fases do dia que têm narrativa da simulação automática, na ordem em que aconteceram. */
function phasesWithEvents(day: DayHistory): GamePhase[] {
  return [...new Set(day.events.map((e) => e.phase))];
}

function RoundTableEntry({ record, name, playersById }: Readonly<{ record: RoundTableRecord; name: (id: string) => string; playersById: Map<string, Player> }>) {
  const rounds = [...new Set(record.votes.map((v) => v.round))].sort((a, b) => a - b);
  const banished = record.banishedPlayerId ? playersById.get(record.banishedPlayerId) : undefined;
  const title = record.kind === 'ENDGAME' ? `Mesa Final · rodada ${record.sequence}` : 'Mesa Redonda';

  return (
    <section className={styles.entry}>
      <h3 className={styles.entryTitle}>{title}</h3>
      {record.endgameVotes.length > 0 && (
        <p>
          Encerrar: {record.endgameVotes.filter((v) => v.choice === 'END_GAME').map((v) => name(v.voterId)).join(', ') || 'ninguém'}.{' '}
          Banir de novo: {record.endgameVotes.filter((v) => v.choice === 'BANISH_AGAIN').map((v) => name(v.voterId)).join(', ') || 'ninguém'}.
        </p>
      )}
      {rounds.map((round) => (
        <table key={round} className={styles.votes}>
          <caption>{round === 1 ? 'Votos' : `Revotação ${round - 1}`}</caption>
          <tbody>
            {record.votes
              .filter((v) => v.round === round)
              .map((v) => (
                <tr key={v.id}>
                  <td>{name(v.voterId)}</td>
                  <td>votou em</td>
                  <td>{name(v.targetId)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ))}
      {banished ? (
        <p className={styles.verdict}>
          {banished.roleHidden ? (
            <>
              {banished.name} foi banido(a) e saiu sem revelar o papel
              {!banished.roleUnknown && (
                <>
                  {' '}
                  (quem assiste sabe: <strong className={banished.role === 'TRAITOR' ? styles.traitor : undefined}>{roleLabel[banished.role]}</strong>)
                </>
              )}
              .
            </>
          ) : (
            <>
              {banished.name} foi banido(a) e revelou ser <strong className={banished.role === 'TRAITOR' ? styles.traitor : undefined}>{roleLabel[banished.role]}</strong>.
            </>
          )}
        </p>
      ) : (
        record.kind === 'ENDGAME' && <p className={styles.verdict}>Unanimidade: o jogo foi encerrado.</p>
      )}
      {record.notes && <p className={styles.prose}>{record.notes}</p>}
    </section>
  );
}

/** O que a noite fez: ninguém morreu, alguém morreu ou o escudo salvou o alvo. */
function murderText(murder: { targetId: string; outcome: string } | null, name: (id: string) => string): string {
  if (!murder) return 'Ninguém foi assassinado.';
  if (murder.outcome === 'SUCCESS') return `${name(murder.targetId)} foi assassinado(a).`;
  return `${name(murder.targetId)} foi o alvo, mas estava protegido(a) por escudo.`;
}

/** Quem ganhou escudo na missão; escudo escondido aparece como "?". */
function shieldsLine(mission: MissionRecord, name: (id: string) => string): string {
  if (mission.rewards.length === 0) return 'Ninguém ganhou escudo.';
  if (mission.shieldsHidden) return 'Escudo misterioso.';
  return `Escudos: ${mission.rewards.map((r) => (r.hidden ? '?' : name(r.playerId))).join(', ')}.`;
}
