import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

/** matchMedia falso: a tela "gira" quando o teste manda. */
function fakeScreen(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const list = {
    get matches() {
      return matches;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => list));
  return {
    listeners,
    rotate(next: boolean) {
      matches = next;
      listeners.forEach((fn) => fn());
    },
  };
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('acompanha a tela e para de ouvir ao desmontar', () => {
    const screen = fakeScreen(true);
    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 560px)'));
    expect(result.current).toBe(true);
    act(() => screen.rotate(false));
    expect(result.current).toBe(false);
    unmount();
    expect(screen.listeners.size).toBe(0);
  });

  it('sem matchMedia (navegador antigo, testes), considera que não atende', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery('(max-width: 560px)'));
    expect(result.current).toBe(false);
  });
});
