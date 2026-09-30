import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useServices } from '../../app/services';
import { Portrait } from '../../components/player/Portrait';
import { PortraitStyleProvider } from '../../components/player/PortraitStyle';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { ErrorState, Loading } from '../../components/ui/States';
import type { Participant, ParticipantRole, ParticipantSeason, Publication } from '../../domain/models';
import { useResource } from '../../hooks/useResource';
import { cx } from '../../lib/cx';
import { CardCover } from '../library/components/CardCover';
import { ProfileEditor } from './ProfileEditor';
import styles from './Participant.module.css';

export const roleLabel: Record<ParticipantRole, string> = {
  FAITHFUL: 'Fiel',
  TRAITOR: 'Traidor(a)',
  RECRUITED: 'Recrutado(a)',
};

/** O cartão da temporada publicada no site que corresponde a esta participação. */
function SeasonLink({ publication }: Readonly<{ publication: Publication }>) {
  const to = `/temporadas/${publication.seasonId}`;
  return (
    <Link to={to} className={styles.seasonCard}>
      <CardCover name={publication.name} imageUrl={publication.imageUrl} label={`Assistir ${publication.name}`} onOpen={() => undefined} />
      <span className={styles.seasonCardName}>{publication.name}</span>
      <span className={styles.seasonCardMeta}>Assistir no site</span>
    </Link>
  );
}

/** Uma temporada de The Traitors: o nome, o cartão (se houver) e, com spoiler, papel e destino. */
function SeasonEntry({ season, publication, spoiler }: Readonly<{ season: ParticipantSeason; publication: Publication | undefined; spoiler: boolean }>) {
  const details = [
    season.placement && `Colocação: ${season.placement}`,
    season.episodes !== null && `${season.episodes} episódio(s)`,
    season.shieldWins !== null && `${season.shieldWins} escudo(s)`,
  ].filter(Boolean);
  return (
    <li className={styles.season}>
      <div className={styles.seasonHead}>
        <h3 className={styles.seasonTitle}>{season.label}</h3>
        {spoiler && season.role && <span className={cx(styles.role, styles[season.role])}>{roleLabel[season.role]}</span>}
      </div>
      {spoiler ? (
        <div className={styles.spoiler}>
          {season.roleDetail && <p>{season.roleDetail}</p>}
          {season.fate && <p className={styles.fate}>{season.fate}</p>}
          {details.length > 0 && <p className={styles.muted}>{details.join(' · ')}</p>}
          {!season.role && !season.fate && details.length === 0 && <p className={styles.muted}>Sem informações desta temporada.</p>}
        </div>
      ) : (
        <p className={styles.muted}>Papel e destino escondidos (spoiler).</p>
      )}
      {publication && <SeasonLink publication={publication} />}
    </li>
  );
}

function ParticipantView({ participant, seasons }: Readonly<{ participant: Participant; seasons: Publication[] }>) {
  const [spoiler, setSpoiler] = useState(false);
  const profile = participant.profile;
  const bySeason = new Map(seasons.map((p) => [p.seasonId, p]));
  const list = profile?.seasons ?? [];
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <PortraitStyleProvider value="framed">
          <Portrait name={participant.name} imageUrl={participant.imageUrl} size="xl" hideName eager />
        </PortraitStyleProvider>
        <div className={styles.heroText}>
          <h1 className={styles.name}>{participant.name}</h1>
          {list.length > 0 && <p className={styles.muted}>{list.length === 1 ? '1 temporada de The Traitors' : `${list.length} temporadas de The Traitors`}</p>}
          {profile?.wikiUrl && (
            <a href={profile.wikiUrl} target="_blank" rel="noreferrer noopener" className={styles.wiki}>
              Ver na wiki
            </a>
          )}
        </div>
      </div>

      <section className={styles.block} aria-label="Temporadas de The Traitors">
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Temporadas de The Traitors</h2>
          {list.length > 0 && (
            <Button variant={spoiler ? 'quiet' : 'ghost'} size="sm" onClick={() => setSpoiler((s) => !s)} aria-pressed={spoiler}>
              {spoiler ? 'Esconder spoiler' : 'Exibir spoiler'}
            </Button>
          )}
        </div>
        {list.length ? (
          <ul className={styles.seasons}>
            {list.map((s, i) => (
              <SeasonEntry key={`${s.label}-${i}`} season={s} publication={s.seasonId ? bySeason.get(s.seasonId) : undefined} spoiler={spoiler} />
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nenhuma temporada cadastrada ainda.</p>
        )}
      </section>

      {(profile?.otherShows.length ?? 0) > 0 && (
        <section className={styles.block} aria-label="Outros realities">
          <h2 className={styles.blockTitle}>Outros realities</h2>
          <ul className={styles.shows}>
            {profile!.otherShows.map((show) => (
              <li key={show}>{show}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Página de informações do participante real: foto com moldura, temporadas, spoilers e outros realities. */
export function ParticipantPage() {
  const { characterId = '' } = useParams();
  const services = useServices();
  const participant = useResource(() => services.characters.participant(characterId), [characterId]);
  const seasons = useResource(() => services.publications.list({ area: 'OFFICIAL', kind: 'SEASON' }), []);
  const [editing, setEditing] = useState(false);

  const error = participant.error ?? seasons.error;
  if (error) return <ErrorState error={error} onRetry={() => { participant.reload(); seasons.reload(); }} />;
  if (!participant.data || !seasons.data) return <Loading />;

  const data = participant.data;
  return (
    <Panel
      eyebrow="Participante"
      actions={
        data.canEdit && (
          <Button variant={editing ? 'quiet' : 'ghost'} size="sm" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Fechar edição' : 'Editar informações'}
          </Button>
        )
      }
    >
      {editing && data.canEdit ? (
        <ProfileEditor
          participant={data}
          seasons={seasons.data}
          onSaved={() => {
            setEditing(false);
            participant.reload();
          }}
          onImported={participant.reload}
        />
      ) : (
        <ParticipantView participant={data} seasons={seasons.data} />
      )}
    </Panel>
  );
}
