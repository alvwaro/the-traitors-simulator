import { useServices } from '../../app/services';
import { ErrorState, Loading } from '../../components/ui/States';
import type { Publication, PublicationCountry } from '../../domain/models';
import { useResource } from '../../hooks/useResource';
import { countryLabel } from '../publications/labels';
import { PublicationShelf } from '../publications/PublicationShelf';
import { HomeSection } from './HomeSection';
import styles from './Home.module.css';

const COUNTRIES: readonly PublicationCountry[] = ['US', 'UK'];

const EMPTY: Record<PublicationCountry, string> = {
  US: 'Nenhuma temporada dos EUA publicada ainda',
  UK: 'Nenhuma temporada do Reino Unido publicada ainda',
};

/** Número da temporada do programa que a publicação reproduz (US_S2 → 2), se for do mesmo país. */
function editionNumber(p: Publication): number {
  const match = /^(US|UK)_S(\d+)$/.exec(p.season?.missionPool ?? '');
  return match?.[1] === p.country ? Number(match[2]) : Number.POSITIVE_INFINITY;
}

/** Na ordem do programa (1ª, 2ª...); as que não reproduzem uma temporada do país vão no fim, pelo nome. */
function inProgramOrder(list: readonly Publication[]): Publication[] {
  return [...list].sort((a, b) => editionNumber(a) - editionNumber(b) || a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
}

/** Temporadas Oficiais: as temporadas de The Traitors publicadas pelos donos do site, separadas entre EUA e Reino Unido. */
export function OfficialSeasonsPage() {
  const { publications } = useServices();
  const list = useResource(() => publications.list({ area: 'OFFICIAL', kind: 'SEASON' }), []);

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const all = list.data;
  return (
    <div className={styles.sections}>
      {COUNTRIES.map((country) => {
        const seasons = inProgramOrder(all.filter((p) => p.country === country));
        return (
          <HomeSection key={country} title={countryLabel[country]} subtitle={seasons.length === 1 ? '1 temporada' : `${seasons.length} temporadas`}>
            <PublicationShelf publications={seasons} empty={EMPTY[country]} onChanged={list.reload} />
          </HomeSection>
        );
      })}
    </div>
  );
}
