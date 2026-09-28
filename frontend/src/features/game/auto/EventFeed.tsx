import { Fragment, type ReactNode } from "react";
import { Portrait } from "../../../components/player/Portrait";
import { DaggerIcon, ShieldIcon } from "../../../components/ui/Icons";
import { renderEvent, type RenderedEvent } from "../../../domain/events";
import type { Player, SimulationEventRecord } from "../../../domain/models";
import type { ConversationPart } from "../../../domain/phrases";
import { cx } from "../../../lib/cx";
import styles from "./Auto.module.css";

type Block =
  | { kind: "single"; item: RenderedEvent }
  | { kind: "votes"; items: RenderedEvent[] };

/** Partes da narrativa separadas por uma divisória discreta. */
type Section = "talk" | "story" | "votes" | "reveal" | "approach";

const SECTION_LABEL: Record<Section, string> = {
  talk: "Suas conversas",
  story: "No castelo",
  votes: "Votação",
  reveal: "Revelação",
  approach: "Vieram falar com você",
};

/** Narrações logo depois da votação ou de uma revelação continuam na mesma parte. */
const STICKY = new Set(["NARRATION", "BETRAYAL", "SECRET"]);

function sectionOf(block: Block, previous: Section | undefined): Section {
  if (block.kind === "votes") return "votes";
  const kind = block.item.event.kind;
  if (kind === "PLAYER" || kind === "REACTION") return "talk";
  if (kind === "APPROACH") return "approach";
  if (kind === "REVEAL" || kind === "MURDER") return "reveal";
  if (STICKY.has(kind) && (previous === "votes" || previous === "reveal"))
    return previous;
  return "story";
}

function Divider({ label }: Readonly<{ label: string }>) {
  return (
    <div className={styles.divider} role="separator">
      <span>{label}</span>
    </div>
  );
}

/** Votos seguidos viram um bloco só (a votação); o resto fica na ordem em que aconteceu. */
function toBlocks(items: RenderedEvent[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    const last = blocks.at(-1);
    if (item.event.kind === "VOTE" && last?.kind === "votes")
      last.items.push(item);
    else if (item.event.kind === "VOTE")
      blocks.push({ kind: "votes", items: [item] });
    else blocks.push({ kind: "single", item });
  }
  return blocks;
}

function Line({ parts }: Readonly<{ parts: ConversationPart[] }>) {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <strong key={i}>{part.player.name}</strong>
        ),
      )}
    </>
  );
}

function Faces({
  item,
  size = "sm",
}: Readonly<{
  item: RenderedEvent;
  size?: "xs" | "sm" | "md" | "lg";
}>) {
  if (item.players.length === 0) return null;
  return (
    <div className={styles.faces}>
      {item.players.map((p) => (
        <Portrait
          key={p.id}
          name={p.name}
          imageUrl={p.imageUrl}
          status={p.status}
          size={size}
          hideName={size === "xs"}
        />
      ))}
    </div>
  );
}

function Single({ item }: Readonly<{ item: RenderedEvent }>) {
  const { event } = item;
  let icon: ReactNode = null;
  if (event.kind === "SHIELD") icon = <ShieldIcon size={14} />;
  if (event.kind === "MURDER" || event.kind === "SECRET")
    icon = <DaggerIcon size={14} />;

  switch (event.kind) {
    case "DIALOGUE":
      // Todas as falas no mesmo formato: rostos e a frase (sem rótulo de teor).
      return (
        <article className={styles.dialogue}>
          <Faces item={item} />
          <p className={styles.line}>
            <Line parts={item.parts} />
          </p>
          {event.isPrivate && (
            <span className={styles.privateTag}>Em particular</span>
          )}
        </article>
      );
    case "APPROACH":
      return (
        <article
          className={cx(styles.exchange, styles.theirs, styles.approach)}
        >
          <Faces item={item} size="xs" />
          <p className={styles.line}>
            <Line parts={item.parts} />
          </p>
        </article>
      );
    case "PLAYER":
    case "REACTION":
      return (
        <article
          className={cx(
            styles.exchange,
            event.kind === "PLAYER" ? styles.mine : styles.theirs,
          )}
        >
          <Faces item={item} size="xs" />
          <p className={styles.line}>
            <Line parts={item.parts} />
          </p>
        </article>
      );
    case "REVEAL":
    case "MURDER":
      return (
        <article
          className={cx(
            styles.dramatic,
            event.kind === "MURDER" && styles.murder,
          )}
        >
          <Faces item={item} size="md" />
          <p className={styles.dramaticLine}>
            <Line parts={item.parts} />
          </p>
        </article>
      );
    case "SECRET":
    case "RECRUITMENT":
      return (
        <article className={styles.secret}>
          <span className={styles.secretTag}>{icon} Só o público vê</span>
          <Faces item={item} size="xs" />
          <p className={styles.line}>
            <Line parts={item.parts} />
          </p>
        </article>
      );
    case "ALLIANCE":
    case "BETRAYAL":
    case "SHIELD":
      return (
        <article
          className={cx(
            styles.highlight,
            event.kind === "BETRAYAL" && styles.betrayal,
          )}
        >
          <Faces item={item} size="xs" />
          <p>
            {icon} <Line parts={item.parts} />
          </p>
        </article>
      );
    default:
      return (
        <div className={styles.narration}>
          {item.players.length > 0 && <Faces item={item} size="xs" />}
          <p>
            <Line parts={item.parts} />
          </p>
        </div>
      );
  }
}

/** Placar da votação: quantos votos cada um recebeu, do mais votado ao menos. */
function tallyOf(items: RenderedEvent[]): { player: Player; votes: number }[] {
  const counts = new Map<string, { player: Player; votes: number }>();
  for (const { players } of items) {
    const target = players[1];
    if (!target) continue;
    const entry = counts.get(target.id) ?? { player: target, votes: 0 };
    entry.votes++;
    counts.set(target.id, entry);
  }
  return [...counts.values()].sort((a, b) => b.votes - a.votes);
}

/**
 * Votação em duas colunas lado a lado; cada uma mostra quem votou → em quem votou.
 * No Fogo da Verdade (sem alvo), a última coluna mostra a escolha.
 */
function Votes({ items }: Readonly<{ items: RenderedEvent[] }>) {
  const tally = tallyOf(items);
  const fire = items.every(({ players }) => players.length < 2);
  const half = Math.ceil(items.length / 2);
  const columns =
    items.length > 3 ? [items.slice(0, half), items.slice(half)] : [items];
  return (
    <div className={styles.votes}>
      <h4 className={styles.votesTitle}>
        {fire ? "Escolhas no fogo" : "Votos"}
      </h4>
      {tally.length > 0 && (
        <p className={styles.tally}>
          {tally.map(({ player, votes }) => (
            <span key={player.id} className={styles.tallyItem}>
              {player.name} <strong>{votes}</strong>
            </span>
          ))}
        </p>
      )}
      <div
        className={cx(
          styles.voteColumns,
          columns.length > 1 && styles.voteColumnsTwo,
        )}
      >
        {columns.map((column, c) => (
          <div key={c} className={styles.voteColumn}>
            <VoteTable items={column} fire={fire} />
          </div>
        ))}
      </div>
    </div>
  );
}

function VoteTable({ items, fire }: Readonly<{ items: RenderedEvent[]; fire: boolean }>) {
  return (
    <table className={styles.voteTable}>
      <thead>
        <tr>
          <th scope="col">Quem votou</th>
          <th scope="col" aria-label="votou em" />
          <th scope="col">{fire ? "Escolha" : "Em quem"}</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ event, players, parts }) => {
          const [voter, target] = players;
          return (
            <tr key={event.id}>
              <td>
                {voter && (
                  <span className={styles.voteWho}>
                    <Portrait
                      name={voter.name}
                      imageUrl={voter.imageUrl}
                      size="xs"
                      hideName
                    />
                    <strong>{voter.name}</strong>
                  </span>
                )}
              </td>
              <td className={styles.voteArrow}>→</td>
              <td>
                {target ? (
                  <span className={styles.voteWho}>
                    <Portrait
                      name={target.name}
                      imageUrl={target.imageUrl}
                      size="xs"
                      hideName
                    />
                    <strong>{target.name}</strong>
                  </span>
                ) : (
                  <span className={styles.voteChoice}>{choiceOf(parts)}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** "Ana jogou no fogo: encerrar o jogo." → "encerrar o jogo" */
function choiceOf(parts: ConversationPart[]): string {
  const text = parts
    .map((p) => (p.kind === "text" ? p.text : p.player.name))
    .join("");
  const after = text.split(":").slice(1).join(":").trim();
  return (after || text).replace(/.$/, "");
}

/** A narrativa de uma fase simulada, na ordem em que aconteceu. */
export function EventFeed({
  events,
  playersById,
}: Readonly<{
  events: SimulationEventRecord[];
  playersById: Map<string, Player>;
}>) {
  const blocks = toBlocks(events.map((e) => renderEvent(e, playersById)));
  let previous: Section | undefined;
  return (
    <section className={styles.feed}>
      {blocks.map((block, i) => {
        const section = sectionOf(block, previous);
        const divider = previous !== undefined && section !== previous;
        previous = section;
        const key = block.kind === "votes" ? `v${i}` : block.item.event.id;
        return (
          <Fragment key={key}>
            {divider && <Divider label={SECTION_LABEL[section]} />}
            {block.kind === "votes" ? (
              <Votes items={block.items} />
            ) : (
              <Single item={block.item} />
            )}
          </Fragment>
        );
      })}
    </section>
  );
}
