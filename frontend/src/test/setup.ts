import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// A arte do Instagram é desenhada com modern-screenshot, que precisa de um navegador de verdade.
vi.mock('modern-screenshot', () => ({ domToPng: vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo=') }));

afterEach(() => cleanup());

// O jsdom não implementa estes recursos do navegador.
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
Object.defineProperty(document, 'fonts', {
  value: { load: vi.fn(async () => []), ready: Promise.resolve(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  configurable: true,
});
if (!HTMLImageElement.prototype.decode) HTMLImageElement.prototype.decode = () => Promise.resolve();
globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)) as unknown as typeof requestAnimationFrame;
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}
