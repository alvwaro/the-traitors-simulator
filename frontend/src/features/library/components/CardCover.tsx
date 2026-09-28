import { useState } from 'react';
import { initials } from '../../../lib/format';
import styles from './Library.module.css';

/** Capa clicável de um cartão: a imagem, ou o brasão com as iniciais se não houver (ou quebrar). */
export function CardCover({ name, imageUrl, label, onOpen }: Readonly<{ name: string; imageUrl: string | null; label: string; onOpen: () => void }>) {
  const [broken, setBroken] = useState(false);
  return (
    <button type="button" className={styles.cover} onClick={onOpen} aria-label={label}>
      {imageUrl && !broken ? (
        <img src={imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span className={styles.coverCrest} aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </button>
  );
}
