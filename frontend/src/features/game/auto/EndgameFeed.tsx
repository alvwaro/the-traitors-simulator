import type { Player, RoundTableRecord, SimulationEventRecord } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { EndgameRoundSummary } from '../phases/EndgameRoundTablePhase';
import { EventFeed } from './EventFeed';
import styles from './Auto.module.css';

/** A narração que abre cada etapa da reta final (ver SimulationEngine.endgame). */
const STAGE_START = /^(A última mesa redonda|O Fogo da Verdade)/;

interface Stage {
  fire: boolean;
  events: SimulationEventRecord[];
}

/**
 * Reta final em blocos separados: a última mesa redonda e cada rodada do Fogo da Verdade,
 * cada um com o próprio resultado e a própria narrativa (votos, banimento, reações).
 */
export function EndgameFeed({ events, rounds, playersById }: Readonly<{ events: SimulationEventRecord[]; rounds: RoundTableRecord[]; playersById: Map<string, Player> }>) {
  const lead: SimulationEventRecord[] = [];
  const stages: Stage[] = [];
  for (const e of events) {
    if (e.kind === 'NARRATION' && STAGE_START.test(e.text)) stages.push({ fire: e.text.startsWith('O Fogo'), events: [e] });
    else if (stages.length) stages.at(-1)!.events.push(e);
    else lead.push(e);
  }
  // Temporadas antigas (sem as etapas marcadas): tudo numa narrativa só.
  if (!stages.length) return <EventFeed events={events} playersById={playersById} />;

  let fireRound = 0;
  return (
    <>
      {lead.length > 0 && <EventFeed events={lead} playersById={playersById} />}
      {stages.map((stage, i) => {
        const title = stage.fire ? `O Fogo da Verdade · rodada ${++fireRound}` : 'A última mesa redonda';
        const round = rounds[i];
        return (
          <section key={stage.events[0].id} className={cx(styles.stage, stage.fire && styles.stageFire)}>
            <h3 className={styles.stageTitle}>{title}</h3>
            {round && <EndgameRoundSummary record={round} index={i + 1} inStage />}
            <EventFeed events={stage.events} playersById={playersById} />
          </section>
        );
      })}
    </>
  );
}
