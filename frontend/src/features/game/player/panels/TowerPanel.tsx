import { useState } from 'react';
import { PortraitGrid } from '../../../../components/player/PortraitGrid';
import { Button } from '../../../../components/ui/Button';
import { DaggerIcon } from '../../../../components/ui/Icons';
import type { Player, PlayerView } from '../../../../domain/models';
import { cx } from '../../../../lib/cx';
import type { HumanDecision } from '../../../../services/api/SimulationService';
import { useGame } from '../../context/GameContext';
import { othersThan, toggleOne, useDecision, type OnResult } from '../useDecision';
import styles from '../Player.module.css';

/** O que a torre faz esta noite: assassinar, recrutar por carta, dar o ultimato ou pregar um caixão. */
type TowerMode = 'MURDER' | 'LETTER' | 'ULTIMATUM' | 'COFFIN';

const COFFINS = 3;

const HINT: Record<TowerMode, string> = {
  MURDER: 'Escolha a vítima. Os outros traidores também sugerem; vale a maioria, e no empate quem decide é você.',
  LETTER: 'Uma carta para um fiel. Se ele(a) recusar, ninguém morre esta noite.',
  ULTIMATUM: 'Cara a cara: juntar-se a você ou morrer. Se aceitar, vocês matam outro fiel juntos.',
  COFFIN: 'O caixão pregado: só um fiel entre os três.',
};

const ACTION: Record<TowerMode, (name: string) => string> = {
  MURDER: (name) => `Assassinar ${name}`,
  LETTER: (name) => `Enviar carta a ${name}`,
  ULTIMATUM: (name) => `Dar o ultimato a ${name}`,
  COFFIN: (name) => `Pregar o caixão de ${name}`,
};

/** A torre com você traidor(a): a escolha da noite (e, se for o Vidente, o jantar). */
export function TowerPanel({ me, onResult }: Readonly<{ me: PlayerView; onResult: OnResult }>) {
  const { state, playersById } = useGame();
  const [picked, setPicked] = useState<TowerMode>('MURDER');
  const [target, setTarget] = useState<string | null>(null);
  const [victim, setVictim] = useState<string | null>(null);
  const [coffins, setCoffins] = useState<string[]>([]);
  const [guest, setGuest] = useState<string | null>(null);
  const { send, pending } = useDecision(onResult);

  const mode: TowerMode = me.coffinNight ? 'COFFIN' : picked;
  const everyone = othersThan(state, me);
  const faithful = everyone.filter((p) => !me.fellowTraitorIds.includes(p.id));
  const pool = targetsFor(mode, faithful, me.dungeonIds, coffins);
  const chosen = playersById.get(target ?? '');
  const ready = !!chosen && (mode !== 'ULTIMATUM' || !!victim) && (mode !== 'COFFIN' || coffins.length === COFFINS) && (!me.seerPending || !!guest);

  function toggleCoffin(id: string) {
    setCoffins((list) => toggleMany(list, id, COFFINS));
    if (target === id) setTarget(null);
  }

  function submit() {
    if (!target) return;
    const seer: HumanDecision = me.seerPending ? { seerGuestId: guest } : {};
    void send({ ...decisionFor(mode, target, coffins, victim), ...seer });
  }

  return (
    <section className={cx(styles.panel, styles.tower)}>
      <h3 className={styles.panelTitle}>
        <DaggerIcon size={14} /> A torre
      </h3>
      {me.dungeonIds.length > 0 && <p className={styles.panelHint}>A masmorra limita a escolha: só os condenados podem morrer esta noite.</p>}
      {mode === 'COFFIN' && <CoffinPicker me={me} players={everyone} selected={coffins} onToggle={toggleCoffin} />}
      {mode !== 'COFFIN' && <ModePicker me={me} mode={picked} onChange={setPicked} />}
      <p className={styles.panelHint}>{HINT[mode]}</p>
      <PortraitGrid items={pool} size="sm" selectedIds={target ? [target] : []} onToggle={(id) => setTarget(toggleOne(target, id))} />
      {mode === 'ULTIMATUM' && target && (
        <>
          <p className={styles.panelHint}>Se aceitar, quem vocês matam juntos?</p>
          <PortraitGrid items={faithful.filter((p) => p.id !== target)} size="sm" selectedIds={victim ? [victim] : []} onToggle={(id) => setVictim(toggleOne(victim, id))} />
        </>
      )}
      {me.seerPending && (
        <>
          <p className={styles.panelHint}>Você é o(a) Vidente: com quem janta esta noite? A resposta será a verdade.</p>
          <PortraitGrid items={everyone} size="sm" selectedIds={guest ? [guest] : []} onToggle={(id) => setGuest(toggleOne(guest, id))} />
        </>
      )}
      <div className={styles.panelActions}>
        <Button pending={pending} disabled={!ready} onClick={submit}>
          {chosen ? ACTION[mode](chosen.name) : 'Escolha um nome'}
        </Button>
      </div>
    </section>
  );
}

/** Noite dos caixões: três nomes (pode incluir um parceiro, para parecer inocente). */
function CoffinPicker({ me, players, selected, onToggle }: Readonly<{ me: PlayerView; players: Player[]; selected: string[]; onToggle: (id: string) => void }>) {
  const missing = COFFINS - selected.length;
  return (
    <>
      <p className={styles.panelHint}>
        Esta noite o assassinato é à vista de todos. Escolha três nomes para os caixões (pode incluir um parceiro, para parecer inocente). Quem sair vivo(a) vira suspeito(a).
      </p>
      <PortraitGrid items={players} size="sm" selectedIds={selected} onToggle={onToggle} caption={(p) => (me.fellowTraitorIds.includes(p.id) ? 'Traidor(a)' : null)} />
      <p className={styles.panelHint}>{missing > 0 ? `Faltam ${missing} nome(s).` : 'Agora escolha qual caixão será pregado:'}</p>
    </>
  );
}

/** Assassinar ou recrutar (carta, ou ultimato para o último traidor). */
function ModePicker({ me, mode, onChange }: Readonly<{ me: PlayerView; mode: TowerMode; onChange: (mode: TowerMode) => void }>) {
  if (!me.canRecruit && !me.canUltimatum) return null;
  const option = (value: TowerMode, label: string, style: string) => (
    <button type="button" aria-pressed={mode === value} className={cx(styles.choiceButton, mode === value && style)} onClick={() => onChange(value)}>
      {label}
    </button>
  );
  return (
    <div className={styles.choice}>
      {option('MURDER', 'Assassinar', styles.choiceBanish)}
      {me.canRecruit && option('LETTER', 'Recrutar (carta)', styles.choiceEnd)}
      {me.canUltimatum && option('ULTIMATUM', 'Ultimato', styles.choiceBanish)}
    </div>
  );
}

/** Quem pode ser escolhido: na masmorra, só os condenados; nos caixões, só os fiéis que estão neles. */
function targetsFor(mode: TowerMode, faithful: Player[], dungeonIds: string[], coffins: string[]): Player[] {
  if (mode === 'COFFIN') return faithful.filter((p) => coffins.includes(p.id));
  if (mode === 'MURDER' && dungeonIds.length) return faithful.filter((p) => dungeonIds.includes(p.id));
  return faithful;
}

function decisionFor(mode: TowerMode, target: string, coffins: string[], victim: string | null): HumanDecision {
  if (mode === 'COFFIN') return { murderTargetId: target, coffinIds: coffins };
  if (mode === 'MURDER') return { murderTargetId: target };
  const ultimatum = mode === 'ULTIMATUM';
  return { recruit: { targetId: target, ultimatum, victimIfAcceptedId: ultimatum ? victim : null } };
}

/** Seleção de até `max` itens: clicar de novo desmarca; cheio, ignora novos. */
function toggleMany(list: string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length < max ? [...list, id] : list;
}
