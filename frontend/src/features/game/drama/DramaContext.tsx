import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { eventsOf, isTalk } from '../../../domain/events';
import type { SimulationEventRecord } from '../../../domain/models';
import { useGame } from '../context/GameContext';

/** O passo a passo de um momento no modo drama. */
export interface Drama {
  /** Quantos acontecimentos da história já apareceram. */
  shown: number;
  total: number;
  /** Tudo já apareceu: o resto da tela (resultado, escolhas, avançar) pode aparecer. */
  done: boolean;
  next: () => void;
  all: () => void;
}

/** Os números do cabeçalho. */
export interface Scoreboard {
  prizePot: number;
  active: number;
  eliminated: number;
}

const DramaContext = createContext<Drama | null>(null);

/** O progresso fica salvo na aba: recarregar a página não repete o que já foi visto. */
function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Sem armazenamento (aba privada, bloqueio): o progresso segue só na memória.
  }
}

function readSeen(key: string): number {
  return Number(read(key)) || 0;
}

/**
 * Modo drama (temporada jogável com a opção ligada): os acontecimentos de cada momento aparecem um de cada vez,
 * e o jogador avança quando terminar de ler. O primeiro já aparece; as suas conversas aparecem na hora.
 */
export function DramaProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { seasonId, state, today } = useGame();
  const phase = state.phase;
  const on = state.season.mode === 'PLAYER' && !!state.season.drama && !!phase && phase !== 'FINALE';
  const total = useMemo(() => (phase ? eventsOf(today, phase).filter((e) => !isTalk(e)).length : 0), [today, phase]);
  const key = `drama:${seasonId}:${state.day}:${phase}`;
  const [progress, setProgress] = useState(() => ({ key, seen: readSeen(key) }));
  // Outro momento: retoma o que já foi visto nele (sem piscar o progresso do anterior).
  const seen = progress.key === key ? progress.seen : readSeen(key);

  const go = useCallback(
    (n: number) => {
      setProgress({ key, seen: n });
      write(key, String(n));
    },
    [key],
  );

  const drama = useMemo<Drama | null>(() => {
    if (!on) return null;
    const shown = Math.min(total, Math.max(seen, 1));
    return { shown, total, done: shown >= total, next: () => go(shown + 1), all: () => go(total) };
  }, [on, seen, total, go]);

  return <DramaContext.Provider value={drama}>{children}</DramaContext.Provider>;
}

/** O drama do momento atual, ou null quando a temporada mostra tudo de uma vez. */
export function useDrama(): Drama | null {
  return useContext(DramaContext);
}

/** A história ainda está sendo contada: resultados, escolhas e o avançar esperam. */
export function useTelling(): boolean {
  const drama = useDrama();
  return !!drama && !drama.done;
}

/** Os acontecimentos até o `shown`-ésimo da história (as suas conversas no meio aparecem junto). */
export function storyPrefix(events: readonly SimulationEventRecord[], shown: number): SimulationEventRecord[] {
  let left = shown;
  for (let i = 0; i < events.length; i++) {
    if (isTalk(events[i])) continue;
    if (left === 0) return events.slice(0, i);
    left--;
  }
  return [...events];
}

/**
 * Prêmio, quem está no castelo e eliminados. No drama, os números ficam como estavam até a história
 * do momento terminar (senão entregariam a missão, o banimento ou quem não desceu para o café).
 * No café, a morte da noite já está no estado antes de simular: o placar só muda depois da revelação.
 */
export function useScoreboard(): Scoreboard {
  const { seasonId, state } = useGame();
  const drama = useDrama();
  const { prizePot } = state;
  const active = state.activePlayers.length;
  const eliminated = state.eliminatedPlayers.length;
  const settled = !drama || (state.phaseSimulated ? drama.done : state.phase !== 'BREAKFAST');
  const key = `drama-score:${seasonId}`;

  useEffect(() => {
    if (settled) write(key, JSON.stringify({ prizePot, active, eliminated }));
  }, [settled, key, prizePot, active, eliminated]);

  const live = { prizePot, active, eliminated };
  if (settled) return live;
  return parseScoreboard(read(key)) ?? live;
}

function parseScoreboard(raw: string | null): Scoreboard | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Scoreboard>;
    const numbers = [value.prizePot, value.active, value.eliminated];
    return numbers.every((n) => typeof n === 'number') ? (value as Scoreboard) : null;
  } catch {
    return null;
  }
}
