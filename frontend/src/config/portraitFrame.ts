/**
 * ============================================================
 *  MOLDURA DOS RETRATOS DA SIMULAÇÃO
 * ============================================================
 *
 * 1. Coloque o PNG em:  frontend/public/frames/moldura.png
 * 2. Ajuste abaixo o tamanho da imagem e as medidas (em pixels da imagem).
 *
 * A moldura é dividida em 9 partes: os 4 cantos ficam intactos e só as bordas retas
 * se ajustam, então o retrato pode ter a proporção que você quiser (displayAspect)
 * sem deformar os ornamentos. A foto é encaixada na área transparente do meio.
 * Enquanto o arquivo não existir, a simulação usa a moldura dourada desenhada em CSS.
 */
export const portraitFrame = {
  /** Caminho a partir da pasta frontend/public. */
  src: '/frames/moldura.png',

  /** Tamanho do PNG em pixels. */
  width: 1152,
  height: 2048,

  /**
   * Distância da borda do PNG até a área transparente do meio, em pixels do PNG.
   * Medido na sua moldura (janela em 196/198/316/310 px) e reduzido alguns pixels
   * para a foto entrar por baixo da moldura, sem fresta.
   */
  border: { top: 308, right: 192, bottom: 302, left: 190 },

  /**
   * Margem transparente em volta da moldura, em pixels do PNG (medida na sua imagem).
   * Ela fica para fora do retrato, assim o nome encosta na moldura de verdade.
   * Se você recortar essas margens no PNG, coloque tudo 0.
   */
  margin: { top: 163, right: 50, bottom: 157, left: 47 },

  /**
   * Proporção do retrato na tela (largura / altura), medida na moldura visível.
   * 0.75 = 3:4 · 0.7 = um pouco mais comprido · 0.66 = 2:3
   */
  displayAspect: 0.7,
};

/**
 * Medidas para desenhar a moldura mantendo a mesma escala nos dois eixos.
 * Tudo em cqw (% da largura do retrato), então os cantos nunca esticam.
 */
export function frameLayout() {
  const { width, border, margin, displayAspect } = portraitFrame;
  const visibleWidth = width - margin.left - margin.right;
  const u = (px: number) => `${(px / visibleWidth) * 100}cqw`;
  return {
    aspectRatio: `${displayAspect}`,
    /** Onde a foto fica, a partir da borda visível da moldura. */
    window: {
      top: u(border.top - margin.top),
      right: u(border.right - margin.right),
      bottom: u(border.bottom - margin.bottom),
      left: u(border.left - margin.left),
    },
    /** O PNG é posicionado para fora do retrato na medida da margem transparente. */
    image: { top: u(-margin.top), right: u(-margin.right), bottom: u(-margin.bottom), left: u(-margin.left) },
    slice: `${border.top} ${border.right} ${border.bottom} ${border.left}`,
    sliceWidth: `${u(border.top)} ${u(border.right)} ${u(border.bottom)} ${u(border.left)}`,
  };
}
