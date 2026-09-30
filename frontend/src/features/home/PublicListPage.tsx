import { Navigate, useParams } from 'react-router-dom';
import { useServices } from '../../app/services';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { ErrorState, Loading } from '../../components/ui/States';
import type { PublicationArea } from '../../domain/models';
import { useResource } from '../../hooks/useResource';
import { PublicationShelf } from '../publications/PublicationShelf';
import { HomeSection } from './HomeSection';
import { kindFromSlug, SECTION } from './sections';

const HOME: Record<PublicationArea, string> = { OFFICIAL: '/', FAN: '/fas' };

/** Todas as publicações de um tipo numa área (o "…" das seções da página inicial). */
export function PublicListPage({ area }: Readonly<{ area: PublicationArea }>) {
  const { kind: slug } = useParams();
  const kind = kindFromSlug(slug);
  const { publications } = useServices();
  const list = useResource(() => (kind ? publications.list({ area, kind }) : Promise.resolve([])), [area, kind]);

  if (!kind) return <Navigate to={HOME[area]} replace />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const section = SECTION[area][kind];
  return (
    <HomeSection
      title={section.title}
      subtitle={list.data.length === 1 ? '1 publicação' : `${list.data.length} publicações`}
      action={
        <ButtonLink to={HOME[area]} variant="ghost" size="sm">
          Voltar
        </ButtonLink>
      }
    >
      <PublicationShelf publications={list.data} empty={section.empty} onChanged={list.reload} />
    </HomeSection>
  );
}
