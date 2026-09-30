import { useAuth } from '../../app/auth';
import { useServices } from '../../app/services';
import { ErrorState, Loading } from '../../components/ui/States';
import type { PublicationArea } from '../../domain/models';
import { useResource } from '../../hooks/useResource';
import { PublicationShelf } from '../publications/PublicationShelf';
import { HomeSection } from './HomeSection';
import { HOME_LIMIT, KINDS, listPath, SECTION } from './sections';
import styles from './Home.module.css';

const INTRO: Record<PublicationArea, string> = {
  OFFICIAL:
    'As temporadas oficiais de The Traitors, com os participantes reais de cada edição, montadas pelos donos do site. Assista às temporadas e copie os elencos para jogar a sua versão.',
  FAN: 'Temporadas, casts e personagens publicados pela comunidade. Para publicar os seus, use a Minha Área.',
};

/** Área oficial ou Área de Fãs: as publicações mais recentes de cada tipo; o resto fica na página de cada lista. */
export function PublicAreaPage({ area }: Readonly<{ area: PublicationArea }>) {
  const { publications } = useServices();
  const { isOwner } = useAuth();
  const list = useResource(() => publications.list({ area }), [area]);

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const all = list.data;
  return (
    <>
      <p className={styles.intro}>
        {INTRO[area]}
        {area === 'OFFICIAL' && isOwner && ' Você é dono(a) do site: o que você publica pela Minha Área aparece aqui como oficial.'}
      </p>
      <div className={styles.sections}>
        {KINDS.map((kind) => (
          <HomeSection key={kind} title={SECTION[area][kind].title}>
            <PublicationShelf
              publications={all.filter((p) => p.kind === kind)}
              empty={SECTION[area][kind].empty}
              onChanged={list.reload}
              limit={HOME_LIMIT}
              moreTo={listPath(area, kind)}
            />
          </HomeSection>
        ))}
      </div>
    </>
  );
}
