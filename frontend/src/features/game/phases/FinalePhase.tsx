import { Link } from 'react-router-dom';
import { Portrait } from '../../../components/player/Portrait';
import { cx } from '../../../lib/cx';
import { formatMoney } from '../../../lib/format';
import { useGame } from '../context/GameContext';
import styles from './shared/Shared.module.css';

/** Revelação final: quem ficou com o prêmio. */
export function FinalePhase() {
  const { state, playersById, seasonId } = useGame();
  const winners = state.winners.flatMap((w) => {
    const player = playersById.get(w.playerId);
    return player ? [{ ...w, player }] : [];
  });
  const traitorsWon = winners.some((w) => w.player.role === 'TRAITOR');

  return (
    <>
      <p className={cx(styles.verdict, traitorsWon ? styles.verdictTraitors : styles.verdictFaithful)}>
        {verdictOf(winners.length, traitorsWon)}
      </p>
      <div className={styles.winners}>
        {winners.map((w) => (
          <Portrait key={w.playerId} name={w.player.name} imageUrl={w.player.imageUrl} size="lg" caption={formatMoney(w.prizeShare, state.season.currency)} />
        ))}
      </div>
      <p className={cx(styles.center, styles.muted)}>
        Prêmio total {formatMoney(state.prizePot, state.season.currency)} · <Link to={`/temporadas/${seasonId}/cronica`}>ver crônica</Link>
      </p>
    </>
  );
}

function verdictOf(winners: number, traitorsWon: boolean): string {
  if (winners === 0) return 'Ninguém venceu';
  return traitorsWon ? 'Os Traidores venceram' : 'Os Fiéis venceram';
}
