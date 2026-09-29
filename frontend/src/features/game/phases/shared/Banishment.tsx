import { useMemo, useState } from 'react';
import { PortraitGrid } from '../../../../components/player/PortraitGrid';
import type { Player, RoundTableRecord } from '../../../../domain/models';
import { tally } from '../../../../domain/votes';
import type { VoteDraft } from '../../../../services/api/PhaseService';
import type { Elimination } from '../../components/EliminationReveal';
import { useShareVotes } from '../../story/StoryContext';
import { VoteBoard } from './VoteBoard';
import styles from './Shared.module.css';

/** Votos de uma mesa e quem será banido: sem escolha manual, o mais votado (sem empate) é sugerido. */
export function useBallot() {
  const [votes, setVotes] = useState<VoteDraft[]>([]);
  useShareVotes(votes);
  const [chosen, setChosen] = useState<string | null>(null);
  const leaders = useMemo(() => tally(votes).leaders, [votes]);
  const banishedId = chosen ?? (leaders.length === 1 ? leaders[0] : null);
  return {
    votes,
    setVotes,
    leaders,
    banishedId,
    /** Clicar em quem já está escolhido desfaz a escolha. */
    toggle: (id: string) => setChosen(id === banishedId ? null : id),
    reset: () => {
      setVotes([]);
      setChosen(null);
    },
  };
}

export type Ballot = ReturnType<typeof useBallot>;

/** Quadro de votos e a escolha do banido (com "Mais votado(a)" sob os líderes, se pedido). */
export function BanishmentPicker({ players, ballot, markLeaders = false }: Readonly<{ players: Player[]; ballot: Ballot; markLeaders?: boolean }>) {
  return (
    <>
      <VoteBoard players={players} value={ballot.votes} onChange={ballot.setVotes} />
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Banido(a)</h3>
        <PortraitGrid
          items={players}
          size="sm"
          selectedIds={ballot.banishedId ? [ballot.banishedId] : []}
          onToggle={ballot.toggle}
          caption={markLeaders ? (p) => (ballot.leaders.includes(p.id) ? 'Mais votado(a)' : null) : undefined}
        />
      </div>
    </>
  );
}

/** A revelação de quem a mesa baniu (o papel que a API revelou ou o que a tela já sabia). */
export function banishmentOf(player: Player, record: RoundTableRecord): Elimination {
  return { player, kind: 'BANISHED', role: record.revealedRole ?? player.role };
}
