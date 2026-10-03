import { useServices } from '../../app/services';
import { ErrorState, Loading } from '../../components/ui/States';
import { useResource } from '../../hooks/useResource';
import { PublicationShelf } from '../publications/PublicationShelf';
import { HomeSection } from './HomeSection';
import { HOME_LIMIT, KINDS, listPath, SECTION } from './sections';
import styles from './Home.module.css';

/** Área de Fãs: as publicações mais recentes de cada tipo; o resto fica na página de cada lista. */
export function FanAreaPage() {
  const { publications } = useServices();
  const list = useResource(() => publications.list({ area: 'FAN' }), []);

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const all = list.data;
  return (
    <>
      <p className={styles.intro}>Temporadas, casts e personagens publicados pela comunidade. Para publicar os seus, use a Biblioteca.</p>
      <div className={styles.sections}>
        {KINDS.map((kind) => (
          <HomeSection key={kind} title={SECTION[kind].title}>
            <PublicationShelf
              publications={all.filter((p) => p.kind === kind)}
              empty={SECTION[kind].empty}
              onChanged={list.reload}
              limit={HOME_LIMIT}
              moreTo={listPath(kind)}
            />
          </HomeSection>
        ))}
      </div>
    </>
  );
}
