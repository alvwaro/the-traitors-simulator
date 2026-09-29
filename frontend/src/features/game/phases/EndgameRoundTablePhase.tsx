import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import type { EndgameChoice } from '../../../domain/enums';
import type { RoundTableRecord } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import type { EndgameRoundTableInput } from '../../../services/api/PhaseService';
import { BanishedRole } from '../components/BanishedRole';
import { EliminationReveal, type Elimination } from '../components/EliminationReveal';
import { useGame } from '../context/GameContext';
import { BanishmentPicker, banishmentOf, useBallot } from './shared/Banishment';
import styles from './shared/Shared.module.css';
import { fireAndForget } from '../../../lib/async';
import { gameRng } from '../../../lib/random';

/** Mesa final: rodadas de "encerrar ou banir de novo" até a unanimidade. */
export function EndgameRoundTablePhase() {
  const { today } = useGame();
  const [revealed, setRevealed] = useState<Elimination | null>(null);
  const rounds = today?.roundTables.filter((t) => t.kind === 'ENDGAME') ?? [];
  const finished = rounds.at(-1)?.endgameVotes.every((v) => v.choice === 'END_GAME') ?? false;

  return (
    <>
      {rounds.map((r, i) => (
        <EndgameRoundSummary key={r.id} record={r} index={i + 1} />
      ))}
      {finished ? (
        <p className={styles.news} style={{ marginTop: '1.2rem' }}>
          Todos votaram para encerrar. Avance para a final.
        </p>
      ) : (
        <EndgameRoundForm roundNumber={rounds.length + 1} onBanished={setRevealed} />
      )}
      <EliminationReveal elimination={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}

/** Resultado de uma rodada. `inStage`: dentro do bloco da etapa (o título do bloco já diz qual é). */
export function EndgameRoundSummary({ record, index, inStage = false }: Readonly<{ record: RoundTableRecord; index: number; inStage?: boolean }>) {
  const { playersById, state } = useGame();
  const banished = record.banishedPlayerId ? playersById.get(record.banishedPlayerId) : undefined;
  const ends = record.endgameVotes.filter((v) => v.choice === 'END_GAME').length;
  // Temporadas simuladas: a 1ª rodada é a última mesa redonda; as seguintes, o Fogo da Verdade.
  const simulated = state.season.mode !== 'MANUAL';
  const lastTable = simulated && index === 1 && ends === 0;
  const title = roundTitle({ inStage, simulated, lastTable, index, ends, total: record.endgameVotes.length });

  return (
    <div className={inStage ? undefined : styles.section}>
      <div className={styles.result}>
        {banished && <Portrait name={banished.name} imageUrl={banished.imageUrl} status="BANISHED" size="lg" hideName />}
        <div className={styles.resultText}>
          {title && <p className={styles.resultTitle}>{title}</p>}
          {banished ? (
            <p>
              {banished.name} banido(a) · <BanishedRole player={banished} traitorClass={styles.traitorText} faithfulClass={styles.faithfulText} />
            </p>
          ) : (
            <p className={styles.resultMeta}>Unanimidade: o jogo acabou.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EndgameRoundForm({ roundNumber, onBanished }: Readonly<{ roundNumber: number; onBanished: (e: Elimination) => void }>) {
  const { state, seasonId, refresh } = useGame();
  const { phases } = useServices();
  const players = state.activePlayers;
  const [choices, setChoices] = useState<Record<string, EndgameChoice>>({});
  const ballot = useBallot();

  const everyoneVoted = players.every((p) => choices[p.id]);
  const unanimous = everyoneVoted && players.every((p) => choices[p.id] === 'END_GAME');
  const needsBanishment = everyoneVoted && !unanimous;
  const { banishedId } = ballot;

  const save = useAction((input: EndgameRoundTableInput) => phases.endgameRoundTable(seasonId, input), {
    success: (r) => (r.banishedPlayerId ? 'Rodada registrada' : 'Jogo encerrado'),
  });

  function drawChoices() {
    setChoices(Object.fromEntries(players.map((p) => [p.id, gameRng() < 0.5 ? 'END_GAME' : 'BANISH_AGAIN'])));
  }

  async function handleSubmit() {
    const record = await save.run({
      endgameVotes: players.map((p) => ({ voterId: p.id, choice: choices[p.id] })),
      banishedPlayerId: needsBanishment ? banishedId : null,
      votes: needsBanishment ? ballot.votes : [],
    });
    if (!record) return;
    const banished = players.find((p) => p.id === record.banishedPlayerId);
    if (banished) onBanished(banishmentOf(banished, record));
    setChoices({});
    ballot.reset();
    refresh();
  }

  return (
    <div className={styles.formStack} style={{ marginTop: '1.2rem' }}>
      <div className={styles.drawBar} style={{ justifyContent: 'space-between', marginBottom: 0 }}>
        <h3 className={styles.sectionTitle}>Rodada {roundNumber}</h3>
        <Button variant="ghost" size="sm" onClick={drawChoices}>
          Sortear escolhas
        </Button>
      </div>
      <ul className={styles.choiceList}>
        {players.map((p) => (
          <li key={p.id} className={styles.choiceRow}>
            <Portrait name={p.name} imageUrl={p.imageUrl} size="xs" hideName />
            <div>
              <p className={styles.choiceName}>{p.name}</p>
              <div className={styles.toggle}>
                <button type="button" aria-pressed={choices[p.id] === 'END_GAME'} onClick={() => setChoices({ ...choices, [p.id]: 'END_GAME' })}>
                  Encerrar
                </button>
                <button type="button" className={styles.banish} aria-pressed={choices[p.id] === 'BANISH_AGAIN'} onClick={() => setChoices({ ...choices, [p.id]: 'BANISH_AGAIN' })}>
                  Banir de novo
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {needsBanishment && <BanishmentPicker players={players} ballot={ballot} />}

      <div className={styles.submitRow}>
        <span className={styles.muted}>{everyoneVoted ? '' : `${Object.keys(choices).length}/${players.length} votaram`}</span>
        <Button pending={save.pending} disabled={!everyoneVoted || (needsBanishment && !banishedId)} onClick={fireAndForget(handleSubmit)}>
          {unanimous ? 'Encerrar o jogo' : 'Registrar rodada'}
        </Button>
      </div>
    </div>
  );
}

/** Título da rodada: dentro do bloco da etapa, só o placar do fogo; fora, a etapa (ou "Rodada n" no modo manual). */
function roundTitle(r: { inStage: boolean; simulated: boolean; lastTable: boolean; index: number; ends: number; total: number }): string | null {
  const score = `${r.ends}/${r.total} para encerrar`;
  if (r.inStage) return r.lastTable ? null : `${r.ends} de ${r.total} para encerrar`;
  if (!r.simulated) return `Rodada ${r.index}: ${score}`;
  return r.lastTable ? 'A última mesa redonda' : `Fogo da Verdade: ${score}`;
}
