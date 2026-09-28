/**
 * Estados guardados de uma temporada, para desfazer ("voltar") nas temporadas manuais.
 * O estado inclui tudo o que o jogo registra: dias, fases, jogadores, votos, missões, prêmio...
 */
export interface ISeasonSnapshotRepository {
  /** Guarda o estado atual da temporada, com uma descrição do que vai acontecer em seguida. */
  capture(seasonId: string, label: string): Promise<void>;
  /** Restaura o último estado guardado e o descarta; devolve a descrição (ou null se não havia). */
  restoreLatest(seasonId: string): Promise<string | null>;
  count(seasonId: string): Promise<number>;
}
