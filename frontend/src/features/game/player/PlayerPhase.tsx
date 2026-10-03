import { useMemo, useState, type ReactNode } from 'react';
import type { GamePhase } from '../../../domain/enums';
import { eventsOf, isTalk } from '../../../domain/events';
import type { Player, PlayerNeed, PlayerView, RoundTableRecord, SimulationEventRecord } from '../../../domain/models';
import { AutoPhase, PhaseResult } from '../auto/AutoPhase';
import { EndgameFeed } from '../auto/EndgameFeed';
import { EventFeed } from '../auto/EventFeed';
import { EliminationReveal, type Elimination } from '../components/EliminationReveal';
import { useGame } from '../context/GameContext';
import { InvitesPanel } from './panels/InvitesPanel';
import { MissionPanel } from './panels/MissionPanel';
import { OfferPanel } from './panels/OfferPanel';
import { SeerAnnouncePanel, SeerPanel } from './panels/SeerPanels';
import { TalkPanel } from './panels/TalkPanel';
import { TowerPanel } from './panels/TowerPanel';
import { FireOfTruthPanel, VotePanel } from './panels/VotePanels';
import { DramaControls } from '../drama/DramaControls';
import { useDrama } from '../drama/DramaContext';
import type { OnResult } from './useDecision';
import { RoleReveal, SpectatorBanner, YouCard } from './YouCard';
import styles from './Player.module.css';

/** O que aparece antes de simular cada momento, do ponto de vista de quem está jogando. */
const PROMPT: Partial<Record<GamePhase, string>> = {
  ARRIVAL: 'Você acabou de chegar ao castelo. Converse com quem quiser e, quando estiver pronto(a), continue.',
  TRAITOR_SELECTION: 'Meia-noite. Olhos vendados, todos em círculo. Continue para saber se o toque no ombro será seu.',
  BREAKFAST: 'Hora do café da manhã. Continue para ver quem desce as escadas (e quem não desce). Depois, converse.',
  MISSION: 'A missão do dia vai começar. Converse com o grupo e depois continue.',
  ROUND_TABLE: 'As velas da mesa redonda estão acesas. Faça sua campanha e depois vote.',
  TRAITORS_MEETING: 'A noite cai sobre o castelo. Você vai dormir sem saber quem estará no café amanhã.',
  ENDGAME_ROUND_TABLE: 'A reta final. Primeiro, a última mesa redonda: quem sair não revela o papel. Depois, o Fogo da Verdade: para encerrar o jogo, todos precisam concordar.',
};

/** Momentos que mostram a parede de fotos do elenco. */
const WALL_PHASES: GamePhase[] = ['ARRIVAL', 'BREAKFAST'];

/** Painel de cada decisão que o jogo espera de você. */
const DECISION_PANELS: Record<PlayerNeed, (me: PlayerView, onResult: OnResult) => ReactNode> = {
  OFFER: () => null,
  SEER_ANNOUNCE: (me, onResult) => <SeerAnnouncePanel me={me} onResult={onResult} />,
  VOTE: (me, onResult) => <VotePanel me={me} onResult={onResult} kind={me.finalStage === 'TABLE' ? 'FINAL_TABLE' : 'REGULAR'} />,
  REVOTE: (me, onResult) => <VotePanel me={me} onResult={onResult} kind="TIE" />,
  FINAL_TABLE: (me, onResult) => <FireOfTruthPanel me={me} onResult={onResult} />,
  FIRE_VOTE: (me, onResult) => <VotePanel me={me} onResult={onResult} kind="FIRE" />,
  TOWER: (me, onResult) => <TowerPanel me={me} onResult={onResult} />,
  SEER: (me, onResult) => <SeerPanel me={me} onResult={onResult} />,
  MISSION: (me, onResult) => <MissionPanel me={me} onResult={onResult} />,
};

/** Tela do modo Jogador: o usuário é um participante e só vê o que um participante veria. */
export function PlayerPhase() {
  const { state, today, playersById } = useGame();
  const me = state.player!;
  const phase = state.phase!;
  const events = useMemo(() => eventsOf(today, phase), [today, phase]);
  const talk = useMemo(() => events.filter(isTalk), [events]);
  const story = useMemo(() => events.filter((e) => !isTalk(e)), [events]);
  const simulated = state.phaseSimulated;
  const [revealed, setRevealed] = useState<Elimination | null>(null);
  const drama = useDrama();

  if (me.spectator) {
    return (
      <>
        {!me.isActive && <SpectatorBanner me={me} />}
        <AutoPhase />
      </>
    );
  }

  const faithfulNight = phase === 'TRAITORS_MEETING' && me.role !== 'TRAITOR' && !me.pendingOffer && me.need !== 'SEER';
  // Drama: enquanto a história do momento aparece aos poucos, o resultado e as escolhas esperam.
  const playing = !!drama && !drama.done;
  const showResult = shouldShowResult(phase, me, simulated, faithfulNight) && !playing;
  // A página segue a ordem dos acontecimentos: no café, primeiro a revelação e depois as conversas;
  // nos outros momentos, primeiro as conversas, depois o que aconteceu e, por último, a escolha da vez.
  const breakfast = phase === 'BREAKFAST';
  const wall = WALL_PHASES.includes(phase);
  const finalRounds = today?.roundTables.filter((t) => t.kind === 'ENDGAME') ?? [];
  const storyFeed = (
    <>
      <StoryFeed
        phase={phase}
        story={drama ? story.slice(0, drama.shown) : story}
        rounds={finalRounds}
        playersById={playersById}
        focus={me.finalStage}
        prompt={!simulated && talk.length === 0 && me.need !== 'MISSION'}
        staged={!playing}
      />
      <DramaControls />
    </>
  );
  // No drama, quem saiu aparece na própria história, passo a passo (a cena de eliminação entregaria antes).
  const decision = me.need && !playing && DECISION_PANELS[me.need](me, drama ? noReveal : setRevealed);
  const conversation = (
    <>
      {me.canTalk && !playing && <TalkPanel me={me} />}
      {talk.length > 0 && <EventFeed events={talk} playersById={playersById} />}
    </>
  );

  return (
    <>
      <YouCard me={me} phase={phase} />

      {phase === 'TRAITOR_SELECTION' && simulated && !playing && <RoleReveal me={me} playersById={playersById} />}
      {/* A parede de fotos (chegada e café) fica sempre no topo. */}
      {showResult && wall && <PhaseResult phase={phase} simulated={simulated} />}
      {me.pendingOffer && !playing && <OfferPanel me={me} onResult={drama ? noReveal : setRevealed} />}

      {breakfast ? (
        <>
          {storyFeed}
          {decision}
          {conversation}
        </>
      ) : (
        <>
          {conversation}
          {storyFeed}
          {decision}
          {showResult && !wall && <PhaseResult phase={phase} simulated={simulated} />}
        </>
      )}
      {faithfulNight && simulated && <p className={styles.prompt}>A noite passou. O que aconteceu na torre você só vai descobrir no café da manhã.</p>}

      {/* Pedidos de aliança sempre no fim da página, para não se perderem no meio da história. */}
      {me.invites.length > 0 && !me.need && !playing && <InvitesPanel me={me} />}

      <EliminationReveal elimination={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}

/**
 * Parede de fotos (chegada e café): some enquanto você escolhe com quem falar, para não duplicar os rostos;
 * no café, ela só aparece depois da revelação. Na escolha dos traidores e na noite do fiel, não aparece.
 */
function shouldShowResult(phase: GamePhase, me: PlayerView, simulated: boolean, faithfulNight: boolean): boolean {
  if (phase === 'TRAITOR_SELECTION' || faithfulNight) return false;
  if (!WALL_PHASES.includes(phase)) return true;
  return !me.canTalk && (phase !== 'BREAKFAST' || simulated);
}

/** Sem a cena de eliminação (no drama, a saída já aparece na história). */
const noReveal: OnResult = () => undefined;

/**
 * A história da fase (a reta final em blocos: última mesa e rodadas do fogo) ou, antes de simular, o convite.
 * `staged`: false enquanto o drama ainda revela a história (os blocos da reta final mostram o resultado antes).
 */
function StoryFeed({
  phase,
  story,
  rounds,
  playersById,
  focus,
  prompt,
  staged,
}: Readonly<{ phase: GamePhase; story: SimulationEventRecord[]; rounds: RoundTableRecord[]; playersById: Map<string, Player>; focus: PlayerView['finalStage']; prompt: boolean; staged: boolean }>) {
  if (story.length === 0) return prompt ? <p className={styles.prompt}>{PROMPT[phase]}</p> : null;
  if (phase === 'ENDGAME_ROUND_TABLE' && staged) return <EndgameFeed events={story} rounds={rounds} playersById={playersById} focus={focus ?? undefined} key={focus ?? 'none'} />;
  return <EventFeed events={story} playersById={playersById} />;
}
