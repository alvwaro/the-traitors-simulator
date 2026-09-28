/** Tipo de acontecimento narrado pela simulação automática. */
export enum SimulationEventKind {
  NARRATION = 'NARRATION',
  DIALOGUE = 'DIALOGUE',
  MISSION_STEP = 'MISSION_STEP',
  ALLIANCE = 'ALLIANCE',
  BETRAYAL = 'BETRAYAL',
  VOTE = 'VOTE',
  REVEAL = 'REVEAL',
  MURDER = 'MURDER',
  RECRUITMENT = 'RECRUITMENT',
  SHIELD = 'SHIELD',
  SECRET = 'SECRET',
  /** Fala do jogador humano (conta no limite de conversas). */
  PLAYER = 'PLAYER',
  /** Resposta de um personagem ao jogador humano. */
  REACTION = 'REACTION',
  /** Um personagem vem falar com o jogador humano (fofoca, aviso, convite, cobrança...). */
  APPROACH = 'APPROACH',
}
