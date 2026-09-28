/**
 * ============================================================
 *  X POR CIMA DA FOTO DOS ELIMINADOS
 * ============================================================
 *
 * Coloque os PNGs em frontend/public/marks/ com estes nomes:
 *   x-banido.png        banidos na mesa redonda
 *   x-assassinado.png   assassinados pelos traidores
 *
 * Cada arquivo é opcional: enquanto ele não existir, aparece o X desenhado padrão.
 * O PNG é esticado para cobrir a foto de ponta a ponta (qualquer tamanho serve;
 * desenhe o X encostando nos cantos da imagem).
 */
export const eliminationMarks = {
  BANISHED: '/marks/x-banido.png',
  MURDERED: '/marks/x-assassinado.png',
} as const;

/**
 * Tom do X aplicado por cima do PNG, sem alterar o arquivo.
 * O padrão puxa o vermelho para vinho. Para usar a cor original do PNG, deixe 'none'.
 * Mais escuro: diminua brightness · mais arroxeado: hue-rotate mais negativo.
 */
export const eliminationMarkTint = 'hue-rotate(-14deg) saturate(0.85) brightness(0.62)';
