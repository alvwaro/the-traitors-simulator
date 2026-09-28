import { useSyncExternalStore } from 'react';

type Status = 'loading' | 'ready' | 'missing';

// Cada arquivo é testado uma única vez para a aplicação inteira.
const statusBySrc = new Map<string, Status>();
const listeners = new Set<() => void>();

function probe(src: string) {
  if (statusBySrc.has(src) || typeof window === 'undefined') return;
  statusBySrc.set(src, 'loading');
  const image = new Image();
  image.onload = () => update(src, 'ready');
  image.onerror = () => update(src, 'missing');
  image.src = src;
}

function update(src: string, status: Status) {
  statusBySrc.set(src, status);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** true quando o arquivo de imagem (ex.: PNG em frontend/public) existe e carregou. */
export function useImageAvailable(src: string): boolean {
  probe(src);
  return useSyncExternalStore(subscribe, () => statusBySrc.get(src)) === 'ready';
}
