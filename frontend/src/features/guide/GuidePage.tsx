import { Navigate, useParams } from 'react-router-dom';
import { useServices } from '../../app/services';
import { PageHeader } from '../../components/layout/PageHeader';
import { TabNav } from '../../components/layout/TabNav';
import { Panel } from '../../components/ui/Panel';
import { ErrorState, Loading } from '../../components/ui/States';
import type { Edition, EditionMission, GameEvent } from '../../domain/models';
import { useResource } from '../../hooks/useResource';
import { formatMoney } from '../../lib/format';
import styles from './Guide.module.css';

const COUNTRY_LABEL: Record<Edition['country'], string> = { US: 'Estados Unidos', UK: 'Reino Unido', MIX: 'Misturado' };
const KIND_ICON: Record<EditionMission['kind'], string> = { REGULAR: '', SEER: '👁', FINALE: '🔥' };

const KIND_LABEL: Record<EditionMission['kind'], string | null> = {
  REGULAR: null,
  SEER: 'Missão do Vidente',
  FINALE: 'Missão final',
};

/** Guia das temporadas: missões, valores e reviravoltas de cada versão do programa (EUA e Reino Unido). */
export function GuidePage() {
  const { editions } = useServices();
  const { pool } = useParams();
  const guide = useResource(() => editions.guide(), []);

  if (!pool) return <Navigate to="/guia/US_S3" replace />;
  if (guide.error) return <ErrorState error={guide.error} onRetry={guide.reload} />;
  if (!guide.data) return <Loading />;

  const { editions: list, commonEvents } = guide.data;
  const edition = list.find((e) => e.pool === pool);
  if (!edition) return <Navigate to="/guia/US_S3" replace />;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Guia das temporadas"
        lead="O que cada temporada do programa traz para a simulação: as missões na ordem em que foram ao ar, quanto valem e as reviravoltas que só aconteceram nela."
      />
      <TabNav tabs={list.map((e) => ({ to: `/guia/${e.pool}`, label: e.label.replace(/ \(\d{4}\)$/, '') }))} label="Temporadas do programa" />
      <div className={styles.layout}>
        <div className={styles.main}>
          <EditionSummary edition={edition} />
          <Missions edition={edition} />
        </div>
        <aside className={styles.side}>
          <Events title="Reviravoltas desta temporada" events={edition.twists} empty="Nenhuma reviravolta própria: só os acontecimentos de sempre." />
          <Events title="Em qualquer temporada" events={commonEvents} />
        </aside>
      </div>
    </div>
  );
}

function EditionSummary({ edition }: Readonly<{ edition: Edition }>) {
  const regular = edition.missions.filter((m) => m.kind === 'REGULAR');
  const total = regular.reduce((sum, m) => sum + m.prizeAvailable, 0);
  return (
    <Panel eyebrow={COUNTRY_LABEL[edition.country]} title={edition.label}>
      <p className={styles.summary}>{edition.summary}</p>
      <dl className={styles.facts}>
        <div>
          <dt>Missões</dt>
          <dd>{regular.length}</dd>
        </div>
        <div>
          <dt>Em jogo nas missões comuns</dt>
          <dd>{formatMoney(total, edition.currency)}</dd>
        </div>
        <div>
          <dt>Vidente</dt>
          <dd>{edition.missions.some((m) => m.kind === 'SEER') ? 'Sim' : 'Não'}</dd>
        </div>
      </dl>
      <p className={styles.note}>
        Os valores são os do programa, em {edition.currency === 'GBP' ? 'libras' : 'dólares'}; na simulação eles entram na moeda da temporada que você criar.
      </p>
    </Panel>
  );
}

function Missions({ edition }: Readonly<{ edition: Edition }>) {
  const mix = edition.country === 'MIX';
  return (
    <Panel title="Missões" eyebrow={mix ? 'Ordem sorteada em cada temporada' : 'Na ordem da exibição'}>
      <ol className={styles.missions}>
        {edition.missions.map((m, i) => (
          <li key={`${m.kind}-${m.key}-${m.origin}`} className={styles.mission}>
            <span className={styles.number} aria-hidden="true">
              {KIND_ICON[m.kind] || i + 1}
            </span>
            <div className={styles.missionBody}>
              <h3 className={styles.missionName}>
                {m.name}
                {KIND_LABEL[m.kind] && <span className={styles.badge}>{KIND_LABEL[m.kind]}</span>}
                {mix && <span className={styles.origin}>{m.origin}</span>}
              </h3>
              <p className={styles.missionText}>{m.description}</p>
              <p className={styles.prize}>Até {formatMoney(m.prizeAvailable, m.origin.startsWith('Reino Unido') ? 'GBP' : 'USD')}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function Events({ title, events, empty }: Readonly<{ title: string; events: GameEvent[]; empty?: string }>) {
  return (
    <Panel title={title}>
      {events.length ? (
        <dl className={styles.events}>
          {events.map((e) => (
            <div key={e.name} className={styles.event}>
              <dt>{e.name}</dt>
              <dd>{e.description}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.note}>{empty}</p>
      )}
    </Panel>
  );
}
