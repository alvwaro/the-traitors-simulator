import styles from './Ornament.module.css';

/** Divisor com losango central, no estilo de gravura. */
export function Ornament({ label }: Readonly<{ label?: string }>) {
  return (
    <div className={styles.ornament} role="separator">
      <span className={styles.line} />
      <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
        <path d="M0 6h7M21 6h7" stroke="currentColor" strokeWidth="1" />
        <path d="M14 1l5 5-5 5-5-5z" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M14 4l2 2-2 2-2-2z" fill="currentColor" />
      </svg>
      {label && <span className={styles.label}>{label}</span>}
      {label && (
        <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
          <path d="M0 6h7M21 6h7" stroke="currentColor" strokeWidth="1" />
          <path d="M14 1l5 5-5 5-5-5z" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M14 4l2 2-2 2-2-2z" fill="currentColor" />
        </svg>
      )}
      <span className={styles.line} />
    </div>
  );
}
