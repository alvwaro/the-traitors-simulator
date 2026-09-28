import { useState } from 'react';
import { PortraitGrid } from '../../../../components/player/PortraitGrid';
import { Button } from '../../../../components/ui/Button';
import type { EndgameChoice } from '../../../../domain/enums';
import type { PlayerView } from '../../../../domain/models';
import { fireAndForget } from '../../../../lib/async';
import { cx } from '../../../../lib/cx';
import { useGame } from '../../context/GameContext';
import { othersThan, toggleOne, useDecision, type OnResult } from '../useDecision';
import styles from '../Player.module.css';

/** Tipo de votação: mesa comum, revotação de empate ou a última mesa redonda (sem revelação). */
export type VoteKind = 'REGULAR' | 'TIE' | 'FINAL_TABLE';

const VOTE_TEXT: Record<VoteKind, { title: string; hint: string }> = {
  REGULAR: { title: 'Seu voto', hint: 'Escolha quem você quer banir. Os outros votam ao mesmo tempo; você vê o resultado na hora.' },
  TIE: { title: 'Empate: vote de novo', hint: 'A mesa empatou. Na revotação, só dá para votar em quem empatou. Se empatar de novo, a sorte decide.' },
  FINAL_TABLE: {
    title: 'A última mesa redonda',
    hint: 'Sem assassinatos, sem revelação: quem sair hoje leva o segredo. Depois desta mesa vem o Fogo da Verdade.',
  },
};

/** Seu voto na mesa. No empate, a revotação é só entre os empatados. */
export function VotePanel({ me, onResult, kind }: Readonly<{ me: PlayerView; onResult: OnResult; kind: VoteKind }>) {
  const { state } = useGame();
  const [target, setTarget] = useState<string | null>(null);
  const { send, pending } = useDecision(onResult);
  const chosen = state.activePlayers.find((p) => p.id === target);
  const everyone = othersThan(state, me);
  const options = kind === 'TIE' ? everyone.filter((p) => me.tiedIds.includes(p.id)) : everyone;
  const text = VOTE_TEXT[kind];
  return (
    <section className={cx(styles.panel, kind === 'TIE' && styles.tie)}>
      <h3 className={styles.panelTitle}>{text.title}</h3>
      <p className={styles.panelHint}>{text.hint}</p>
      <PortraitGrid items={options} size="sm" selectedIds={target ? [target] : []} onToggle={(id) => setTarget(toggleOne(target, id))} />
      <div className={styles.panelActions}>
        <Button pending={pending} disabled={!chosen} onClick={fireAndForget(() => send({ voteTargetId: target }))}>
          {chosen ? `Votar em ${chosen.name}` : 'Escolha um nome'}
        </Button>
      </div>
    </section>
  );
}

/** O Fogo da Verdade: encerrar o jogo (só com todos de acordo) ou continuar, e o voto se houver banimento. */
export function FireOfTruthPanel({ me, onResult }: Readonly<{ me: PlayerView; onResult: OnResult }>) {
  const { state } = useGame();
  const [choice, setChoice] = useState<EndgameChoice | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const { send, pending } = useDecision(onResult);
  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>O Fogo da Verdade</h3>
      <p className={styles.panelHint}>
        Todos precisam concordar para encerrar o jogo. Se alguém quiser continuar, há mais um banimento (sem revelação) e todos voltam ao fogo; por isso escolha também o seu voto.
      </p>
      <div className={styles.choice}>
        <button type="button" aria-pressed={choice === 'END_GAME'} className={cx(styles.choiceButton, choice === 'END_GAME' && styles.choiceEnd)} onClick={() => setChoice('END_GAME')}>
          Encerrar o jogo
        </button>
        <button type="button" aria-pressed={choice === 'BANISH_AGAIN'} className={cx(styles.choiceButton, choice === 'BANISH_AGAIN' && styles.choiceBanish)} onClick={() => setChoice('BANISH_AGAIN')}>
          Continuar e banir mais alguém
        </button>
      </div>
      <p className={styles.panelHint}>Se houver banimento, você vota em:</p>
      <PortraitGrid items={othersThan(state, me)} size="sm" selectedIds={target ? [target] : []} onToggle={(id) => setTarget(toggleOne(target, id))} />
      <div className={styles.panelActions}>
        <Button pending={pending} disabled={!choice || !target} onClick={fireAndForget(() => send({ endgameChoice: choice, voteTargetId: target }))}>
          Confirmar
        </Button>
      </div>
    </section>
  );
}
