import { z } from 'zod';
import { BEHAVIOR_NAME_MAX_LENGTH, USERNAME_MAX_LENGTH } from '@traitors/shared';
import { EndgameChoice, PhrasePhase, PhraseTone, PlayerRole, PrizeTransactionType, SeasonMode } from '../../../domain/enums';
import { BEHAVIOR_EFFECT_KEYS, BEHAVIOR_EFFECT_LIMIT } from '../../../domain/entities/Behavior';
import { PHRASE_MAX_LENGTH } from '../../../domain/entities/Phrase';
import { MISSION_POOLS } from '../../../domain/entities/Season';
import { HUMAN_ACTIONS } from '../../../domain/simulation/humanActions';
import { PASSWORD_MAX_LENGTH, PublicationArea, PublicationCountry, PublicationKind } from '../../../domain/entities';

const id = z.uuid();
const money = z.number().nonnegative();
const imageUrl = z.url({ protocol: /^https?$/ }).nullable().optional();
const notes = z.string().nullable().optional();
const vote = z.object({ voterId: id, targetId: id, round: z.number().int().min(1).optional() });
/** Nome de temporada, cast ou missão. */
const title = z.string().trim().min(1).max(120);
/** Nome de personagem ou jogador. */
const personName = z.string().trim().min(1).max(80);
const behaviorIds = z.array(id);

// ---------- params ----------
export const seasonIdParams = z.object({ seasonId: id });
export const playerParams = z.object({ seasonId: id, playerId: id });
export const characterIdParams = z.object({ characterId: id });
export const castIdParams = z.object({ castId: id });
export const phraseIdParams = z.object({ phraseId: id });
export const behaviorIdParams = z.object({ behaviorId: id });
export const publicationIdParams = z.object({ publicationId: id });

// ---------- relacionamentos (do cast ou da temporada) ----------
const feeling = z.number().int().min(0).max(100);
const relationshipPatch = {
  fromId: id,
  toId: id,
  trust: feeling.optional(),
  liking: feeling.optional(),
  hatred: feeling.optional(),
  allied: z.boolean().optional(),
};

// ---------- biblioteca ----------
const httpUrl = z.url({ protocol: /^https?$/ });
const shortText = (max: number) => z.string().trim().max(max).nullable().optional();
const photos = z.array(z.object({ url: httpUrl, label: shortText(80) })).max(20);
const participantSeason = z.object({
  label: z.string().trim().min(1).max(120),
  publicationId: id.nullable().optional(),
  role: z.enum(['FAITHFUL', 'TRAITOR', 'RECRUITED']).nullable().optional(),
  roleDetail: shortText(200),
  fate: shortText(200),
  placement: shortText(40),
  shieldWins: z.number().int().min(0).max(99).nullable().optional(),
  episodes: z.number().int().min(0).max(99).nullable().optional(),
});
const participantProfile = z
  .object({
    wikiUrl: httpUrl.nullable().optional(),
    seasons: z.array(participantSeason).max(20).optional(),
    otherShows: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  })
  .nullable();

export const createCharacterBody = z.object({
  name: personName,
  imageUrl,
  behaviorIds: behaviorIds.optional(),
  photos: photos.optional(),
});
export const newCharacterBody = createCharacterBody.extend({ castId: id.nullable().optional() });
export const updateCharacterBody = createCharacterBody.extend({ profile: participantProfile.optional() }).partial();
/** Página do participante na wiki Fandom de The Traitors. */
export const wikiImportBody = z.object({ url: httpUrl });
export const castMemberParams = z.object({ castId: id, characterId: id });
export const castMemberPhotoBody = z.object({ imageUrl: httpUrl.nullable() });
export const listCharactersQuery = z.object({ search: z.string().optional() });

export const createCastBody = z.object({
  name: title,
  description: notes,
  imageUrl,
  characterIds: z.array(id).default([]),
});
export const updateCastBody = z.object({
  name: title.optional(),
  description: notes,
  imageUrl,
  characterIds: z.array(id).optional(),
});
/** `clear`: apaga o par (volta a ser sorteado nas temporadas). */
export const updateCastRelationshipBody = z.object({ ...relationshipPatch, clear: z.boolean().optional() });

export const createPhraseBody = z.object({
  phase: z.enum(PhrasePhase),
  tone: z.enum(PhraseTone).optional(),
  behaviorId: id.nullable().optional(),
  text: z.string().trim().min(1).max(PHRASE_MAX_LENGTH),
});
export const updatePhraseBody = createPhraseBody.partial();
export const listPhrasesQuery = z.object({ phase: z.enum(PhrasePhase).optional() });

const effect = z.number().int().min(-BEHAVIOR_EFFECT_LIMIT).max(BEHAVIOR_EFFECT_LIMIT);
const effects = z.partialRecord(z.enum(BEHAVIOR_EFFECT_KEYS), effect);
export const createBehaviorBody = z.object({
  name: z.string().trim().min(1).max(BEHAVIOR_NAME_MAX_LENGTH),
  description: notes,
  effects: effects.optional(),
});
export const updateBehaviorBody = createBehaviorBody.partial();

// ---------- temporadas ----------
/** Configurações que podem ser escolhidas ao criar e alteradas depois (o prêmio, só antes do início). */
const seasonSettings = {
  mode: z.enum(SeasonMode).optional(),
  chaos: z.number().int().min(0).max(100).optional(),
  missionPool: z.enum(MISSION_POOLS).optional(),
  interactionLimit: z.number().int().min(0).max(20).optional(),
  withdrawals: z.boolean().optional(),
  hiddenShieldChance: z.number().int().min(0).max(100).optional(),
  currency: z.string().length(3).optional(),
  initialPrizePot: money.optional(),
  maxPrizePot: money.nullable().optional(),
};

export const createSeasonBody = z.object({
  name: title,
  ...seasonSettings,
  human: z.object({ name: personName, imageUrl }).nullable().optional(),
  castId: id.nullable().optional(),
  characterIds: z.array(id).optional(),
});
export const updateSeasonBody = z.object({ name: title.optional(), ...seasonSettings });
export const saveAsCastBody = z.object({ name: title, description: notes });
export const prizeAdjustmentBody = z.object({
  type: z.enum([PrizeTransactionType.PENALTY, PrizeTransactionType.ADJUSTMENT]),
  amount: z.number().refine((n) => n !== 0, 'O valor não pode ser zero'),
  description: notes,
});

// ---------- jogadores ----------
export const addPlayerBody = z
  .object({
    characterId: id.nullable().optional(),
    name: personName.optional(),
    imageUrl,
    role: z.enum(PlayerRole).optional(),
    saveToLibrary: z.boolean().optional(),
    behaviorIds: behaviorIds.optional(),
  })
  .refine((b) => b.characterId || b.name, { message: 'Informe name ou characterId' });

export const updatePlayerBody = z.object({
  name: personName.optional(),
  imageUrl,
  role: z.enum(PlayerRole).optional(),
  behaviorIds: behaviorIds.optional(),
});

// ---------- simulação automática ----------
export const humanDecision = z.object({
  voteTargetId: id.nullable().optional(),
  endgameChoice: z.enum(EndgameChoice).nullable().optional(),
  murderTargetId: id.nullable().optional(),
  recruit: z.object({ targetId: id, ultimatum: z.boolean(), victimIfAcceptedId: id.nullable().optional() }).nullable().optional(),
  offerResponse: z.enum(['ACCEPT', 'DECLINE']).nullable().optional(),
  victimId: id.nullable().optional(),
  seerGuestId: id.nullable().optional(),
  seerAnnouncement: z.enum(['TRUTH', 'LIE', 'SECRET']).nullable().optional(),
  coffinIds: z.array(id).max(3).nullable().optional(),
  missionAnswer: z.string().trim().min(1).max(64).nullable().optional(),
});
export const simulateBody = z.object({ untilEnd: z.boolean().optional(), decision: humanDecision.optional() }).default({});
export const inviteAnswerBody = z.object({ inviterId: id, groupId: z.string().max(20).nullable().optional(), accept: z.boolean() });
export const interactBody = z.object({ targetId: id, action: z.enum(HUMAN_ACTIONS), subjectId: id.nullable().optional() });
export const updateRelationshipBody = z.object(relationshipPatch);

// ---------- fases ----------
export const phaseNotesBody = z.object({ notes: z.string().nullable() });

export const selectTraitorsBody = z.object({ traitorIds: z.array(id).min(1) });

export const missionBody = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  description: notes,
  prizeEarned: money.default(0),
  prizeAvailable: money.nullable().optional(),
  shieldedPlayerIds: z.array(id).default([]),
  hiddenShieldPlayerIds: z.array(id).default([]),
});

export const roundTableBody = z.object({
  banishedPlayerId: id,
  votes: z.array(vote).optional(),
  notes,
});

export const traitorsMeetingBody = z.object({
  murderTargetId: id.nullable().optional(),
  plainSight: z.boolean().optional(),
  recruitment: z
    .object({ targetId: id, accepted: z.boolean(), isUltimatum: z.boolean().optional() })
    .nullable()
    .optional(),
  notes,
});

export const endgameRoundTableBody = z.object({
  endgameVotes: z.array(z.object({ voterId: id, choice: z.enum(EndgameChoice) })).min(1),
  banishedPlayerId: id.nullable().optional(),
  votes: z.array(vote).optional(),
  notes,
});

// ---------- proxy de imagens ----------
export const imageProxyQuery = z.object({ url: z.url().max(2048) });

// ---------- contas ----------
// o formato do usuário e o tamanho mínimo da senha são regras do domínio (User)
export const credentialsBody = z.object({
  username: z.string().trim().min(1).max(USERNAME_MAX_LENGTH),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

// ---------- publicações ----------
const publicationKind = z.enum([PublicationKind.SEASON, PublicationKind.CAST, PublicationKind.CHARACTER]);
const publicationArea = z.enum([PublicationArea.OFFICIAL, PublicationArea.FAN]);
export const publishBody = z.object({
  kind: publicationKind,
  sourceId: id,
  description: notes,
  /** Só donos escolhem; fãs publicam sempre na Área de Fãs. */
  area: publicationArea.optional(),
  /** Temporada oficial: EUA ou Reino Unido. */
  country: z.enum([PublicationCountry.US, PublicationCountry.UK]).optional(),
});
export const publicationsQuery = z.object({
  area: z.enum([PublicationArea.OFFICIAL, PublicationArea.FAN]).optional(),
  kind: publicationKind.optional(),
  /** "true": só as publicações de quem está logado. */
  mine: z.enum(['true', 'false']).optional(),
});
export const copyPublicationBody = z.object({ name: title.optional() });
export const copySeasonBody = z.object({ name: title.optional(), human: z.object({ name: personName }).nullable().optional() });
