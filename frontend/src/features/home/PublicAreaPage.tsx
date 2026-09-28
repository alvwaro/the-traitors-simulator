import { useAuth } from '../../app/auth';
import { useServices } from '../../app/services';
import { ErrorState, Loading } from '../../components/ui/States';
import type { PublicationArea, PublicationKind } from '../../domain/models';
import { useResource } from '../../hooks/useResource';
import { PublicationShelf } from '../publications/PublicationShelf';
import { HomeSection } from './HomeSection';
import styles from './Home.module.css';

const SECTIONS: { kind: PublicationKind; title: string; empty: string }[] = [
  { kind: 'SEASON', title: 'Temporadas', empty: 'Nenhuma temporada publicada ainda' },
  { kind: 'CAST', title: 'Casts', empty: 'Nenhum cast publicado ainda' },
  { kind: 'CHARACTER', title: 'Personagens', empty: 'Nenhum personagem publicado ainda' },
];

const INTRO: Record<PublicationArea, string> = {
  OFFICIAL: 'As temporadas, casts e personagens oficiais do castelo, publicados pelos donos do site. Assista às temporadas e copie os elencos para jogar a sua versão.',
  FAN: 'Temporadas, casts e personagens publicados pela comunidade. Para publicar os seus, use a Minha Área.',
};

/** Castelo · Área Oficial ou Área de Fãs: tudo que foi publicado naquela área. */
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
        {area === 'OFFICIAL' && isOwner && ' Você é dono(a) do site: o que você publica pela Minha Área aparece aqui.'}
      </p>
      <div className={styles.sections}>
        {SECTIONS.map((s) => (
          <HomeSection key={s.kind} title={s.title}>
            <PublicationShelf publications={all.filter((p) => p.kind === s.kind)} empty={s.empty} onChanged={list.reload} />
          </HomeSection>
        ))}
      </div>
    </>
  );
}
