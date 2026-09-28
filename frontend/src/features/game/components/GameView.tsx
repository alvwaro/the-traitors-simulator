import { useCallback, useState } from 'react';
import { useServices } from '../../../app/services';
import { PortraitStyleProvider } from '../../../components/player/PortraitStyle';
import { Button } from '../../../components/ui/Button';
import { ErrorState, Loading } from '../../../components/ui/States';
import { useResource } from '../../../hooks/useResource';
import { GameProvider } from '../context/GameContext';
import { AdvanceBar } from './AdvanceBar';
import { GameHeader } from './GameHeader';
import { InfoSection } from './InfoSection';
import { PhaseStage } from './PhaseStage';
import { PhaseTrack } from './PhaseTrack';
import { StoryButton } from '../story/StoryButton';
import { StoryProvider } from '../story/StoryContext';
import type { Phrase } from '../../../domain/models';
import { RelationshipsPanel } from '../../simulation/components/RelationshipsPanel';
import styles from './GameView.module.css';

const NO_PHRASES: Phrase[] = [];

/** Simulação em uma coluna central; anotações, elenco e ferramentas só aparecem sob demanda. */
export function GameView({ seasonId }: Readonly<{ seasonId: string }>) {
  const services = useServices();
  const { game } = services;
  const state = useResource(() => game.state(seasonId), [seasonId]);
  const history = useResource(() => game.history(seasonId), [seasonId]);
  const phrases = useResource(() => services.phrases.list(), []);
  const [showInfo, setShowInfo] = useState(false);
  const [showCastle, setShowCastle] = useState(false);

  const reloadState = state.reload;
  const reloadHistory = history.reload;
  const refresh = useCallback(() => {
    reloadState();
    reloadHistory();
  }, [reloadState, reloadHistory]);

  const error = state.error ?? history.error;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!state.data || !history.data) return <Loading />;

  // Participante não vê o termômetro (os sentimentos do castelo são segredo) até sair do jogo.
  const manual = state.data.season.mode === 'MANUAL';
  const automatic = !manual && (!state.data.player || state.data.player.spectator);

  return (
    <GameProvider seasonId={seasonId} state={state.data} history={history.data} phrases={phrases.data ?? NO_PHRASES} refresh={refresh}>
      <StoryProvider>
        <PortraitStyleProvider value="framed">
          <div className={styles.page}>
            <GameHeader />
            <PhaseTrack />
            <PhaseStage />
            <AdvanceBar />
            <div className={styles.toggle}>
              {automatic && (
                <Button variant="ghost" aria-expanded={showCastle} onClick={() => setShowCastle((v) => !v)}>
                  {showCastle ? 'Ocultar termômetro do castelo' : 'Termômetro do castelo'}
                </Button>
              )}
              <Button variant="ghost" aria-expanded={showInfo} onClick={() => setShowInfo((v) => !v)}>
                {showInfo ? 'Ocultar informações' : 'Exibir informações'}
              </Button>
            </div>
            {automatic && showCastle && (
              <RelationshipsPanel
                seasonId={seasonId}
                players={history.data.players}
                version={state.data}
                inGame={state.data.phase !== 'ARRIVAL' && state.data.phase !== 'TRAITOR_SELECTION'}
                title="Termômetro do castelo"
              />
            )}
            {showInfo && <InfoSection />}
            {/* artes do Instagram só na temporada manual (registro do programa); nas simuladas não aparecem */}
            {manual && <StoryButton />}
          </div>
        </PortraitStyleProvider>
      </StoryProvider>
    </GameProvider>
  );
}
