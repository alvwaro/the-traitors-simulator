import { useServices } from '../../../app/services';
import { ButtonLink } from '../../../components/ui/ButtonLink';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import { useResource } from '../../../hooks/useResource';
import { PublicationShelf } from '../../publications/PublicationShelf';
import { useMyPublications } from '../../publications/useMyPublications';
import { SeasonCard } from '../../seasons/components/SeasonCard';
import cardStyles from '../components/Library.module.css';
import styles from './LibraryPage.module.css';

/** Temporadas da biblioteca: as que você criou (ou copiou) e, embaixo, tudo o que você publicou. */
export function SeasonsPage() {
  const services = useServices();
  const seasons = useResource(() => services.seasons.list(), []);
  const mine = useMyPublications();

  const error = seasons.error ?? mine.error;
  if (error) return <ErrorState error={error} onRetry={seasons.reload} />;
  if (!seasons.data || !mine.loaded) return <Loading />;

  function refresh() {
    seasons.reload();
    mine.reload();
  }

  return (
    <div className={styles.stack}>
      <section aria-label="Minhas temporadas">
        <div className={styles.toolbar}>
          <p className={styles.count}>{seasons.data.length === 1 ? '1 temporada' : `${seasons.data.length} temporadas`}</p>
          <ButtonLink to="/temporadas/nova">Nova temporada</ButtonLink>
        </div>
        {seasons.data.length === 0 ? (
          <EmptyState title="Nenhuma temporada ainda">
            Crie uma do zero ou copie uma temporada (ou só o elenco) das Temporadas Oficiais ou da Área de Fãs.
          </EmptyState>
        ) : (
          <div className={cardStyles.castGrid}>
            {seasons.data.map((season) => (
              <SeasonCard key={season.id} season={season} publication={mine.find('SEASON', season.id)} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>

      <section className={cardStyles.castGroup} aria-label="Minhas publicações">
        <div className={cardStyles.castGroupHead}>
          <h2 className={cardStyles.castGroupTitle}>Minhas publicações</h2>
          <p className={styles.count}>O que você colocou numa vitrine (Temporadas Oficiais ou Área de Fãs).</p>
        </div>
        <PublicationShelf publications={mine.list} empty="Você ainda não publicou nada" onChanged={refresh} showArea />
      </section>
    </div>
  );
}
