import { useMemo, useState } from 'react';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Form';
import type { PhrasePhase } from '../../../domain/enums';
import { useGame } from '../context/GameContext';
import { generateConversations } from '../../../domain/phrases';
import { useShareConversations } from '../story/StoryContext';
import styles from './ConversationFeed.module.css';

/** Quantas conversas cada café da manhã e cada missão podem ter. */
const MIN_CONVERSATIONS = 1;
const MAX_CONVERSATIONS = 10;
const DEFAULT_CONVERSATIONS = 3;
const COUNT_OPTIONS = Array.from({ length: MAX_CONVERSATIONS - MIN_CONVERSATIONS + 1 }, (_, i) => MIN_CONVERSATIONS + i);

/** A quantidade escolhida fica salva neste navegador, por temporada, dia e fase. */
function readCount(key: string): number {
  try {
    const saved = Number(localStorage.getItem(key));
    return saved >= MIN_CONVERSATIONS && saved <= MAX_CONVERSATIONS ? saved : DEFAULT_CONVERSATIONS;
  } catch {
    return DEFAULT_CONVERSATIONS;
  }
}

function saveCount(key: string, count: number) {
  try {
    localStorage.setItem(key, String(count));
  } catch {
    // sem armazenamento (ex.: janela privada): vale só enquanto a página estiver aberta
  }
}

/** Conversas simuladas entre os personagens ativos, com as frases da biblioteca. */
export function ConversationFeed({ phase }: Readonly<{ phase: PhrasePhase }>) {
  const { state, seasonId, phrases } = useGame();
  const [draw, setDraw] = useState(0);
  const storageKey = `traitors:conversas:${seasonId}:${state.day}:${phase}`;
  const [count, setCount] = useState(() => readCount(storageKey));

  const conversations = useMemo(
    () =>
      generateConversations({
        templates: phrases.filter((p) => p.phase === phase).map((p) => p.text),
        players: state.activePlayers,
        count,
        seed: `${seasonId}:${state.day}:${phase}:${draw}`,
      }),
    [phrases, state.activePlayers, seasonId, state.day, phase, draw, count],
  );

  useShareConversations(conversations);

  if (conversations.length === 0) return null;

  function changeCount(next: number) {
    setCount(next);
    saveCount(storageKey, next);
  }

  return (
    <section className={styles.feed}>
      <div className={styles.header}>
        <h3 className={styles.title}>Conversas</h3>
        <div className={styles.controls}>
          <label className={styles.countLabel}>
            Frases
            <Select className={styles.count} value={count} onChange={(e) => changeCount(Number(e.target.value))}>
              {COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="quiet" size="sm" onClick={() => setDraw((d) => d + 1)}>
            Outras conversas
          </Button>
        </div>
      </div>
      {conversations.length < count && (
        <p className={styles.note}>Só há {conversations.length} frase(s) desta fase na biblioteca que cabem no elenco atual.</p>
      )}
      {conversations.map((c) => (
        <article key={c.key} className={styles.conversation}>
          <div className={styles.faces}>
            {c.players.map((p) => (
              <Portrait key={p.id} name={p.name} imageUrl={p.imageUrl} size="sm" />
            ))}
          </div>
          <p className={styles.line}>
            {c.parts.map((part, i) =>
              part.kind === 'text' ? <span key={i}>{part.text}</span> : <strong key={i}>{part.player.name}</strong>,
            )}
          </p>
        </article>
      ))}
    </section>
  );
}
