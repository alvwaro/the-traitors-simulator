import { act, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

const SKIP = /^(Sair)$/;

/**
 * Usa a tela como uma pessoa curiosa: clica em cada botão (uma vez), escolhe opções nas listas
 * e escreve nos campos. Serve para passar pelos caminhos da interface com os dados gravados.
 */
export async function exercise(user: UserEvent, options: { maxClicks?: number; root?: HTMLElement } = {}): Promise<number> {
  const root = options.root ?? document.body;
  let clicks = 0;
  const seen = new Set<string>();
  for (let round = 0; round < (options.maxClicks ?? 40); round++) {
    const buttons = [...within(root).queryAllByRole('button'), ...within(root).queryAllByRole('tab')]
      .filter((b) => !(b as HTMLButtonElement).disabled && !SKIP.test(b.textContent ?? ''));
    const next = buttons.find((b) => !seen.has(keyOf(b)));
    if (!next) break;
    seen.add(keyOf(next));
    await act(async () => {
      await user.click(next).catch(() => undefined);
    });
    clicks++;
  }
  return clicks;
}

/** Escolhe a segunda opção de cada lista e escreve em cada campo de texto da tela. */
export async function fillEverything(user: UserEvent, text = 'Teste {user}'): Promise<void> {
  for (const select of screen.queryAllByRole('combobox') as HTMLSelectElement[]) {
    const option = select.options[Math.min(1, select.options.length - 1)];
    if (option && !select.disabled) await user.selectOptions(select, option.value).catch(() => undefined);
  }
  for (const input of screen.queryAllByRole('textbox') as HTMLInputElement[]) {
    if (input.disabled || input.readOnly) continue;
    await user.clear(input).catch(() => undefined);
    await user.type(input, input.type === 'url' ? 'https://example.com/a.png' : text).catch(() => undefined);
  }
  for (const box of screen.queryAllByRole('checkbox') as HTMLInputElement[]) {
    if (!box.disabled) await user.click(box).catch(() => undefined);
  }
}

function keyOf(el: HTMLElement): string {
  const label = el.getAttribute('aria-label') ?? '';
  const path: number[] = [];
  let node: HTMLElement | null = el;
  while (node?.parentElement) {
    path.push([...node.parentElement.children].indexOf(node));
    node = node.parentElement;
  }
  return `${label}|${el.textContent}|${path.join('.')}`;
}
