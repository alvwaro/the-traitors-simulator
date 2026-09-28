import { useState } from 'react';
import type { Player, RoundTableRecord, SimulationEventRecord } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { EndgameRoundSummary } from '../phases/EndgameRoundTablePhase';
import { EventFeed } from './EventFeed';
import styles from './Auto.module.css';

/** A narração que abre cada etapa da reta final (ver SimulationEngine.endgame). */
const STAGE_START = /^(A última mesa redonda|O Fogo da Verdade)/;

type View = 'TABLE' | 'FIRE';

interface Stage {
  fire: boolean;
  events: SimulationEventRecord[];
  /** Posição entre as rodadas da reta final (casa com o registro da mesa). */
  index: number;
}

/**
 * Reta final em duas páginas: a última mesa redonda e o Fogo da Verdade (com as rodadas dele),
 * cada rodada com o próprio resultado e a própria narrativa. `focus` abre na etapa em andamento.
 */
export function EndgameFeed({
  events,
  rounds,
  playersById,
  focus,
}: Readonly<{ events: SimulationEventRecord[]; rounds: RoundTableRecord[]; playersById: Map<string, Player>; focus?: View }>) {
  const [picked, setPicked] = useState<View | null>(null);
  const lead: SimulationEventRecord[] = [];
  const stages: Stage[] = [];
  for (const e of events) {
    if (e.kind === 'NARRATION' && STAGE_START.test(e.text)) stages.push({ fire: e.text.startsWith('O Fogo'), events: [e], index: stages.length });
    else if (stages.length) stages.at(-1)!.events.push(e);
    else lead.push(e);
  }
  // Temporadas antigas (sem as etapas marcadas): tudo numa narrativa só.
  if (!stages.length) return <EventFeed events={events} playersById={playersById} />;

  const hasTable = stages.some((s) => !s.fire);
  const hasFire = stages.some((s) => s.fire);
  const view: View = picked ?? focus ?? (hasFire ? 'FIRE' : 'TABLE');
  const shown = stages.filter((s) => s.fire === (view === 'FIRE'));
  const tabs = hasTable && (hasFire || view === 'FIRE');
  const fireNumber = (stage: Stage) => stages.filter((s) => s.fire && s.index <= stage.index).length;

  return (
    <>
      {tabs && (
        <div className={styles.stageTabs} role="tablist" aria-label="Etapas da reta final">
          <button type="button" role="tab" aria-selected={view === 'TABLE'} className={cx(styles.stageTab, view === 'TABLE' && styles.stageTabOn)} onClick={() => setPicked('TABLE')}>
            A última mesa redonda
          </button>
          <button type="button" role="tab" aria-selected={view === 'FIRE'} className={cx(styles.stageTab, view === 'FIRE' && styles.stageTabOn)} onClick={() => setPicked('FIRE')}>
            O Fogo da Verdade
          </button>
        </div>
      )}
      {view === 'TABLE' && lead.length > 0 && <EventFeed events={lead} playersById={playersById} />}
      {shown.map((stage) => {
        const title = stage.fire ? `O Fogo da Verdade · rodada ${fireNumber(stage)}` : 'A última mesa redonda';
        const round = rounds[stage.index];
        return (
          <section key={stage.events[0].id} className={cx(styles.stage, stage.fire && styles.stageFire)}>
            <h3 className={styles.stageTitle}>{title}</h3>
            {round && <EndgameRoundSummary record={round} index={stage.index + 1} inStage />}
            <EventFeed events={stage.events} playersById={playersById} />
          </section>
        );
      })}
    </>
  );
}
