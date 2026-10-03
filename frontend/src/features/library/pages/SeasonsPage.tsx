import { useSearchParams } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { ButtonLink } from '../../../components/ui/ButtonLink';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import type { SeasonMode } from '../../../domain/enums';
import type { Publication, Season } from '../../../domain/models';
import { useResource } from '../../../hooks/useResource';
import { PublicationShelf } from '../../publications/PublicationShelf';
import { useMyPublications } from '../../publications/useMyPublications';
import { SeasonCard } from '../../seasons/components/SeasonCard';
import cardStyles from '../components/Library.module.css';
import styles from './LibraryPage.module.css';

/** As categorias das suas temporadas, na ordem em que aparecem. */
const CATEGORIES: readonly { mode: SeasonMode; title: string; hint: string }[] = [
  { mode: 'PLAYER', title: 'Jogáveis', hint: 'Você entra no castelo como participante.' },
  { mode: 'AUTOMATIC', title: 'Automáticas', hint: 'A simulação decide tudo; você assiste.' },
  { mode: 'MANUAL', title: 'Manuais', hint: 'Você registra o que acontece, fase a fase.' },
];

/** `/biblioteca?arquivadas`: as temporadas que já terminaram. */
const ARCHIVED = 'arquivadas';

function countText(count: number, archived: boolean): string {
  const noun = count === 1 ? '1 temporada' : `${count} temporadas`;
  if (!archived) return noun;
  return count === 1 ? `${noun} arquivada` : `${noun} arquivadas`;
}

/**
 * Temporadas da biblioteca: as que você criou (ou copiou), separadas em jogáveis, automáticas e manuais,
 * e, embaixo, tudo o que você publicou. As que terminaram saem da lista e ficam em Arquivadas.
 */
export function SeasonsPage() {
  const services = useServices();
  const seasons = useResource(() => services.seasons.list(), []);
  const mine = useMyPublications();
  const [params] = useSearchParams();
  const showArchived = params.has(ARCHIVED);

  const error = seasons.error ?? mine.error;
  if (error) return <ErrorState error={error} onRetry={seasons.reload} />;
  if (!seasons.data || !mine.loaded) return <Loading />;

  function refresh() {
    seasons.reload();
    mine.reload();
  }

  const publicationOf = (seasonId: string) => mine.find('SEASON', seasonId);
  const archived = seasons.data.filter((s) => s.status === 'FINISHED');
  const list = showArchived ? archived : seasons.data.filter((s) => s.status !== 'FINISHED');

  return (
    <div className={styles.stack}>
      <section aria-label={showArchived ? 'Temporadas arquivadas' : 'Minhas temporadas'}>
        <div className={styles.toolbar}>
          <p className={styles.count}>{countText(list.length, showArchived)}</p>
          <div className={styles.actions}>
            {showArchived ? (
              <ButtonLink variant="ghost" to="/biblioteca">
                Voltar às temporadas
              </ButtonLink>
            ) : (
              <ButtonLink variant="ghost" to={`/biblioteca?${ARCHIVED}`}>
                {archived.length > 0 ? `Arquivadas (${archived.length})` : 'Arquivadas'}
              </ButtonLink>
            )}
            <ButtonLink to="/temporadas/nova">Nova temporada</ButtonLink>
          </div>
        </div>
        {list.length === 0 ? (
          <EmptySeasons archivedView={showArchived} anySeason={seasons.data.length > 0} />
        ) : (
          <div className={styles.categories}>
            {CATEGORIES.map(({ mode, title, hint }) => (
              <Category key={mode} title={title} hint={hint} seasons={list.filter((s) => s.mode === mode)} publicationOf={publicationOf} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>

      {!showArchived && (
        <section className={cardStyles.castGroup} aria-label="Minhas publicações">
          <div className={cardStyles.castGroupHead}>
            <h2 className={cardStyles.castGroupTitle}>Minhas publicações</h2>
            <p className={styles.count}>O que você colocou numa vitrine (Temporadas Oficiais ou Área de Fãs).</p>
          </div>
          <PublicationShelf publications={mine.list} empty="Você ainda não publicou nada" onChanged={refresh} showArea />
        </section>
      )}
    </div>
  );
}

/** Uma categoria (jogáveis, automáticas ou manuais); vazia, não aparece. */
function Category({
  title,
  hint,
  seasons,
  publicationOf,
  onChanged,
}: Readonly<{ title: string; hint: string; seasons: Season[]; publicationOf: (seasonId: string) => Publication | null; onChanged: () => void }>) {
  if (seasons.length === 0) return null;
  return (
    <section className={cardStyles.castGroup} aria-label={title}>
      <div className={cardStyles.castGroupHead}>
        <h2 className={cardStyles.castGroupTitle}>{title}</h2>
        <p className={styles.count}>{hint}</p>
      </div>
      <div className={cardStyles.castGrid}>
        {seasons.map((season) => (
          <SeasonCard key={season.id} season={season} publication={publicationOf(season.id)} onChanged={onChanged} />
        ))}
      </div>
    </section>
  );
}

function EmptySeasons({ archivedView, anySeason }: Readonly<{ archivedView: boolean; anySeason: boolean }>) {
  if (archivedView) {
    return <EmptyState title="Nenhuma temporada arquivada">Quando uma temporada termina, ela sai da lista principal e fica guardada aqui.</EmptyState>;
  }
  if (anySeason) {
    return <EmptyState title="Nenhuma temporada em andamento">As que você já terminou estão em Arquivadas.</EmptyState>;
  }
  return (
    <EmptyState title="Nenhuma temporada ainda">
      Crie uma do zero ou copie uma temporada (ou só o elenco) das Temporadas Oficiais ou da Área de Fãs.
    </EmptyState>
  );
}
