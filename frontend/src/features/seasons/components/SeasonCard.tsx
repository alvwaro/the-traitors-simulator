import { useState } from 'react';
import { Link } from 'react-router-dom';
import { countryOfSeason } from '@traitors/shared';
import { phaseLabel, seasonModeLabel, seasonStatusLabel } from '../../../domain/labels';
import type { Publication, Season } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { formatDate, toRoman } from '../../../lib/format';
import { areaLabel } from '../../publications/labels';
import { PublishModal } from '../../publications/PublishModal';
import { DeleteSeasonModal, EditSeasonModal } from './SeasonModals';
import styles from './SeasonCard.module.css';

interface SeasonCardProps {
  season: Season;
  /** A publicação desta temporada, se estiver numa vitrine. */
  publication: Publication | null;
  /** Recarrega a lista depois de editar, apagar ou publicar. */
  onChanged: () => void;
}

/** Temporada da Minha Área: abrir, editar, publicar e apagar. */
export function SeasonCard({ season, publication, onChanged }: Readonly<SeasonCardProps>) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const where =
    season.currentDay && season.currentPhase
      ? `Dia ${toRoman(season.currentDay)} · ${phaseLabel[season.currentPhase]}`
      : 'Elenco sendo convocado';

  return (
    <div className={styles.wrapper}>
      <Link to={`/temporadas/${season.id}`} className={cx(styles.card, styles[season.status], publication && styles.featured)}>
        <span className={styles.badges}>
          <span className={styles.status}>{seasonStatusLabel[season.status]}</span>
          {season.mode === 'AUTOMATIC' && <span className={styles.mode}>{seasonModeLabel[season.mode]}</span>}
          {publication && <span className={styles.mode}>{areaLabel[publication.area]}</span>}
        </span>
        <h2 className={styles.name}>{season.name}</h2>
        <p className={styles.where}>{where}</p>
        <p className={styles.date}>Criada em {formatDate(season.createdAt)}</p>
      </Link>

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => setEditing(true)}>
          Editar
        </button>
        <button type="button" className={styles.action} onClick={() => setPublishing(true)}>
          {publication ? 'Publicação' : 'Publicar'}
        </button>
        <button type="button" className={cx(styles.action, styles.danger)} onClick={() => setDeleting(true)}>
          Apagar
        </button>
      </div>

      <EditSeasonModal season={season} open={editing} onClose={() => setEditing(false)} onDone={onChanged} />
      <DeleteSeasonModal season={season} open={deleting} onClose={() => setDeleting(false)} onDone={onChanged} />
      <PublishModal
        target={publishing ? { kind: 'SEASON', id: season.id, name: season.name, country: countryOfSeason(season.missionPool, season.currency) } : null}
        current={publication}
        onClose={() => setPublishing(false)}
        onDone={onChanged}
      />
    </div>
  );
}
