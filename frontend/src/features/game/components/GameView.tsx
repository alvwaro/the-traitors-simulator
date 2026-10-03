import { useState } from 'react';
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
  // Estado e história chegam juntos: a tela nunca mistura um estado novo com a história antiga
  // (por um instante, a fase aparecia simulada sem os acontecimentos dela).
  const loaded = useResource(() => Promise.all([game.state(seasonId), game.history(seasonId)]), [seasonId]);
  const phrases = useResource(() => services.phrases.list(), []);
  const [showInfo, setShowInfo] = useState(false);
  const [showCastle, setShowCastle] = useState(false);

  const refresh = loaded.reload;

  if (loaded.error) return <ErrorState error={loaded.error} onRetry={refresh} />;
  if (!loaded.data) return <Loading />;
  const [state, history] = loaded.data;

  // Participante não vê o termômetro (os sentimentos do castelo são segredo) até sair do jogo.
  const manual = state.season.mode === 'MANUAL';
  const automatic = !manual && (!state.player || state.player.spectator);

  return (
    <GameProvider seasonId={seasonId} state={state} history={history} phrases={phrases.data ?? NO_PHRASES} refresh={refresh}>
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
                players={history.players}
                version={state}
                inGame={state.phase !== 'ARRIVAL' && state.phase !== 'TRAITOR_SELECTION'}
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
