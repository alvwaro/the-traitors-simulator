import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DayHistory, GameState, Phrase, Player, SeasonHistory } from '../../../domain/models';

export interface GameContextValue {
  seasonId: string;
  state: GameState;
  history: SeasonHistory;
  /** Frases cadastradas na biblioteca, usadas nas conversas simuladas. */
  phrases: Phrase[];
  /** Todos os jogadores da temporada por id (ativos e eliminados). */
  playersById: Map<string, Player>;
  /** Registro do dia atual e do anterior (para o café da manhã). */
  today: DayHistory | undefined;
  yesterday: DayHistory | undefined;
  /** Recarrega estado e histórico depois de qualquer registro. */
  refresh: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  seasonId: string;
  state: GameState;
  history: SeasonHistory;
  phrases: Phrase[];
  refresh: () => void;
  children: ReactNode;
}

export function GameProvider({ seasonId, state, history, phrases, refresh, children }: Readonly<GameProviderProps>) {
  const value = useMemo<GameContextValue>(() => {
    const today = history.days.find((d) => d.day.number === state.day);
    const yesterday = history.days.find((d) => d.day.number === (state.day ?? 0) - 1);
    return {
      seasonId,
      state,
      history,
      phrases,
      playersById: new Map(history.players.map((p) => [p.id, p])),
      today,
      yesterday,
      refresh,
    };
  }, [seasonId, state, history, phrases, refresh]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const game = useContext(GameContext);
  if (!game) throw new Error('useGame precisa estar dentro de <GameProvider>');
  return game;
}
