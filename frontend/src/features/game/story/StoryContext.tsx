import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Conversation } from '../../../domain/phrases';
import type { VoteDraft } from '../../../services/api/PhaseService';

/** O que está na tela agora e ainda não foi registrado (a arte mostra exatamente o mesmo). */
interface StoryShared {
  conversations: Conversation[];
  /** Escudos escolhidos no formulário da missão. */
  shieldIds: string[];
  /** Votos marcados na mesa redonda. */
  votes: VoteDraft[];
}

interface StoryContextValue extends StoryShared {
  set: <K extends keyof StoryShared>(key: K, value: StoryShared[K]) => void;
}

const EMPTY: StoryShared = { conversations: [], shieldIds: [], votes: [] };
const StoryContext = createContext<StoryContextValue>({ ...EMPTY, set: () => {} });

export function StoryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [shared, setShared] = useState<StoryShared>(EMPTY);
  const [set] = useState(() => <K extends keyof StoryShared>(key: K, value: StoryShared[K]) => setShared((s) => ({ ...s, [key]: value })));
  return <StoryContext.Provider value={{ ...shared, set }}>{children}</StoryContext.Provider>;
}

export function useStoryShared(): StoryShared {
  return useContext(StoryContext);
}

export function useStoryConversations(): Conversation[] {
  return useContext(StoryContext).conversations;
}

/** Publica um valor da tela para a arte do Instagram; some quando o componente sai da tela. */
function useShare<K extends keyof StoryShared>(key: K, value: StoryShared[K]) {
  const { set } = useContext(StoryContext);
  useEffect(() => {
    set(key, value);
    return () => set(key, EMPTY[key]);
  }, [key, value, set]);
}

export function useShareConversations(conversations: Conversation[]) {
  useShare('conversations', conversations);
}

export function useShareShields(playerIds: string[]) {
  useShare('shieldIds', playerIds);
}

export function useShareVotes(votes: VoteDraft[]) {
  useShare('votes', votes);
}
