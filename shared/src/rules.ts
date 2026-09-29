/** Mínimo de jogadores para iniciar (ao menos 1 traidor e 2 fiéis). */
export const MIN_PLAYERS_TO_START = 3;

/** A final pode ser iniciada quando restam esta quantidade de jogadores ou menos. */
export const ENDGAME_MAX_ACTIVE_PLAYERS = 6;

/**
 * Temporadas simuladas, como na 3ª temporada: com esta quantidade de jogadores ou menos acabam os
 * assassinatos e o dia seguinte já é o último (café, missão final, mesa redonda final e Fogo da Verdade).
 */
export const FINAL_PLAYERS = 5;

/** Mesas com esta quantidade de jogadores ou menos banem sem revelar o papel (só no fim do jogo). */
export const HIDDEN_ROLE_TABLE = 5;

/** O poder do Vidente sai na missão de um dia com mais de FINAL_PLAYERS e até esta quantidade de jogadores. */
export const SEER_MAX_PLAYERS = 7;

/** A noite dos caixões (assassinato à vista de todos) só acontece com o castelo ainda cheio, a partir deste dia. */
export const COFFIN_MIN_PLAYERS = 9;
export const COFFIN_FIRST_DAY = 3;
