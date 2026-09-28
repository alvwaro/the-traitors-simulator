/**
 * ============================================================
 *  IMAGEM DA MESA REDONDA (arte do Instagram)
 * ============================================================
 *
 * Coloque o PNG em:  frontend/public/story/mesa-redonda.png
 *
 * A imagem fica no meio da arte da votação, com os retratos sentados em volta.
 * Quadrada (ex.: 600×600), de preferência com fundo transparente em volta da mesa.
 * Enquanto o arquivo não existir, a arte usa a mesa de madeira desenhada em CSS.
 */
export const roundTableImage = {
  /** Caminho a partir da pasta frontend/public. */
  src: '/story/mesa-redonda.png',
  /**
   * Tamanho da imagem em relação ao espaço livre no meio dos retratos.
   * 1 = encosta nos retratos · maior que 1 = entra um pouco por baixo deles.
   */
  scale: 1,
  /**
   * Quanto cortar da borda da imagem, em fração do diâmetro, de cada lado (recorte redondo).
   * Tira a borda branca da sua mesa sem alterar o arquivo: 0.045 = 27px de 600.
   * Sobrou branco: aumente · cortou demais: diminua · 0 = imagem inteira.
   */
  crop: 0.045,
};
