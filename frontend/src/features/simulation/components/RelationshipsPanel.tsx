import { useEffect, useState } from 'react';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import type { Player, Relationships } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import { CastleThermometer } from './CastleThermometer';
import styles from './Simulation.module.css';
import { fireAndForget } from '../../../lib/async';

interface RelationshipsPanelProps {
  seasonId: string;
  players: Player[];
  /** Muda quando o elenco muda, para recarregar. */
  version?: unknown;
  /** Na preparação dá para sortear tudo de novo. */
  setup?: boolean;
  inGame?: boolean;
  title?: string;
}

/** Relacionamentos e termômetro do castelo de uma temporada automática. */
export function RelationshipsPanel({ seasonId, players, version, setup, inGame, title = 'Relacionamentos' }: Readonly<RelationshipsPanelProps>) {
  const services = useServices();
  const remote = useResource(() => services.simulation.relationships(seasonId), [seasonId, version]);
  const behaviors = useResource(() => services.behaviors.list(), []);
  const [data, setData] = useState<Relationships | undefined>();
  useEffect(() => setData(remote.data), [remote.data]);

  const regenerate = useAction(() => services.simulation.regenerate(seasonId), { success: 'Primeiras impressões sorteadas de novo' });

  const actions = setup && (
    <Button variant="ghost" size="sm" pending={regenerate.pending} onClick={fireAndForget(async () => { const next = await regenerate.run(); if (next) setData(next); })}>
      Sortear de novo
    </Button>
  );

  let body;
  if (remote.error) body = <ErrorState error={remote.error} onRetry={remote.reload} />;
  else if (!data || !behaviors.data) body = <Loading />;
  else if (data.standings.length < 2) body = <EmptyState title="Adicione jogadores para ver os relacionamentos" />;
  else {
    body = (
      <>
        {setup && (
          <p className={styles.panelIntro}>
            Primeiras impressões calculadas pelos comportamentos de cada um (com um pouco de acaso). Ajuste qualquer par clicando num jogador.
          </p>
        )}
        <CastleThermometer seasonId={seasonId} data={data} players={players} behaviors={behaviors.data} editable inGame={inGame} onChanged={setData} />
      </>
    );
  }

  return (
    <Panel title={title} actions={actions}>
      {body}
    </Panel>
  );
}
