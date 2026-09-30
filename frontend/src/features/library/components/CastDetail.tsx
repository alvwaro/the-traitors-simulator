import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/ui/Panel';
import type { Cast } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { CastBehaviors } from './CastBehaviors';
import { CastRanking } from './CastRanking';
import { CastRelationships } from './CastRelationships';
import styles from './CastDetail.module.css';

type Tab = 'characters' | 'ranking' | 'relationships' | 'behaviors';

interface CastDetailProps {
  cast: Cast;
  onBack: () => void;
  onEdit: () => void;
  onChanged: () => void;
  /** Aba de personagens: o elenco e o cadastro de personagens direto no cast. */
  characters: ReactNode;
}

/** Um cast aberto: personagens, ranking de desempenho, relacionamentos e comportamentos. */
export function CastDetail({ cast, onBack, onEdit, onChanged, characters }: Readonly<CastDetailProps>) {
  const [tab, setTab] = useState<Tab>('characters');

  return (
    <Panel
      title={cast.name}
      eyebrow={`${cast.characters.length} personagens`}
      actions={
        <>
          <Link to={`/temporadas/nova?cast=${cast.id}`} className={styles.link}>
            Nova temporada
          </Link>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Editar cast
          </Button>
          <Button variant="quiet" size="sm" onClick={onBack}>
            Voltar
          </Button>
        </>
      }
    >
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'characters'} className={cx(styles.tab, tab === 'characters' && styles.tabOn)} onClick={() => setTab('characters')}>
          Personagens
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ranking'} className={cx(styles.tab, tab === 'ranking' && styles.tabOn)} onClick={() => setTab('ranking')}>
          Ranking
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'relationships'}
          className={cx(styles.tab, tab === 'relationships' && styles.tabOn)}
          onClick={() => setTab('relationships')}
        >
          Relacionamentos
        </button>
        <button type="button" role="tab" aria-selected={tab === 'behaviors'} className={cx(styles.tab, tab === 'behaviors' && styles.tabOn)} onClick={() => setTab('behaviors')}>
          Comportamentos
        </button>
      </div>
      {tab === 'characters' && characters}
      {tab === 'ranking' && <CastRanking castId={cast.id} />}
      {tab === 'relationships' && <CastRelationships cast={cast} />}
      {tab === 'behaviors' && <CastBehaviors cast={cast} onChanged={onChanged} />}
    </Panel>
  );
}
