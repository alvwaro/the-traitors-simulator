import { useState } from 'react';
import { useServices } from '../../../app/services';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState } from '../../../components/ui/States';
import type { Player, SeasonDetails } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { formatMoney } from '../../../lib/format';
import { missionPoolLabel, seasonModeLabel } from '../../../domain/labels';
import { RelationshipsPanel } from '../../simulation/components/RelationshipsPanel';
import { PlayerEditorModal } from './PlayerEditorModal';
import { RecruitPanel } from './RecruitPanel';
import { SeasonSettingsPanel } from './SeasonSettingsPanel';
import styles from '../pages/Seasons.module.css';
import { fireAndForget } from '../../../lib/async';
import { MIN_PLAYERS_TO_START } from '../../../domain/rules';


interface SeasonSetupProps {
  season: SeasonDetails;
  onChanged: () => void;
}

export function SeasonSetup({ season, onChanged }: Readonly<SeasonSetupProps>) {
  const { game } = useServices();
  const [editing, setEditing] = useState<Player | null>(null);
  const start = useAction(() => game.start(season.id), { success: 'Os portões do castelo se abriram' });

  async function handleStart() {
    if (await start.run()) onChanged();
  }

  return (
    <>
      <PageHeader
        title={season.name}
        lead={seasonLead(season)}
      />
      <div className={styles.layout}>
        <Panel title="Elenco">
          {season.players.length ? (
            <PortraitGrid items={season.players} caption={(p) => (p.isHuman ? 'Você' : null)} onToggle={(id) => setEditing(season.players.find((p) => p.id === id) ?? null)} />
          ) : (
            <EmptyState title="Nenhum jogador ainda" />
          )}
        </Panel>
        <div className={styles.stack}>
          <RecruitPanel season={season} onChanged={onChanged} />
          <SeasonSettingsPanel season={season} onChanged={onChanged} />
        </div>
      </div>

      {season.mode === 'AUTOMATIC' && (
        <div className={styles.relationships}>
          <RelationshipsPanel seasonId={season.id} players={season.players} version={season.players} setup title="Relacionamentos iniciais" />
        </div>
      )}

      <div className={styles.startBar}>
        <div>
          <p className={styles.startText}>
            {season.players.length < MIN_PLAYERS_TO_START ? `Mínimo de ${MIN_PLAYERS_TO_START} jogadores` : `${season.players.length} jogadores prontos`}
          </p>
        </div>
        <Button size="lg" pending={start.pending} disabled={season.players.length < MIN_PLAYERS_TO_START} onClick={fireAndForget(handleStart)}>
          Abrir os portões
        </Button>
      </div>

      <PlayerEditorModal seasonId={season.id} player={editing} onClose={() => setEditing(null)} onChanged={onChanged} />
    </>
  );
}

/** Resumo da temporada no cabeçalho: modo, loucura e missões (se simulada), elenco e prêmio inicial. */
function seasonLead(season: SeasonDetails): string {
  const mode = `Temporada ${seasonModeLabel[season.mode].toLowerCase()}`;
  const simulation = season.mode === 'MANUAL' ? '' : ` (loucura ${season.chaos}%, missões: ${missionPoolLabel[season.missionPool]}, ${season.withdrawals ? 'com' : 'sem'} desistências${season.hiddenShieldChance ? `, escudo misterioso ${season.hiddenShieldChance}%` : ''})`;
  return `${mode}${simulation} · ${season.players.length} jogadores · prêmio inicial ${formatMoney(season.initialPrizePot, season.currency)}`;
}
