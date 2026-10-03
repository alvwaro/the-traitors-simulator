import { useCallback, useSyncExternalStore } from 'react';

/** Se a tela atende à media query (ex.: '(max-width: 560px)'), acompanhando as mudanças (girar o celular). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false, () => false);
}
