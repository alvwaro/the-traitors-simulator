import { fireAndForget } from '../../../lib/async';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { phaseLabel } from '../../../domain/labels';
import { formatMoney, toRoman } from '../../../lib/format';
import { DeleteSeasonModal, EditSeasonModal } from '../../seasons/components/SeasonModals';
import { useGame } from '../context/GameContext';
import styles from './GameHeader.module.css';

export function GameHeader() {
  const { state, seasonId, refresh } = useGame();
  const { season } = state;
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <header className={styles.header}>
      <p className={styles.season}>
        {season.name} · <Link to={`/temporadas/${seasonId}/cronica`}>crônica</Link> ·{' '}
        <button type="button" className={styles.link} onClick={() => setEditing(true)}>
          editar
        </button>{' '}
        ·{' '}
        <button type="button" className={styles.link} onClick={() => setDeleting(true)}>
          apagar
        </button>
      </p>
      <h1 className={styles.day}>Dia {toRoman(state.day ?? 1)}</h1>
      {state.phase && <p className={styles.phase}>{phaseLabel[state.phase]}</p>}

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Prêmio</dt>
          <dd className={styles.pot}>{formatMoney(state.prizePot, season.currency)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>No castelo</dt>
          <dd>{state.activePlayers.length}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Eliminados</dt>
          <dd>{state.eliminatedPlayers.length}</dd>
        </div>
      </dl>

      <EditSeasonModal season={season} open={editing} onClose={() => setEditing(false)} onDone={refresh} />
      <DeleteSeasonModal season={season} open={deleting} onClose={() => setDeleting(false)} onDone={fireAndForget(() => navigate('/'))} />
    </header>
  );
}
