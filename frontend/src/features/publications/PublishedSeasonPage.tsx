import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useServices } from '../../app/services';
import { PortraitGrid } from '../../components/player/PortraitGrid';
import { PortraitStyleProvider } from '../../components/player/PortraitStyle';
import { Button } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/States';
import type { Edition, Publication } from '../../domain/models';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useResource } from '../../hooks/useResource';
import { formatDate, initials } from '../../lib/format';
import { CopyModal } from './CopyModal';
import { CopySeasonModal } from './CopySeasonModal';
import { areaLabel, playersText } from './labels';
import styles from './PublishedSeason.module.css';

/** Capa da temporada (a do cast de onde ela saiu) ou o brasão com as iniciais, se não houver (ou quebrar). */
function Cover({ name, imageUrl }: Readonly<{ name: string; imageUrl: string | null }>) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={styles.cover}>
      {imageUrl && !broken ? (
        <img src={imageUrl} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className={styles.crest} aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </div>
  );
}

/** Os números da temporada: o elenco e a temporada do programa. */
function Facts({ players, edition }: Readonly<{ players: number; edition: Edition | undefined }>) {
  return (
    <dl className={styles.facts}>
      <div>
        <dt>Participantes</dt>
        <dd>{players}</dd>
      </div>
      {edition && (
        <div>
          <dt>Missões e reviravoltas</dt>
          <dd>{edition.label}</dd>
        </div>
      )}
    </dl>
  );
}

/** O retângulo do elenco: as fotos (nas oficiais, cada uma leva à página do participante) e o botão de copiar só o elenco. */
function CastPanel({ publication, onCopy }: Readonly<{ publication: Publication; onCopy: () => void }>) {
  // Participantes reais: a página de cada um (só nas oficiais; os personagens de fãs são de quem criou).
  const official = publication.area === 'OFFICIAL';
  const cast = publication.snapshot.characters.map((c) => ({ id: c.key, name: c.name, imageUrl: c.imageUrl, characterId: c.characterId ?? null }));
  const participantPath = (c: { characterId: string | null }) => (official && c.characterId ? `/participantes/${c.characterId}` : undefined);
  const linked = cast.some((c) => participantPath(c));
  // No celular, fotos menores: três por linha em vez de duas.
  const compact = useMediaQuery('(max-width: 560px)');
  return (
    <section className={styles.cast} aria-label="Elenco">
      <header className={styles.castHead}>
        <div>
          <h2 className={styles.sectionTitle}>Elenco</h2>
          <p className={styles.muted}>
            {playersText(cast.length)}
            {linked ? ' · abra uma foto para ver o participante' : ''}
          </p>
        </div>
        <Button variant="ghost" onClick={onCopy}>
          Copiar elenco
        </Button>
      </header>
      <PortraitStyleProvider value="framed">
        <PortraitGrid items={cast} size={compact ? 'sm' : 'md'} linkTo={participantPath} />
      </PortraitStyleProvider>
    </section>
  );
}

/** A temporada do programa que esta reproduz: o resumo e as reviravoltas próprias dela. */
function EditionPanel({ edition }: Readonly<{ edition: Edition }>) {
  return (
    <section className={styles.edition} aria-label="A temporada do programa">
      <h2 className={styles.sectionTitle}>{edition.label}</h2>
      <p className={styles.summary}>{edition.summary}</p>
      {edition.twists.length > 0 && (
        <dl className={styles.twists}>
          {edition.twists.map((t) => (
            <div key={t.name}>
              <dt>{t.name}</dt>
              <dd>{t.description}</dd>
            </div>
          ))}
        </dl>
      )}
      <Link to={`/guia/${edition.pool}`} className={styles.guideLink}>
        Ver as missões no guia das temporadas
      </Link>
    </section>
  );
}

/**
 * Página de uma temporada publicada (oficial ou da Área de Fãs): as informações, o elenco e as cópias —
 * a temporada inteira, com as configurações prontas, ou só o elenco. O andamento do jogo não aparece.
 */
export function PublishedSeasonPage() {
  const { publicationId = '' } = useParams();
  const services = useServices();
  const publication = useResource(() => services.publications.get(publicationId), [publicationId]);
  const guide = useResource(() => services.editions.guide(), []);
  const [copying, setCopying] = useState<'season' | 'cast' | null>(null);

  if (publication.error) return <ErrorState error={publication.error} onRetry={publication.reload} />;
  if (!publication.data) return <Loading />;

  const p = publication.data;
  const official = p.area === 'OFFICIAL';
  const home = official ? '/' : '/fas';
  if (p.kind !== 'SEASON' || !p.season) return <Navigate to={home} replace />;

  const pool = p.season.missionPool;
  const edition = guide.data?.editions.find((e) => e.pool === pool);
  const byline = official ? null : [p.publisherName && `por ${p.publisherName}`, `publicada em ${formatDate(p.publishedAt)}`].filter(Boolean).join(' · ');

  return (
    <div className={styles.page}>
      <Link to={home} className={styles.back}>
        ← {areaLabel[p.area]}
      </Link>

      <header className={styles.hero}>
        <Cover name={p.name} imageUrl={p.imageUrl} />
        <div className={styles.heroText}>
          <h1 className={styles.title}>{p.name}</h1>
          {p.description && <p className={styles.lead}>{p.description}</p>}
          {byline && <p className={styles.muted}>{byline}</p>}
          <div className={styles.heroActions}>
            <Button onClick={() => setCopying('season')}>Copiar temporada</Button>
            <span className={styles.muted}>Vai para a Minha Área com as mesmas configurações e o elenco, pronta para começar.</span>
          </div>
        </div>
      </header>

      <Facts players={p.snapshot.characters.length} edition={edition} />
      <CastPanel publication={p} onCopy={() => setCopying('cast')} />
      {edition && <EditionPanel edition={edition} />}

      <CopySeasonModal publication={copying === 'season' ? p : null} onClose={() => setCopying(null)} />
      <CopyModal publication={copying === 'cast' ? p : null} onClose={() => setCopying(null)} />
    </div>
  );
}
