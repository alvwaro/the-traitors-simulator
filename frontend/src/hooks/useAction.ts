import { useCallback, useRef, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';

interface ActionOptions<R> {
  /** Mensagem de sucesso (ou função que monta a mensagem a partir do resultado). */
  success?: string | ((result: R) => string);
}

/**
 * Executa uma ação (mutação) mostrando o erro da API como aviso.
 * `run` devolve undefined quando a ação falha.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: ActionOptions<R> = {}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const fnRef = useRef(fn);
  const optionsRef = useRef(options);
  fnRef.current = fn;
  optionsRef.current = options;

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      try {
        const result = await fnRef.current(...args);
        const { success } = optionsRef.current;
        if (success) toast.success(typeof success === 'function' ? success(result) : success);
        return result;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Algo deu errado');
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending };
}
