import { useState } from 'react';
import { useServices } from '../../../../app/services';
import { Portrait } from '../../../../components/player/Portrait';
import { PortraitGrid } from '../../../../components/player/PortraitGrid';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { HumanAction, SUBJECT_ACTIONS, TOWER_ACTIONS } from '../../../../domain/enums';
import { humanActionGroups, humanActionLabel } from '../../../../domain/labels';
import type { Player, PlayerView } from '../../../../domain/models';
import { useAction } from '../../../../hooks/useAction';
import { fireAndForget } from '../../../../lib/async';
import { cx } from '../../../../lib/cx';
import { useGame } from '../../context/GameContext';
import { othersThan } from '../useDecision';
import styles from '../Player.module.css';

/** Conversar com alguém (ou, na torre, debater com os outros traidores). Cada fala gasta uma conversa. */
export function TalkPanel({ me }: Readonly<{ me: PlayerView }>) {
  const { state, seasonId, refresh, playersById } = useGame();
  const { simulation } = useServices();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [action, setAction] = useState<HumanAction | null>(null);
  const talk = useAction((target: string, chosen: HumanAction, subject: string | null) => simulation.interact(seasonId, target, chosen, subject));
  const people = othersThan(state, me).filter((p) => !me.towerTalk || me.fellowTraitorIds.includes(p.id));
  const target = targetId ? playersById.get(targetId) : undefined;
  // De quem se pode falar: na torre, só fiéis; fora dela, qualquer um além de você e de quem ouve.
  const subjects = othersThan(state, me).filter((p) => p.id !== targetId && (!me.towerTalk || !me.fellowTraitorIds.includes(p.id)));

  function close() {
    setTargetId(null);
    setAction(null);
  }

  async function run(chosen: HumanAction, subject: string | null = null) {
    if (!targetId) return;
    const result = await talk.run(targetId, chosen, subject);
    close();
    if (result) refresh();
  }

  function choose(chosen: HumanAction) {
    if (SUBJECT_ACTIONS.includes(chosen)) setAction(chosen);
    else void run(chosen);
  }

  const hint = me.towerTalk
    ? 'Debata com os outros traidores quem morre ou quem recrutar. Quem você convencer vota com você esta noite.'
    : 'Clique na foto de alguém para falar com ele(a). O que você diz em público chega a quem estiver ouvindo, e os amigos (e inimigos) de quem você citar reagem.';

  return (
    <section className={cx(styles.panel, me.towerTalk && styles.tower)}>
      <h3 className={styles.panelTitle}>{me.towerTalk ? 'Debate na torre' : 'Conversar'}</h3>
      {me.towerTalk && <TowerIntents me={me} playersById={playersById} />}
      <p className={styles.panelHint}>
        {hint} Restam {me.interactionsLeft} {me.interactionsLeft === 1 ? 'conversa' : 'conversas'}.
      </p>
      <PortraitGrid items={people} size="sm" onToggle={setTargetId} caption={(p) => (me.fellowTraitorIds.includes(p.id) ? 'Traidor(a)' : null)} />

      <Modal
        open={!!target}
        wide={!action}
        title={modalTitle(target, action)}
        onClose={close}
        footer={
          <Button variant="quiet" onClick={action ? () => setAction(null) : close}>
            {action ? 'Voltar' : 'Cancelar'}
          </Button>
        }
      >
        {target && !action && <ActionMenu me={me} target={target} disabled={talk.pending} onChoose={choose} />}
        {target && action && (
          <>
            <p className={styles.panelHint}>{humanActionLabel[action].hint}</p>
            <PortraitGrid items={subjects} size="xs" onToggle={fireAndForget((id) => run(action, id))} isDisabled={() => talk.pending} />
          </>
        )}
      </Modal>
    </section>
  );
}

function modalTitle(target: Player | undefined, action: HumanAction | null): string {
  if (!target) return '';
  return action ? `${humanActionLabel[action].label}: de quem?` : `Falar com ${target.name}`;
}

/** O que dá para dizer, em quatro colunas (ataque, apoio, conversa, torre). */
function ActionMenu({ me, target, disabled, onChoose }: Readonly<{ me: PlayerView; target: Player; disabled: boolean; onChoose: (a: HumanAction) => void }>) {
  const allowed = (a: HumanAction) => me.allowedActions.includes(a) && TOWER_ACTIONS.includes(a) === me.towerTalk;
  const groups = humanActionGroups.map((g) => ({ ...g, actions: g.actions.filter(allowed) })).filter((g) => g.actions.length > 0);
  return (
    <div className={styles.actions}>
      <div className={styles.actionsHead}>
        <Portrait name={target.name} imageUrl={target.imageUrl} size="sm" hideName />
      </div>
      <div className={styles.actionColumns}>
        {groups.map((group) => (
          <div key={group.key} className={cx(styles.actionColumn, styles[`group-${group.key}`])}>
            <h4 className={styles.actionGroup}>{group.label}</h4>
            {group.actions.map((a) => (
              <button key={a} type="button" className={cx(styles.action, styles[`action-${a}`])} disabled={disabled} onClick={() => onChoose(a)}>
                <span className={styles.actionLabel}>{humanActionLabel[a].label}</span>
                <span className={styles.actionHint}>{humanActionLabel[a].hint}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Na torre: o que cada parceiro pretende esta noite e por quê. */
function TowerIntents({ me, playersById }: Readonly<{ me: PlayerView; playersById: Map<string, Player> }>) {
  if (!me.towerIntents.length) return null;
  return (
    <ul className={styles.intents}>
      {me.towerIntents.map((intent) => {
        const partner = playersById.get(intent.traitorId);
        const victim = playersById.get(intent.targetId);
        if (!partner || !victim) return null;
        return (
          <li key={intent.traitorId} className={cx(styles.intent, intent.pledged && styles.intentPledged)}>
            <Portrait name={partner.name} imageUrl={partner.imageUrl} size="xs" hideName />
            <span>
              <strong>{partner.name}</strong> quer <strong>{victim.name}</strong>: {intent.reason}.
            </span>
            <Portrait name={victim.name} imageUrl={victim.imageUrl} size="xs" hideName />
          </li>
        );
      })}
    </ul>
  );
}
