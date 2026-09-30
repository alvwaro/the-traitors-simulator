import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { phaseLabel, seasonStatusLabel } from '../../domain/labels';
import type { Publication } from '../../domain/models';
import { formatDate, toRoman } from '../../lib/format';
import { CardCover } from '../library/components/CardCover';
import { areaLabel } from './labels';
import styles from '../library/components/Library.module.css';

interface PublicationCardProps {
  publication: Publication;
  /** Quem publicou, ou um dono do site (moderação). */
  canRemove: boolean;
  onView: () => void;
  onCopy: () => void;
  onRemove: () => void;
  showArea?: boolean;
}

/** Linha de situação: temporadas mostram onde estão; casts e personagens, o elenco. */
function metaOf(p: Publication): string {
  if (p.season) {
    const where = p.season.currentDay && p.season.currentPhase ? ` · Dia ${toRoman(p.season.currentDay)}, ${phaseLabel[p.season.currentPhase]}` : '';
    return `${seasonStatusLabel[p.season.status]}${where}`;
  }
  const characters = p.snapshot?.characters ?? [];
  if (p.kind === 'CHARACTER') return characters[0]?.behaviors.map((b) => b.name).join(', ') || 'Personagem';
  return `${characters.length} personagens`;
}

/** Cartão de uma publicação na Área Oficial, na Área de Fãs ou na lista da Minha Área. */
export function PublicationCard({ publication: p, canRemove, onView, onCopy, onRemove, showArea }: Readonly<PublicationCardProps>) {
  const navigate = useNavigate();
  const imageUrl = p.imageUrl ?? (p.kind === 'CHARACTER' ? (p.snapshot?.characters[0]?.imageUrl ?? null) : null);
  const watchUrl = `/temporadas/${p.seasonId}`;
  const official = p.area === 'OFFICIAL';
  // Participante real: abre a página de informações dele.
  const participantUrl = official && p.kind === 'CHARACTER' && p.characterId ? `/participantes/${p.characterId}` : null;
  let open = onView;
  if (p.kind === 'SEASON') open = () => navigate(watchUrl);
  else if (participantUrl) open = () => navigate(participantUrl);
  let primary: ReactNode = null;
  if (p.kind === 'SEASON') {
    primary = (
      <Link to={watchUrl} className={styles.inlineLink}>
        Assistir
      </Link>
    );
  } else if (participantUrl) {
    primary = (
      <Link to={participantUrl} className={styles.inlineLink}>
        Ver participante
      </Link>
    );
  } else if (p.kind === 'CAST') {
    primary = (
      <button type="button" className={styles.inlineLink} onClick={onView}>
        Ver elenco
      </button>
    );
  }
  const copyLabel = { SEASON: 'Copiar elenco para jogar', CAST: 'Copiar para jogar', CHARACTER: 'Salvar na biblioteca' }[p.kind];

  return (
    <article className={styles.castCard}>
      <CardCover name={p.name} imageUrl={imageUrl} label={`Abrir ${p.name}`} onOpen={open} />
      <div className={styles.castBody}>
        <h3 className={styles.castName}>
          <button type="button" className={styles.castOpen} onClick={open}>
            {p.name}
          </button>
        </h3>
        <p className={styles.castMeta}>{metaOf(p)}</p>
        {/* Nas oficiais, quem publicou e quando não importam: são as temporadas do programa. */}
        {(showArea || !official) && (
          <p className={styles.castMeta}>
            {showArea ? `${areaLabel[p.area]} · ` : ''}
            {p.publisherName && !showArea ? `por ${p.publisherName} · ` : ''}
            {formatDate(p.publishedAt)}
          </p>
        )}
        {p.description && <p className={styles.castDescription}>{p.description}</p>}
        <div className={styles.castActions}>
          {primary}
          <button type="button" className={styles.inlineLink} onClick={onCopy}>
            {copyLabel}
          </button>
          {canRemove && (
            <button type="button" className={styles.dangerLink} onClick={onRemove}>
              Tirar da vitrine
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
