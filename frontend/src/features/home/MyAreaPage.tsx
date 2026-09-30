import { Link } from 'react-router-dom';
import { useServices } from '../../app/services';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { useResource } from '../../hooks/useResource';
import { PublicationShelf } from '../publications/PublicationShelf';
import { useMyPublications } from '../publications/useMyPublications';
import { SeasonCard } from '../seasons/components/SeasonCard';
import { HomeSection } from './HomeSection';
import styles from './Home.module.css';

/** Minha Área: as temporadas, casts e personagens de quem está logado, e o que essa pessoa publicou. */
export function MyAreaPage() {
  const services = useServices();
  const seasons = useResource(() => services.seasons.list(), []);
  const casts = useResource(() => services.casts.list(), []);
  const characters = useResource(() => services.characters.list(), []);
  const mine = useMyPublications();

  const error = seasons.error ?? mine.error;
  if (error) return <ErrorState error={error} onRetry={seasons.reload} />;
  if (!seasons.data || !mine.loaded) return <Loading />;

  function refresh() {
    seasons.reload();
    mine.reload();
  }

  return (
    <div className={styles.sections}>
      <HomeSection title="Minhas temporadas" subtitle="Temporadas criadas por você. Publique para aparecerem na sua área pública." action={<ButtonLink to="/temporadas/nova" variant="ghost" size="sm">Nova temporada</ButtonLink>}>
        {seasons.data.length === 0 ? (
          <EmptyState title="Nenhuma temporada ainda">
            Crie uma do zero ou copie um elenco oficial ou da Área de Fãs para jogar.
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            {seasons.data.map((season) => (
              <SeasonCard key={season.id} season={season} publication={mine.find('SEASON', season.id)} onChanged={refresh} />
            ))}
          </div>
        )}
      </HomeSection>

      <HomeSection title="Minha biblioteca" subtitle="Casts e personagens seus. Publique pelo cartão de cada um na biblioteca.">
        <div className={styles.shortcuts}>
          <Link to="/biblioteca" className={styles.shortcut}>
            <span className={styles.shortcutCount}>{casts.data?.length ?? '–'}</span>
            <span className={styles.shortcutLabel}>casts</span>
          </Link>
          <Link to="/biblioteca/personagens" className={styles.shortcut}>
            <span className={styles.shortcutCount}>{characters.data?.length ?? '–'}</span>
            <span className={styles.shortcutLabel}>personagens</span>
          </Link>
        </div>
      </HomeSection>

      <HomeSection title="Minhas publicações" subtitle="O que você colocou numa vitrine (Temporadas Oficiais ou Área de Fãs).">
        <PublicationShelf publications={mine.list} empty="Você ainda não publicou nada" onChanged={refresh} showArea />
      </HomeSection>
    </div>
  );
}
