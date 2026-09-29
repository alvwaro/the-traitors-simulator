import styles from './Ornament.module.css';

/** Losango de gravura (fica dos dois lados do rótulo). */
function Diamond() {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      <path d="M0 6h7M21 6h7" stroke="currentColor" strokeWidth="1" />
      <path d="M14 1l5 5-5 5-5-5z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M14 4l2 2-2 2-2-2z" fill="currentColor" />
    </svg>
  );
}

/** Divisor com losango central, no estilo de gravura. */
export function Ornament({ label }: Readonly<{ label?: string }>) {
  return (
    <div className={styles.ornament} role="separator">
      <span className={styles.line} />
      <Diamond />
      {label && (
        <>
          <span className={styles.label}>{label}</span>
          <Diamond />
        </>
      )}
      <span className={styles.line} />
    </div>
  );
}
