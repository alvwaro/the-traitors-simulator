/** Desempenho de um personagem somando todas as temporadas iniciadas em que jogou (ranking do cast). */
export interface CharacterStats {
  characterId: string;
  seasons: number;
  finished: number;
  wins: number;
  winsAsTraitor: number;
  winsAsFaithful: number;
  prizeWon: number;
  timesTraitor: number;
  timesRecruited: number;
  banished: number;
  murdered: number;
  withdrawn: number;
  /** Chegou vivo(a) à revelação final. */
  finals: number;
  votesReceived: number;
  votesCast: number;
  /** Votos dados em quem era (ou virou) traidor. */
  votesOnTraitors: number;
  shields: number;
  /** Média de dias no jogo por temporada. */
  avgDays: number;
}
