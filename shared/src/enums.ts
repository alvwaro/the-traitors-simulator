/**
 * Vocabulário do jogo, igual no banco, na API e nas telas.
 * Cada "enum" é um objeto congelado em que a chave é o próprio valor (ex.: GamePhase.MISSION === 'MISSION').
 */
export type EnumValue<E> = E[keyof E];

/** Monta o objeto do enum a partir dos valores, sem repetir cada nome duas vezes. */
export function enumOf<const T extends readonly string[]>(...values: T): { readonly [K in T[number]]: K } {
  return Object.freeze(Object.fromEntries(values.map((value) => [value, value]))) as { readonly [K in T[number]]: K };
}

export const SeasonStatus = enumOf('SETUP', 'IN_PROGRESS', 'ENDGAME', 'FINISHED');
export type SeasonStatus = EnumValue<typeof SeasonStatus>;

export const GamePhase = enumOf(
  'ARRIVAL',
  'TRAITOR_SELECTION',
  'BREAKFAST',
  'MISSION',
  'ROUND_TABLE',
  'TRAITORS_MEETING',
  'ENDGAME_ROUND_TABLE',
  'FINALE',
);
export type GamePhase = EnumValue<typeof GamePhase>;

export const PlayerRole = enumOf('FAITHFUL', 'TRAITOR');
export type PlayerRole = EnumValue<typeof PlayerRole>;

export const PlayerStatus = enumOf('ACTIVE', 'BANISHED', 'MURDERED', 'WITHDRAWN');
export type PlayerStatus = EnumValue<typeof PlayerStatus>;

export const RewardType = enumOf('SHIELD');
export type RewardType = EnumValue<typeof RewardType>;

export const PrizeTransactionType = enumOf('MISSION', 'PENALTY', 'ADJUSTMENT');
export type PrizeTransactionType = EnumValue<typeof PrizeTransactionType>;

export const RoundTableKind = enumOf('REGULAR', 'ENDGAME');
export type RoundTableKind = EnumValue<typeof RoundTableKind>;

export const MurderOutcome = enumOf('SUCCESS', 'BLOCKED_BY_SHIELD');
export type MurderOutcome = EnumValue<typeof MurderOutcome>;

export const RecruitmentOutcome = enumOf('ACCEPTED', 'DECLINED');
export type RecruitmentOutcome = EnumValue<typeof RecruitmentOutcome>;

export const EndgameChoice = enumOf('END_GAME', 'BANISH_AGAIN');
export type EndgameChoice = EnumValue<typeof EndgameChoice>;

/** Momentos do jogo em que as conversas simuladas aparecem. */
export const PhrasePhase = enumOf('ARRIVAL', 'BREAKFAST', 'MISSION', 'ROUND_TABLE', 'TRAITORS_MEETING', 'ENDGAME');
export type PhrasePhase = EnumValue<typeof PhrasePhase>;

/**
 * Teor da frase. Na simulação automática o teor decide quem ocupa cada vaga:
 * numa acusação, {user1} é alguém de quem {user} desconfia; numa aliança, alguém em quem confia.
 */
export const PhraseTone = enumOf(
  'NEUTRAL',
  'FRIENDLY',
  'ALLIANCE',
  'SUSPICION',
  'ACCUSATION',
  'CONFLICT',
  'DEFENSE',
  'STRATEGY',
  'EMOTION',
  'HUMOR',
);
export type PhraseTone = EnumValue<typeof PhraseTone>;

/**
 * MANUAL: o usuário registra tudo. AUTOMATIC: a simulação decide votos, mortes e missões.
 * PLAYER: simulação automática em que o usuário é um dos participantes.
 */
export const SeasonMode = enumOf('MANUAL', 'AUTOMATIC', 'PLAYER');
export type SeasonMode = EnumValue<typeof SeasonMode>;

/**
 * Tipo de acontecimento narrado pela simulação automática.
 * PLAYER: fala do jogador humano (conta no limite de conversas). REACTION: resposta de um personagem a ele.
 * APPROACH: um personagem vem falar com o jogador humano (fofoca, aviso, convite, cobrança...).
 */
export const SimulationEventKind = enumOf(
  'NARRATION',
  'DIALOGUE',
  'MISSION_STEP',
  'ALLIANCE',
  'BETRAYAL',
  'VOTE',
  'REVEAL',
  'MURDER',
  'RECRUITMENT',
  'SHIELD',
  'SECRET',
  'PLAYER',
  'REACTION',
  'APPROACH',
);
export type SimulationEventKind = EnumValue<typeof SimulationEventKind>;

/** Contas: fãs criam temporadas na biblioteca; donos do site publicam nas Temporadas Oficiais e editam frases/comportamentos. */
export const UserRole = enumOf('OWNER', 'FAN');
export type UserRole = EnumValue<typeof UserRole>;

/** O que pode ser publicado nas vitrines. */
export const PublicationKind = enumOf('SEASON', 'CAST', 'CHARACTER');
export type PublicationKind = EnumValue<typeof PublicationKind>;

/** Temporadas Oficiais (donos do site) e Área de Fãs. */
export const PublicationArea = enumOf('OFFICIAL', 'FAN');
export type PublicationArea = EnumValue<typeof PublicationArea>;

/** Versão do programa de uma temporada oficial: EUA ou Reino Unido. */
export const PublicationCountry = enumOf('US', 'UK');
export type PublicationCountry = EnumValue<typeof PublicationCountry>;

/** Conjuntos de missões e reviravoltas: uma temporada de cada versão do programa (EUA/Reino Unido) ou a mistura. */
export const MISSION_POOLS = ['US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'US_S4', 'MIX'] as const;
export type MissionPool = (typeof MISSION_POOLS)[number];

/** A versão do programa que uma temporada reproduz: pelas missões (US_S4 → EUA) ou, nas misturadas, pela moeda. */
export function countryOfSeason(missionPool: MissionPool, currency: string): PublicationCountry {
  if (missionPool.startsWith('UK_')) return PublicationCountry.UK;
  if (missionPool.startsWith('US_')) return PublicationCountry.US;
  return currency === 'GBP' ? PublicationCountry.UK : PublicationCountry.US;
}
