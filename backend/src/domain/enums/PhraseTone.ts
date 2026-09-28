/**
 * Teor da frase. Na simulação automática o teor decide quem ocupa cada vaga:
 * numa acusação, {user1} é alguém de quem {user} desconfia; numa aliança, alguém em quem confia.
 */
export enum PhraseTone {
  NEUTRAL = 'NEUTRAL',
  FRIENDLY = 'FRIENDLY',
  ALLIANCE = 'ALLIANCE',
  SUSPICION = 'SUSPICION',
  ACCUSATION = 'ACCUSATION',
  CONFLICT = 'CONFLICT',
  DEFENSE = 'DEFENSE',
  STRATEGY = 'STRATEGY',
  EMOTION = 'EMOTION',
  HUMOR = 'HUMOR',
}
