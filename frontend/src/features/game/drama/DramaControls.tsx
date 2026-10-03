import { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { useDrama } from './DramaContext';
import styles from './Drama.module.css';

/**
 * Barra do modo drama: mostra o próximo acontecimento (ou o resto de uma vez).
 * A cada passo, a tela acompanha o que acabou de aparecer.
 */
export function DramaControls() {
  const drama = useDrama();
  const anchor = useRef<HTMLDivElement>(null);
  const shown = drama?.shown ?? 0;
  const previous = useRef(shown);
  useEffect(() => {
    if (shown > previous.current) anchor.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    previous.current = shown;
  }, [shown]);

  if (!drama) return null;
  return (
    <>
      <div ref={anchor} className={styles.anchor} aria-hidden="true" />
      {!drama.done && (
        <div className={styles.bar} role="group" aria-label="Avançar na história">
          <span className={styles.count}>
            {drama.shown} de {drama.total}
          </span>
          <Button variant="quiet" size="sm" onClick={drama.all}>
            Mostrar tudo
          </Button>
          <Button onClick={drama.next}>Próximo</Button>
        </div>
      )}
    </>
  );
}
