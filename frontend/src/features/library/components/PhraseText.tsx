import styles from './Phrases.module.css';

/** Mostra a frase com os marcadores {user} e {victim} destacados. */
export function PhraseText({ text }: Readonly<{ text: string }>) {
  return (
    <p className={styles.text}>
      {text.split(/(\{user\d*\}|\{victim\})/g).map((piece, i) =>
        /^\{(user\d*|victim)\}$/.test(piece) ? (
          <span key={i} className={piece === '{victim}' ? styles.victimToken : styles.token}>
            {piece}
          </span>
        ) : (
          <span key={i}>{piece}</span>
        ),
      )}
    </p>
  );
}
