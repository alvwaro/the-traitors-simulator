import { Navigate, useParams } from 'react-router-dom';
import { useServices } from '../../app/services';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { ErrorState, Loading } from '../../components/ui/States';
import { useResource } from '../../hooks/useResource';
import { PublicationShelf } from '../publications/PublicationShelf';
import { HomeSection } from './HomeSection';
import { kindFromSlug, SECTION } from './sections';

/** Todas as publicações de um tipo na Área de Fãs (o "…" das seções). */
export function FanListPage() {
  const { kind: slug } = useParams();
  const kind = kindFromSlug(slug);
  const { publications } = useServices();
  const list = useResource(() => (kind ? publications.list({ area: 'FAN', kind }) : Promise.resolve([])), [kind]);

  if (!kind) return <Navigate to="/fas" replace />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const section = SECTION[kind];
  return (
    <HomeSection
      title={section.title}
      subtitle={list.data.length === 1 ? '1 publicação' : `${list.data.length} publicações`}
      action={
        <ButtonLink to="/fas" variant="ghost" size="sm">
          Voltar
        </ButtonLink>
      }
    >
      <PublicationShelf publications={list.data} empty={section.empty} onChanged={list.reload} />
    </HomeSection>
  );
}
