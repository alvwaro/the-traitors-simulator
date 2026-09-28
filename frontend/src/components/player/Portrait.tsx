import { useState, type CSSProperties, type ReactNode } from 'react';
import { eliminationMarks, eliminationMarkTint } from '../../config/eliminationMarks';
import { frameLayout, portraitFrame } from '../../config/portraitFrame';
import type { PlayerStatus } from '../../domain/enums';
import { statusLabel } from '../../domain/labels';
import { useImageAvailable } from '../../hooks/useImageAvailable';
import { cx } from '../../lib/cx';
import { initials } from '../../lib/format';
import { usePortraitStyle } from './PortraitStyle';
import styles from './Portrait.module.css';

export interface PortraitProps {
  name: string;
  imageUrl: string | null;
  status?: PlayerStatus;
  caption?: ReactNode;
  badge?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  hideName?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Carrega a foto na hora, mesmo fora da tela (ex.: arte do Instagram). */
  eager?: boolean;
  onClick?: () => void;
}

/**
 * X por cima da foto dos eliminados. Usa o PNG de config/eliminationMarks.ts;
 * sem o arquivo, desenha o X padrão (cinza para banidos, vinho para assassinados).
 */
function EliminationMark({ kind }: Readonly<{ kind: 'BANISHED' | 'MURDERED' }>) {
  const src = eliminationMarks[kind];
  const hasImage = useImageAvailable(src);
  if (hasImage) return <img className={styles.markImage} src={src} style={{ filter: eliminationMarkTint }} alt="" aria-hidden="true" />;
  return (
    <svg className={cx(styles.cross, kind === 'MURDERED' ? styles.red : styles.gray)} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M12 12 L88 88 M88 12 L12 88" />
    </svg>
  );
}

/** Proporção do retrato e posição da foto dentro da moldura (variáveis usadas no CSS). */
function windowVars(): CSSProperties {
  const layout = frameLayout();
  return {
    '--frame-top': layout.window.top,
    '--frame-right': layout.window.right,
    '--frame-bottom': layout.window.bottom,
    '--frame-left': layout.window.left,
    aspectRatio: layout.aspectRatio,
  } as CSSProperties;
}

/** Moldura em 9 partes: cantos intactos, bordas ajustadas à proporção do retrato. */
function frameImageStyle(): CSSProperties {
  const layout = frameLayout();
  return {
    ...layout.image,
    borderImageSource: `url(${portraitFrame.src})`,
    borderImageSlice: layout.slice,
    borderImageWidth: layout.sliceWidth,
    borderImageRepeat: 'stretch',
  };
}

/**
 * Foto de um jogador: quadrada, ou retrato emoldurado na simulação.
 * No modo emoldurado usa o PNG de config/portraitFrame.ts; sem o PNG, a moldura dourada em CSS.
 */
export function Portrait({ name, imageUrl, status, caption, badge, selected, disabled, hideName, size = 'md', eager, onClick }: Readonly<PortraitProps>) {
  const [broken, setBroken] = useState(false);
  const framed = usePortraitStyle() === 'framed';
  const hasFrameImage = useImageAvailable(portraitFrame.src);
  const pngFrame = framed && hasFrameImage;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={cx(
        styles.portrait,
        styles[size],
        framed && styles.framed,
        pngFrame && styles.pngFrame,
        onClick && styles.clickable,
        selected && styles.selected,
        disabled && styles.disabled,
        status && status !== 'ACTIVE' && styles.out,
        status === 'MURDERED' && styles.murdered,
      )}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-pressed={onClick ? !!selected : undefined}
      title={status && status !== 'ACTIVE' ? `${name} · ${statusLabel[status]}` : name}
    >
      <div className={styles.frame} style={pngFrame ? windowVars() : undefined}>
        <div className={styles.window}>
          {imageUrl && !broken ? (
            <img className={styles.photo} src={imageUrl} alt="" loading={eager ? 'eager' : 'lazy'} onError={() => setBroken(true)} />
          ) : (
            <span className={styles.initials}>{initials(name)}</span>
          )}
          {(status === 'BANISHED' || status === 'MURDERED') && <EliminationMark kind={status} />}
        </div>
        {pngFrame && <span className={styles.frameImage} style={frameImageStyle()} aria-hidden="true" />}
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      {!hideName && <span className={styles.name}>{name}</span>}
      {caption && <span className={styles.caption}>{caption}</span>}
    </Tag>
  );
}
