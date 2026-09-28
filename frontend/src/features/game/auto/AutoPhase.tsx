import { useMemo } from 'react';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { eventsAsConversations, eventsOf } from '../../../domain/events';
import type { GamePhase } from '../../../domain/enums';
import { useGame } from '../context/GameContext';
import { ArrivalPhase } from '../phases/ArrivalPhase';
import { BreakfastNews } from '../phases/BreakfastPhase';
import { FinalePhase } from '../phases/FinalePhase';
import { MissionSummary } from '../phases/MissionPhase';
import { RoundTableResult } from '../phases/RoundTablePhase';
import { MeetingResult } from '../phases/TraitorsMeetingPhase';
import { useShareConversations } from '../story/StoryContext';
import { EndgameFeed } from './EndgameFeed';
import { EventFeed } from './EventFeed';
import sharedStyles from '../phases/shared/Shared.module.css';
import styles from './Auto.module.css';

/** Momentos em que as falas da simulação também vão para a arte do Instagram. */
const STORY_PHASES: GamePhase[] = ['ARRIVAL', 'BREAKFAST', 'MISSION'];
const STORY_MAX_CONVERSATIONS = 6;

const PROMPT: Partial<Record<GamePhase, string>> = {
  ARRIVAL: 'Os convidados estão chegando. Simule a chegada para ver as primeiras impressões.',
  TRAITOR_SELECTION: 'Simule para o castelo escolher os traidores (os mais dissimulados têm mais chance).',
  BREAKFAST: 'Simule o café da manhã: um a um, os jogadores descem, até a porta não abrir mais.',
  MISSION: 'Simule a missão do dia: os personagens jogam de acordo com as próprias habilidades.',
  ROUND_TABLE: 'Simule a mesa redonda: debates, votos e o banimento.',
  TRAITORS_MEETING: 'Simule a reunião na torre: os traidores escolhem a vítima (ou recrutam).',
  ENDGAME_ROUND_TABLE: 'Simule a reta final: a última mesa redonda (sem revelação) e o Fogo da Verdade, onde todos precisam concordar para encerrar.',
};

/** Palco de uma temporada automática: resultado da fase + a narrativa do que aconteceu. */
export function AutoPhase() {
  const { state, today, playersById } = useGame();
  const phase = state.phase!;
  const events = useMemo(() => eventsOf(today, phase), [today, phase]);
  const simulated = useGame().state.phaseSimulated;

  const conversations = useMemo(
    () => (STORY_PHASES.includes(phase) ? eventsAsConversations(events, playersById).slice(0, STORY_MAX_CONVERSATIONS) : []),
    [events, phase, playersById],
  );
  useShareConversations(conversations);

  if (phase === 'FINALE') return <FinalePhase />;

  // Fotos sempre no topo; no café, só depois de simular (antes, entregariam quem morreu).
  const showResult = phase !== 'BREAKFAST' || simulated;
  const finalRounds = today?.roundTables.filter((t) => t.kind === 'ENDGAME') ?? [];
  return (
    <>
      {showResult && <PhaseResult phase={phase} simulated={simulated} />}
      {!simulated && <p className={styles.prompt}>{PROMPT[phase]}</p>}
      {simulated && phase === 'ENDGAME_ROUND_TABLE' && <EndgameFeed events={events} rounds={finalRounds} playersById={playersById} />}
      {simulated && phase !== 'ENDGAME_ROUND_TABLE' && <EventFeed events={events} playersById={playersById} />}
    </>
  );
}

export function PhaseResult({ phase, simulated }: Readonly<{ phase: GamePhase; simulated: boolean }>) {
  const { state, today } = useGame();
  switch (phase) {
    case 'ARRIVAL':
      return <ArrivalPhase />;
    case 'BREAKFAST':
      return <BreakfastNews />;
    case 'TRAITOR_SELECTION': {
      const traitors = state.activePlayers.filter((p) => p.role === 'TRAITOR');
      return simulated && traitors.length ? (
        <div className={sharedStyles.section} style={{ marginTop: 0 }}>
          <h3 className={sharedStyles.sectionTitle}>Os traidores</h3>
          <PortraitGrid items={traitors} size="sm" caption={() => 'Traidor(a)'} />
        </div>
      ) : null;
    }
    case 'MISSION':
      return (
        <>
          {today?.missions.map((m) => (
            <MissionSummary key={m.id} mission={m} />
          ))}
        </>
      );
    case 'ROUND_TABLE': {
      const table = today?.roundTables.find((t) => t.kind === 'REGULAR');
      return table ? <RoundTableResult record={table} /> : null;
    }
    case 'ENDGAME_ROUND_TABLE':
      return null;
    case 'TRAITORS_MEETING':
      return today?.traitorsMeeting ? <MeetingResult meeting={today.traitorsMeeting} /> : null;
    default:
      return null;
  }
}
