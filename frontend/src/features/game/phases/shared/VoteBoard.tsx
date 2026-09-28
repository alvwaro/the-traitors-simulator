import { useState } from 'react';
import { Portrait } from '../../../../components/player/Portrait';
import { Button } from '../../../../components/ui/Button';
import { Select } from '../../../../components/ui/Form';
import type { Player } from '../../../../domain/models';
import { drawVotes, tally } from '../../../../domain/votes';
import { cx } from '../../../../lib/cx';
import type { VoteDraft } from '../../../../services/api/PhaseService';
import styles from './VoteBoard.module.css';

interface VoteBoardProps {
  players: Player[];
  value: VoteDraft[];
  onChange: (votes: VoteDraft[]) => void;
}

/**
 * Quadro de votação: cada jogador escolhe em quem vota.
 * Em caso de empate dá para abrir uma revotação (rodada 2, 3...).
 */
export function VoteBoard({ players, value, onChange }: Readonly<VoteBoardProps>) {
  const rounds = Math.max(1, ...value.map((v) => v.round));
  const [round, setRound] = useState(rounds);
  const byId = new Map(players.map((p) => [p.id, p]));

  const voteOf = (voterId: string) => value.find((v) => v.voterId === voterId && v.round === round)?.targetId ?? '';

  function setVote(voterId: string, targetId: string) {
    const rest = value.filter((v) => !(v.voterId === voterId && v.round === round));
    onChange(targetId ? [...rest, { voterId, targetId, round }] : rest);
  }

  function drawRound() {
    const others = value.filter((v) => v.round !== round);
    onChange([...others, ...drawVotes(players.map((p) => p.id), value, round)]);
  }

  function addRound() {
    setRound(rounds + 1);
    // Sem votos a nova rodada não existe; o primeiro voto a cria.
  }

  function removeRound(r: number) {
    onChange(value.filter((v) => v.round !== r).map((v) => (v.round > r ? { ...v, round: v.round - 1 } : v)));
    setRound(Math.max(1, r - 1));
  }

  const result = tally(value, round);
  const totalRounds = Math.max(rounds, round);

  return (
    <div className={styles.board}>
      <div className={styles.rounds} role="tablist">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={r === round} className={styles.roundTab} onClick={() => setRound(r)}>
            {r === 1 ? 'Votação' : `Revotação ${r - 1}`}
          </button>
        ))}
        <Button variant="ghost" size="sm" className={styles.drawButton} onClick={drawRound}>
          Sortear votos
        </Button>
        <Button variant="quiet" size="sm" onClick={addRound} disabled={!value.some((v) => v.round === totalRounds)}>
          Abrir revotação
        </Button>
        {round > 1 && (
          <Button variant="quiet" size="sm" onClick={() => removeRound(round)}>
            Descartar rodada
          </Button>
        )}
      </div>

      <div className={styles.grid}>
        <ul className={styles.ballots}>
          {players.map((voter) => (
            <li key={voter.id} className={styles.ballot}>
              <Portrait name={voter.name} imageUrl={voter.imageUrl} size="xs" hideName />
              <div className={styles.ballotBody}>
                <span className={styles.voter}>{voter.name}</span>
                <Select value={voteOf(voter.id)} onChange={(e) => setVote(voter.id, e.target.value)} aria-label={`Voto de ${voter.name}`}>
                <option value="">Sem voto</option>
                {players
                  .filter((p) => p.id !== voter.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            </li>
          ))}
        </ul>

        <div className={styles.tally}>
          <h4 className={styles.tallyTitle}>Apuração</h4>
          {result.counts.length === 0 ? (
            <p className={styles.empty}>Votos opcionais.</p>
          ) : (
            <ol className={styles.bars}>
              {result.counts.map(([id, count]) => (
                <li key={id} className={cx(styles.barRow, result.leaders.includes(id) && styles.leader)}>
                  <span className={styles.barName}>{byId.get(id)?.name ?? '?'}</span>
                  <span className={styles.bar} style={{ width: `${(count / result.counts[0][1]) * 100}%` }} />
                  <span className={styles.barCount}>{count}</span>
                </li>
              ))}
            </ol>
          )}
          {result.leaders.length > 1 && <p className={styles.tie}>Empate.</p>}
        </div>
      </div>
    </div>
  );
}
