import { describe, expect, it } from 'vitest';
import { Behavior, Cast, Character, DayPhase, Mission, Phrase, Player, PrizeTransaction, RoundTable, Season, TraitorMeeting, User, normalizeMissionPool } from '../../src/domain/entities';
import { EndgameChoice, GamePhase, PhrasePhase, PhraseTone, PlayerRole, PlayerStatus, PrizeTransactionType, RoundTableKind, SeasonMode } from '../../src/domain/enums';
import { PhaseFlowPolicy, VoteTallyService, WinnerPolicy } from '../../src/domain/services';

describe('regras das entidades', () => {
  it('temporada: configurações só antes do início e validação de cada uma', () => {
    const season = Season.create({ name: '  Castelo  ', ownerId: 'u1', mode: SeasonMode.AUTOMATIC, chaos: 30, missionPool: 'UK_S2', withdrawals: false });
    expect(season.name).toBe('Castelo');
    expect(season.withdrawals).toBe(false);
    expect(() => season.rename(' ')).toThrow();
    expect(() => season.configureSimulation({ chaos: 101 })).toThrow();
    expect(() => season.configureSimulation({ chaos: 1.5 })).toThrow();
    expect(() => season.configureSimulation({ interactionLimit: 21 })).toThrow();
    expect(() => season.configureSimulation({ missionPool: 'XX' as never })).toThrow();
    expect(() => season.configurePrize({ initialPrizePot: -1 })).toThrow();
    expect(() => season.configurePrize({ initialPrizePot: 100, maxPrizePot: 50 })).toThrow();
    season.changeMode(SeasonMode.MANUAL);
    season.configureSimulation({ chaos: 30 });
    season.start(1, GamePhase.ARRIVAL);
    expect(() => season.start(1, GamePhase.ARRIVAL)).toThrow();
    expect(() => season.changeMode(SeasonMode.PLAYER)).toThrow();
    expect(() => season.configureSimulation({ chaos: 10 })).toThrow();
    expect(() => season.configurePrize({ initialPrizePot: 1 })).toThrow();
    season.moveTo(2, GamePhase.BREAKFAST);
    season.startEndgame();
    expect(() => season.startEndgame()).toThrow();
    season.finish();
    expect(season.isFinished()).toBe(true);
    expect(() => season.finish()).toThrow();
    expect(() => season.moveTo(3, GamePhase.MISSION)).toThrow();
    expect(normalizeMissionPool('S1')).toBe('US_S1');
    expect(normalizeMissionPool('UK_S3')).toBe('UK_S3');
    expect(normalizeMissionPool('???')).toBe('US_S3');
  });

  it('jogador, mesa redonda, missão, reunião e prêmio', () => {
    const player = Player.create({ seasonId: 's', name: 'Ana', behaviorIds: ['b', 'b'] });
    expect(player.behaviorIds).toEqual(['b']);
    expect(() => player.rename('')).toThrow();
    player.recruit();
    expect(() => player.recruit()).toThrow();
    player.eliminate(PlayerStatus.MURDERED, 'd1');
    expect(() => player.eliminate(PlayerStatus.BANISHED, 'd1')).toThrow();

    const table = RoundTable.create({ dayId: 'd', kind: RoundTableKind.REGULAR, sequence: 1 });
    expect(() => table.castVote('a', 'a')).toThrow();
    expect(() => table.castVote('a', 'b', 0)).toThrow();
    table.castVote('a', 'b');
    expect(() => table.castVote('a', 'c')).toThrow();
    expect(() => table.castEndgameVote('a', EndgameChoice.END_GAME)).toThrow();
    table.banish('b');
    expect(() => table.banish('c')).toThrow();
    const endgame = RoundTable.create({ dayId: 'd', kind: RoundTableKind.ENDGAME, sequence: 2 });
    endgame.castEndgameVote('a', EndgameChoice.END_GAME);
    expect(() => endgame.castEndgameVote('a', EndgameChoice.BANISH_AGAIN)).toThrow();
    expect(endgame.isEndgameUnanimous()).toBe(true);

    expect(() => Mission.create({ dayId: 'd', name: ' ' })).toThrow();
    const mission = Mission.create({ dayId: 'd', name: 'Barco', prizeAvailable: 100 });
    mission.grantShield('a');
    expect(() => mission.grantShield('a')).toThrow();

    const meeting = TraitorMeeting.create({ dayId: 'd' });
    expect(meeting.murderPlayer('x', true).outcome).toBe('BLOCKED_BY_SHIELD');
    expect(() => meeting.murderPlayer('y', false)).toThrow();
    meeting.recruitPlayer('z', false);
    expect(() => meeting.recruitPlayer('z', true)).toThrow();

    expect(() => PrizeTransaction.create({ seasonId: 's', dayId: null, missionId: null, type: PrizeTransactionType.ADJUSTMENT, amount: 0, description: null })).toThrow();
    expect(() => PrizeTransaction.create({ seasonId: 's', dayId: null, missionId: null, type: PrizeTransactionType.MISSION, amount: 10, description: null })).toThrow();

    const phase = DayPhase.start('d', GamePhase.MISSION);
    phase.writeNotes('  ');
    expect(phase.notes).toBeNull();
    phase.end();
    phase.reopen();
    expect(phase.toJSON().endedAt).toBeNull();
  });

  it('biblioteca: frases, comportamentos, personagens, casts e contas', () => {
    expect(() => Phrase.create({ phase: PhrasePhase.ARRIVAL, text: '' })).toThrow();
    expect(() => Phrase.create({ phase: PhrasePhase.ARRIVAL, text: 'sem marcador' })).toThrow();
    expect(() => Phrase.create({ phase: PhrasePhase.ARRIVAL, text: 'oi {fulano}' })).toThrow();
    expect(() => Phrase.create({ phase: PhrasePhase.ARRIVAL, text: `{user} ${'a'.repeat(600)}` })).toThrow();
    const phrase = Phrase.create({ phase: PhrasePhase.ARRIVAL, text: '{user} chegou.', tone: PhraseTone.HUMOR });
    phrase.rewrite('{user} chegou com {user1}.');
    phrase.moveTo(PhrasePhase.BREAKFAST);
    phrase.retone(PhraseTone.FRIENDLY);
    phrase.linkBehavior(null);

    expect(() => Behavior.create({ name: '' })).toThrow();
    expect(() => Behavior.create({ name: 'x'.repeat(41) })).toThrow();
    expect(() => Behavior.create({ name: 'Ok', effects: { nada: 1 } as never })).toThrow();
    expect(() => Behavior.create({ name: 'Ok', effects: { loyalty: 999 } })).toThrow();

    const character = Character.create({ name: 'Bia', ownerId: 'u' });
    expect(() => character.rename(' ')).toThrow();
    character.changeImage('https://example.com/b.png');
    const cast = Cast.create({ name: 'Elenco', ownerId: 'u', characterIds: ['a', 'a', 'b'] });
    expect(() => cast.rename('')).toThrow();
    cast.describe('desc');
    cast.changeImage(null);
    cast.setMembers(['c']);

    expect(() => User.register({ username: 'a', passwordHash: 'h' })).toThrow();
    const user = User.register({ username: 'maria', passwordHash: 'h' });
    expect(user.isOwner()).toBe(false);
    user.promoteToOwner();
    expect(user.toPublic().role).toBe('OWNER');
  });

  it('fluxo das fases, apuração de votos e divisão do prêmio', () => {
    const flow = new PhaseFlowPolicy();
    expect(flow.initial()).toEqual({ day: 1, phase: GamePhase.ARRIVAL });
    expect(flow.next({ day: 1, phase: GamePhase.TRAITORS_MEETING }, false)).toEqual({ day: 2, phase: GamePhase.BREAKFAST });
    expect(flow.next({ day: 3, phase: GamePhase.ROUND_TABLE }, true)).toEqual({ day: 3, phase: GamePhase.TRAITORS_MEETING });
    expect(flow.next({ day: 3, phase: GamePhase.TRAITORS_MEETING }, true)).toEqual({ day: 4, phase: GamePhase.BREAKFAST });
    expect(() => flow.next({ day: 3, phase: GamePhase.FINALE }, true)).toThrow();
    expect(() => flow.next({ day: 2, phase: GamePhase.ARRIVAL }, false)).toThrow();

    const tally = new VoteTallyService().tallyFinalRound([
      { id: '1', roundTableId: 'r', voterId: 'a', targetId: 'b', round: 1 },
      { id: '2', roundTableId: 'r', voterId: 'b', targetId: 'a', round: 2 },
    ] as never);
    expect(tally.round).toBe(2);

    const players = ['A', 'B', 'C'].map((name) => Player.create({ seasonId: 's', name }));
    const faithful = new WinnerPolicy().determine('s', players, 100);
    expect(faithful.map((w) => w.toJSON().prizeShare)).toEqual([33.34, 33.33, 33.33]);
    players[0].assignRole(PlayerRole.TRAITOR);
    expect(new WinnerPolicy().determine('s', players, 100)).toHaveLength(1);
    expect(new WinnerPolicy().determine('s', [], 100)).toHaveLength(0);
  });
});
