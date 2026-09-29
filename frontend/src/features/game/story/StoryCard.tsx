import { useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import { PER_ROW, PhotoWall } from '../../../components/player/PhotoWall';
import { Portrait } from '../../../components/player/Portrait';
import { ShieldIcon } from '../../../components/ui/Icons';
import { config } from '../../../config/env';
import { roundTableImage } from '../../../config/roundTableImage';
import { towerImage } from '../../../config/towerImage';
import hoodedFigure from '../../../assets/story/encapuzado.svg';
import { useImageAvailable } from '../../../hooks/useImageAvailable';
import type { PlayerRole } from '../../../domain/enums';
import type { Player } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { formatMoney } from '../../../lib/format';
import type { Conversation } from '../../../domain/phrases';
import type { StoryScene } from './storyScene';
import styles from './StoryCard.module.css';

/** A arte é montada em 540×960 e exportada em 2× (1080×1920, o tamanho do story). */
export const STORY_SIZE = { width: 540, height: 960, scale: 2 };
/** Até esse número, as conversas ficam numa coluna (fotos em cima, frase embaixo, como no site). */
const CONVERSATIONS_IN_ONE_COLUMN = 3;
/** Quantas conversas em uma coluna cabem sem reduzir. */
const CONVERSATIONS_THAT_FIT = 3.2;
/** Acima disso, duas colunas de cartões compactos: quantas linhas de cartões cabem sem reduzir. */
const COMPACT_ROWS_THAT_FIT = 4.2;
/** Retratos da parede um pouco maiores que no site. */
const WALL_SCALE = 1.1;
/** Quantas linhas de retratos (em tamanho 1) cabem na altura livre da arte. */
const WALL_ROWS_THAT_FIT = 4.3;
/** Área da mesa redonda (arte simples, sem título): quase toda a largura e a altura livre entre as faixas do Instagram. */
const TABLE_AREA = { width: 500, height: 720 };
/** Retrato 'sm' (76px, proporção 0.7) com o nome embaixo; a contagem de votos soma uma linha. */
const SEAT = { width: 76, height: 76 / 0.7 + 22, votesHeight: 18 };
/** Tamanho dos retratos da arte dos protegidos (1 = 76px de largura), conforme quantos são. */
const SHIELD_SCALE = { few: 1.2, some: 0.95, many: 0.75 };

interface StoryCardProps {
  scene: StoryScene;
  seasonName: string;
  currency: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Fotos de outros sites passam pelo proxy do backend: sem isso o navegador
 * não deixa transformar a arte em imagem (CORS).
 */
function sameOrigin(url: string | null): string | null {
  if (!url || !/^https?:\/\//i.test(url) || url.startsWith(window.location.origin)) return url;
  return `${config.apiBaseUrl}/image-proxy?url=${encodeURIComponent(url)}`;
}

/** Paleta da arte em cada situação (classes .theme-* no CSS). */
function themeOf(scene: StoryScene): string | undefined {
  switch (scene.kind) {
    case 'conversations':
      return styles['theme-talk'];
    case 'elimination':
      return scene.status === 'MURDERED' ? styles['theme-murdered'] : styles['theme-banished'];
    case 'banishment':
      return styles['theme-banished'];
    case 'mission':
      return styles['theme-mission'];
    case 'winners':
      return styles['theme-crown'];
    case 'shields':
      return styles['theme-shield'];
    case 'roundTable':
      return styles['theme-table'];
    case 'tower':
    case 'noMurder':
      return styles['theme-tower'];
    default:
      return undefined;
  }
}

const proxied = (p: Player): Player => ({ ...p, imageUrl: sameOrigin(p.imageUrl) });

function Face({ player, size = 'sm', hideName }: Readonly<{ player: Player; size?: 'xs' | 'sm' | 'md' | 'lg'; hideName?: boolean }>) {
  return <Portrait name={player.name} imageUrl={sameOrigin(player.imageUrl)} status={player.status} size={size} hideName={hideName} eager />;
}

/** `count` pontos igualmente espaçados pelo contorno da oval, começando no topo. */
function ovalPoints(count: number, cx: number, cy: number, rx: number, ry: number) {
  const STEPS = 720;
  const at = (k: number) => {
    const t = -Math.PI / 2 + (2 * Math.PI * k) / STEPS;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  };
  const lengths = [0];
  for (let k = 1; k <= STEPS; k++) {
    const a = at(k - 1);
    const b = at(k);
    lengths.push(lengths[k - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const perimeter = lengths[STEPS];
  let k = 0;
  return Array.from({ length: count }, (_, i) => {
    const target = (perimeter * i) / count;
    while (lengths[k + 1] < target) k++;
    return at(k);
  });
}

/**
 * Posição de cada cadeira numa oval em volta da mesa e o maior tamanho de retrato
 * em que vizinhos não se encostam.
 */
function tableLayout(count: number, withVotes: boolean, maxStretch = Infinity, maxScale = 1.25) {
  const { width: W, height: H } = TABLE_AREA;
  const seatHeight = SEAT.height + (withVotes ? SEAT.votesHeight : 0);

  for (let scale = maxScale; ; scale -= 0.02) {
    const w = SEAT.width * scale;
    const h = seatHeight * scale;
    const rx = (W - w) / 2;
    const ry = Math.min((H - h) / 2, rx * maxStretch);
    const seats = ovalPoints(count, W / 2, H / 2, rx, ry);
    const touching = seats.some((a, i) => {
      const b = seats[(i + 1) % count];
      return count > 1 && Math.abs(a.x - b.x) < w * 1.04 && Math.abs(a.y - b.y) < h * 0.98;
    });
    if (!touching || scale <= 0.4) return { scale, w, h, rx, ry, seats };
  }
}

/** A imagem da mesa é redonda: os retratos sentam num círculo perfeito em volta dela. */
const STRETCH_AROUND_IMAGE = 1;
/** Com a imagem, retratos no máximo do tamanho normal, para a mesa não ficar pequena com pouca gente. */
const MAX_SCALE_AROUND_IMAGE = 0.95;

/** A mesa redonda: todos sentados em volta, com os votos recebidos embaixo de cada um. */
interface Ballot {
  voterId: string;
  targetId: string;
}

interface Point {
  x: number;
  y: number;
}

/** Até essa distância na roda (1 = vizinho), a seta faz uma curva larga para dentro da mesa. */
const NEIGHBOR_DISTANCE = 2;

/** Distância do centro até a borda de um retângulo w×h, na direção (dx, dy). */
function toBoxEdge(dx: number, dy: number, w: number, h: number): number {
  const len = Math.hypot(dx, dy) || 1;
  const ux = Math.abs(dx / len);
  const uy = Math.abs(dy / len);
  return Math.min(ux ? w / 2 / ux : Infinity, uy ? h / 2 / uy : Infinity);
}

/**
 * Setas de quem votou para o votado. Toda seta é uma curva suave (assim A→B e B→A não se sobrepõem);
 * entre vizinhos a curva é larga e entra na mesa, em vez de passar rente aos retratos.
 */
function VoteArrows({ ballots, seatIndex, faces, center, faceSize }: Readonly<{
  ballots: Ballot[];
  seatIndex: Map<string, number>;
  faces: Point[];
  center: Point;
  faceSize: { w: number; h: number };
}>) {
  const count = faces.length;
  const GAP = 5;
  const HEAD = 11;

  const arrows = ballots.flatMap(({ voterId, targetId }) => {
    const i = seatIndex.get(voterId);
    const j = seatIndex.get(targetId);
    if (i === undefined || j === undefined || i === j) return [];
    const a = faces[i];
    const b = faces[j];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const chord = Math.hypot(b.x - a.x, b.y - a.y);
    // perpendicular à direita da seta: separa A→B de B→A
    const px = -(b.y - a.y) / chord;
    const py = (b.x - a.x) / chord;
    // direção do meio da corda para o centro da mesa
    const inX = center.x - mid.x;
    const inY = center.y - mid.y;
    const inLen = Math.hypot(inX, inY) || 1;
    const ring = Math.min(Math.abs(i - j), count - Math.abs(i - j));
    const inward = ring <= NEIGHBOR_DISTANCE ? Math.min(inLen * 0.8, chord * 0.9 + 40) : chord * 0.08;
    const control = { x: mid.x + (inX / inLen) * inward + px * 14, y: mid.y + (inY / inLen) * inward + py * 14 };

    // começa e termina na borda das cadeiras, na direção da curva
    const edge = (from: Point, extra: number) => {
      const dx = control.x - from.x;
      const dy = control.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const t = toBoxEdge(dx, dy, faceSize.w, faceSize.h) + extra;
      return { x: from.x + (dx / len) * t, y: from.y + (dy / len) * t };
    };
    const start = edge(a, GAP);
    const end = edge(b, GAP + HEAD * 0.6);

    // ponta da seta na direção de chegada
    const tx = end.x - control.x;
    const ty = end.y - control.y;
    const tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl;
    const uy = ty / tl;
    const tip = { x: end.x + ux * HEAD * 0.6, y: end.y + uy * HEAD * 0.6 };
    const base = { x: tip.x - ux * HEAD, y: tip.y - uy * HEAD };
    const head = `${tip.x},${tip.y} ${base.x - uy * HEAD * 0.55},${base.y + ux * HEAD * 0.55} ${base.x + uy * HEAD * 0.55},${base.y - ux * HEAD * 0.55}`;

    return [{ key: `${voterId}-${targetId}`, d: `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`, head }];
  });

  return (
    <svg className={styles.arrows} width={TABLE_AREA.width} height={TABLE_AREA.height} viewBox={`0 0 ${TABLE_AREA.width} ${TABLE_AREA.height}`} aria-hidden="true">
      {/* contorno escuro por baixo, para a seta aparecer sobre a mesa */}
      {arrows.map((a) => (
        <g key={`${a.key}-shadow`} className={styles.arrowShadow}>
          <path d={a.d} />
          <polygon points={a.head} />
        </g>
      ))}
      {arrows.map((a) => (
        <g key={a.key} className={styles.arrow}>
          <path d={a.d} />
          <polygon points={a.head} />
        </g>
      ))}
    </svg>
  );
}

function RoundTable({ players, votes, ballots }: Readonly<{ players: Player[]; votes: Record<string, number>; ballots: Ballot[] }>) {
  const hasImage = useImageAvailable(roundTableImage.src);
  const withVotes = Object.keys(votes).length > 0;
  const { scale, w, h, rx, ry, seats } = tableLayout(
    players.length,
    withVotes,
    hasImage ? STRETCH_AROUND_IMAGE : Infinity,
    hasImage ? MAX_SCALE_AROUND_IMAGE : undefined,
  );
  const most = Math.max(0, ...Object.values(votes));
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  // o tampo ocupa o miolo da oval, sem ficar por baixo dos retratos
  const tableWidth = Math.max(2 * rx - w * 1.05, 120);
  const tableHeight = Math.max(2 * ry - h * 1.05, 120);
  const imageSize = Math.min(tableWidth, tableHeight) * roundTableImage.scale;

  return (
    <div className={styles.roundTable} style={{ width: TABLE_AREA.width, height: TABLE_AREA.height }}>
      {hasImage ? (
        <div className={styles.tableImage} style={{ width: imageSize, height: imageSize, top: TABLE_AREA.height / 2 }}>
          {/* a imagem fica maior que o círculo; o que passa da borda (a borda branca) é cortado */}
          <img src={roundTableImage.src} alt="" style={{ width: `${100 / (1 - 2 * roundTableImage.crop)}%` }} />
        </div>
      ) : (
        <div className={styles.table} style={{ width: tableWidth, height: tableHeight }}>
          <p className={styles.tableTitle}>Mesa Redonda</p>
          {withVotes && <p className={styles.tableVotes}>{total} voto{total === 1 ? '' : 's'}</p>}
        </div>
      )}
      {ballots.length > 0 && (
        <VoteArrows
          ballots={ballots}
          seatIndex={new Map(players.map((p, i) => [p.id, i]))}
          // a cadeira inteira (foto, nome e votos): a seta nunca passa por cima do nome
          faces={seats}
          center={{ x: TABLE_AREA.width / 2, y: TABLE_AREA.height / 2 }}
          faceSize={{ w, h }}
        />
      )}
      {players.map((p, i) => {
        const received = votes[p.id] ?? 0;
        return (
          <div key={p.id} className={styles.seat} style={{ left: seats[i].x - w / 2, top: seats[i].y - h / 2, width: w, height: h }}>
            <div className={styles.seatInner} style={{ zoom: scale }}>
              <Face player={p} />
              {withVotes && (
                <span className={cx(styles.seatVotes, received > 0 && received === most && styles.leader)}>
                  {votesLabel(received)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Menor fonte aceita numa linha do anúncio (ainda legível na exportação 2×). */
const MIN_LINE_FONT = 14;
/** Frases do anúncio maiores que isso ficam em duas linhas (nome e papel) em vez de uma com a fonte miúda. */
const REVEAL_ONE_LINE_MAX = 30;

/** Diminui a fonte da linha até o texto caber na largura (sem quebrar). */
function fitLine(line: HTMLElement): void {
  line.style.fontSize = '';
  let size = Number.parseFloat(getComputedStyle(line).fontSize);
  while (size > MIN_LINE_FONT && line.scrollWidth > line.clientWidth) {
    size -= 1;
    line.style.fontSize = `${size}px`;
  }
}

/**
 * Refaz o ajuste de todas as linhas da arte. A exportação chama isto depois de carregar as fontes:
 * medida com a fonte provisória, a linha ficaria larga demais com a fonte final.
 */
export function refitLines(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-fit-line]').forEach(fitLine);
}

/**
 * Uma linha de texto que nunca quebra: a fonte diminui até caber na largura da caixa.
 * Na exportação as alturas medidas na tela ficam fixas; se o texto quebrasse de outro jeito
 * na imagem, as linhas se sobreporiam e sairiam da caixa. Sem quebra, isso não acontece.
 */
function FitLine({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const line = ref.current;
    if (!line) return;
    fitLine(line);
    const refit = () => fitLine(line);
    document.fonts.addEventListener('loadingdone', refit);
    return () => document.fonts.removeEventListener('loadingdone', refit);
  }, [children]);

  return (
    <p ref={ref} className={cx(styles.fitLine, className)} data-fit-line>
      {children}
    </p>
  );
}

/** "Parabéns!" / "Infelizmente..." e o papel revelado; nome longo vai numa linha própria. */
function RoleReveal({ name, role }: Readonly<{ name: string; role: PlayerRole }>) {
  const traitor = role === 'TRAITOR';
  const roleText = `era um ${traitor ? 'Traidor' : 'Fiel'}`;
  const oneLine = `${name} ${roleText}`.length <= REVEAL_ONE_LINE_MAX;
  return (
    <div className={cx(styles.reveal, traitor ? styles.good : styles.bad)}>
      <FitLine>{traitor ? 'Parabéns!' : 'Infelizmente...'}</FitLine>
      {oneLine ? (
        <FitLine>{`${name} ${roleText}`}</FitLine>
      ) : (
        <>
          <FitLine>{name}</FitLine>
          <FitLine>{roleText}</FitLine>
        </>
      )}
    </div>
  );
}

/** Menor zoom aceito antes de desistir de caber (a frase ainda fica legível na exportação 2×). */
const MIN_CONVERSATION_ZOOM = 0.45;

/**
 * Conversas da arte. O zoom inicial vem da quantidade de cartões; depois a caixa é medida
 * e encolhe até caber no palco, porque frases longas (simulação automática) passam do cartão.
 * As medidas comparam tamanhos na tela (getBoundingClientRect) do palco e da caixa,
 * então funcionam com a prévia reduzida ou em tamanho real.
 */
function Conversations({ conversations }: Readonly<{ conversations: Conversation[] }>) {
  const ref = useRef<HTMLDivElement>(null);
  const total = conversations.length;
  const compact = total > CONVERSATIONS_IN_ONE_COLUMN;
  const initialZoom = compact ? Math.min(1, COMPACT_ROWS_THAT_FIT / Math.ceil(total / 2)) : Math.min(1, CONVERSATIONS_THAT_FIT / total);

  useLayoutEffect(() => {
    const box = ref.current;
    const stage = box?.parentElement;
    if (!box || !stage || stage.offsetHeight === 0) return;
    const style = getComputedStyle(stage);
    const contentHeight = stage.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);
    const available = contentHeight * (stage.getBoundingClientRect().height / stage.offsetHeight);
    let zoom = initialZoom;
    box.style.zoom = String(zoom);
    while (zoom > MIN_CONVERSATION_ZOOM && box.getBoundingClientRect().height > available) {
      zoom = Math.max(MIN_CONVERSATION_ZOOM, zoom - 0.03);
      box.style.zoom = String(zoom);
    }
  }, [conversations, initialZoom]);

  return (
    <div ref={ref} className={cx(styles.conversations, compact && styles.compact)} style={{ zoom: initialZoom }}>
      {conversations.map((c) => (
        <article key={c.key} className={styles.conversation}>
          <div className={styles.faces}>
            {c.players.map((p) => (
              <Face key={p.id} player={p} size={compact ? 'xs' : 'sm'} hideName={compact} />
            ))}
          </div>
          <p className={styles.line}>
            {c.parts.map((part, i) => (part.kind === 'text' ? <span key={i}>{part.text}</span> : <strong key={i}>{part.player.name}</strong>))}
          </p>
        </article>
      ))}
    </div>
  );
}

/** Conclave sem morte: a moldura de sempre com uma interrogação, num painel liso. */
function NoMurder({ detail }: Readonly<{ detail?: string }>) {
  return (
    <div className={cx(styles.spotlight, styles.panel, styles.noMurder)}>
      <Portrait name="Ninguém" imageUrl={null} size="lg" hideName mystery />
      <p className={styles.nightText}>Ninguém morreu esta noite</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  );
}

/** O conclave: um encapuzado no lugar dos Traidores, sem revelar ninguém. */
function Tower() {
  const hasImage = useImageAvailable(towerImage.src);
  return (
    <div className={cx(styles.spotlight, styles.panel)}>
      <Portrait name="Traidores" imageUrl={hasImage ? towerImage.src : hoodedFigure} size="lg" hideName eager />
      <p className={styles.nightText}>Os Traidores estão se reunindo na torre para assassinar alguém.</p>
    </div>
  );
}

/** Lado do quadro do círculo da verdade atrás da foto do banido. */
const TRUTH_CIRCLE = 250;

/** Círculo da verdade atrás da foto do banido: um anel grosso por fora e, dentro dele, dois anéis finos quase encostados. */
function TruthCircle() {
  const c = TRUTH_CIRCLE / 2;
  return (
    <svg className={styles.truthCircle} width={TRUTH_CIRCLE} height={TRUTH_CIRCLE} viewBox={`0 0 ${TRUTH_CIRCLE} ${TRUTH_CIRCLE}`} aria-hidden="true">
      <g fill="none" stroke="#fff">
        <circle cx={c} cy={c} r={119} strokeWidth={10} />
        <circle cx={c} cy={c} r={103} strokeWidth={3} />
        <circle cx={c} cy={c} r={96} strokeWidth={3} />
      </g>
    </svg>
  );
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla" com os nomes em destaque. */
function NameList({ players }: Readonly<{ players: Player[] }>) {
  return (
    <>
      {players.map((p, i) => (
        <span key={p.id}>
          {i > 0 && (i === players.length - 1 ? ' e ' : ', ')}
          <strong>{p.name}</strong>
        </span>
      ))}
    </>
  );
}

function SceneBody({ scene, currency }: Readonly<{ scene: StoryScene; currency: string }>) {
  switch (scene.kind) {
    case 'wall': {
      const rows = Math.ceil(scene.players.length / PER_ROW);
      const zoom = Math.min(WALL_SCALE, WALL_ROWS_THAT_FIT / Math.max(rows, 1));
      return (
        <>
          {scene.headline && <p className={cx(styles.headline, scene.tone === 'bad' ? styles.bad : styles.good)}>{scene.headline}</p>}
          <div className={styles.wall} style={{ zoom }}>
            <PhotoWall players={scene.players.map(proxied)} size="sm" eager />
          </div>
        </>
      );
    }

    case 'conversations':
      return <Conversations conversations={scene.conversations} />;

    case 'elimination':
      return (
        <div className={cx(styles.spotlight, scene.status === 'MURDERED' && styles.panel)}>
          <Face player={{ ...scene.player, status: scene.status }} size="lg" hideName />
          <p className={styles.verdict}>{scene.headline}</p>
          {scene.role && (
            <p className={cx(styles.role, scene.role === 'TRAITOR' ? styles.bad : styles.good)}>{scene.role === 'TRAITOR' ? 'Era um(a) Traidor(a)' : 'Era um(a) Fiel'}</p>
          )}
          {scene.detail && <p className={styles.detail}>{scene.detail}</p>}
        </div>
      );

    case 'banishment':
      return (
        <div className={styles.banishment}>
          <div className={styles.box}>
            <div className={styles.truthSeat} style={{ width: TRUTH_CIRCLE, height: TRUTH_CIRCLE }}>
              <TruthCircle />
              <Face player={{ ...scene.player, status: 'BANISHED' }} size="lg" hideName />
            </div>
            {/* cada texto numa linha que não quebra (FitLine): a exportação não recalcula a quebra */}
            <FitLine className={styles.bannedName}>{scene.player.name}</FitLine>
            <FitLine className={styles.announce}>foi banido(a) na Mesa Redonda</FitLine>
            {scene.role && <RoleReveal name={scene.player.name} role={scene.role} />}
          </div>
          {scene.votes > 0 && (
            <div className={cx(styles.box, styles.voteBox)}>
              <span className={styles.voteCount}>{scene.votes}</span>
              <span className={styles.voteLabel}>voto{scene.votes > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      );

    case 'shields': {
      const total = scene.players.length;
      const scale = shieldScale(total);
      return (
        <div className={styles.shieldScene}>
          <span className={styles.emblem}>
            <ShieldIcon size={50} />
          </span>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>Protegidos</p>
            <div className={styles.shieldFaces}>
              {scene.players.map((p) => (
                // caixa de tamanho fixo: o zoom fica só dentro dela e não bagunça a quebra de linha na exportação
                <div key={p.id} style={{ width: SEAT.width * scale, height: SEAT.height * scale }}>
                  <div style={{ zoom: scale }}>
                    <Face player={p} />
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.panelText}>
              <NameList players={scene.players} /> {total === 1 ? 'está protegido(a)' : 'estão protegidos'} do assassinato dos Traidores esta noite.
            </p>
          </div>
        </div>
      );
    }

    case 'tower':
      return <Tower />;

    case 'noMurder':
      return <NoMurder detail={scene.detail} />;

    case 'roundTable':
      return <RoundTable players={scene.players} votes={scene.votes} ballots={scene.ballots} />;

    case 'mission':
      return (
        <div className={styles.spotlight}>
          <p className={styles.verdict}>{scene.name}</p>
          <p className={styles.prize}>+ {formatMoney(scene.prize, currency)}</p>
          <p className={styles.detail}>para o prêmio final</p>
          {scene.shielded.length > 0 && (
            <>
              <p className={styles.label}>Escudos</p>
              <div className={styles.faces}>
                {scene.shielded.map((p) => (
                  <Face key={p.id} player={p} />
                ))}
              </div>
            </>
          )}
        </div>
      );

    case 'winners':
      return (
        <div className={styles.spotlight}>
          <p className={styles.verdict}>{scene.headline}</p>
          <div className={styles.faces}>
            {scene.players.map((p) => (
              <Face key={p.id} player={p} size="md" />
            ))}
          </div>
        </div>
      );
  }
}

/** Cenas na versão simples: fundo liso, sem filete nem título, com o conteúdo no centro. */
const PLAIN_SCENES: ReadonlySet<StoryScene['kind']> = new Set(['conversations', 'banishment', 'shields', 'roundTable', 'tower', 'noMurder']);

/**
 * Arte vertical para o story do Instagram: fundo régio, título, temporada e a cena do momento.
 * Conversas, banimento, escudos, mesa redonda, torre, noite sem morte e assassinato usam a versão simples.
 */
export function StoryCard({ scene, seasonName, currency, ref }: Readonly<StoryCardProps>) {
  const plain = PLAIN_SCENES.has(scene.kind) || (scene.kind === 'elimination' && scene.status === 'MURDERED');
  return (
    <div ref={ref} className={cx(styles.card, themeOf(scene), plain && styles.plain)} style={{ width: STORY_SIZE.width, height: STORY_SIZE.height }}>
      {!plain && (
        <>
          <span className={cx(styles.corner, styles.tl)} />
          <span className={cx(styles.corner, styles.tr)} />
          <span className={cx(styles.corner, styles.bl)} />
          <span className={cx(styles.corner, styles.br)} />

          <header className={styles.header}>
            <p className={styles.brand}>The Traitors</p>
            <p className={styles.season}>{seasonName}</p>
          </header>
        </>
      )}

      <main className={styles.stage}>
        <SceneBody scene={scene} currency={currency} />
      </main>
    </div>
  );
}

function votesLabel(received: number): string {
  if (!received) return '—';
  return received > 1 ? `${received} votos` : '1 voto';
}

/** Quanto maior o grupo de escudados, menores as fotos. */
function shieldScale(total: number): number {
  if (total <= 3) return SHIELD_SCALE.few;
  return total <= 8 ? SHIELD_SCALE.some : SHIELD_SCALE.many;
}
