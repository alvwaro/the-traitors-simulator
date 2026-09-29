import { Repositories } from '../../ports/IUnitOfWork';
import { RegisterTraitorsMeetingInput } from '../../dtos/GameDTOs';
import { Player, TraitorMeeting, TraitorMeetingProps } from '../../../domain/entities';
import { GamePhase, MurderOutcome, PlayerStatus } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { UndoableRecord } from '../../services/undo';

/**
 * Reunião noturna: assassinato (bloqueado se o alvo tem escudo do dia)
 * e/ou recrutamento. Ultimato recusado conta como o assassinato da noite.
 * A vítima é revelada no café da manhã seguinte.
 */
export class RegisterTraitorsMeetingUseCase extends UndoableRecord<RegisterTraitorsMeetingInput, TraitorMeetingProps> {
  protected readonly undoLabel = 'Registro da reunião dos traidores';

  async record(repos: Repositories, input: RegisterTraitorsMeetingInput): Promise<TraitorMeetingProps> {
    const { season, day } = await loadActiveGame(repos, input.seasonId, GamePhase.TRAITORS_MEETING);
    if (await repos.traitorMeetings.findByDay(day.id)) {
      throw new DomainError('A reunião dos traidores de hoje já foi registrada');
    }

    const roster = await PlayerRoster.load(repos, season.id);
    if (!roster.active().some((p) => p.isTraitor())) throw new DomainError('Não há traidores ativos');

    const meeting = TraitorMeeting.create({ dayId: day.id, notes: input.notes });
    const changed: Player[] = [];

    if (input.murderTargetId) {
      const target = this.requireFaithful(roster, input.murderTargetId);
      const shielded = await repos.missions.findShieldedPlayerIds(day.id);
      meeting.murderPlayer(target.id, !input.plainSight && shielded.includes(target.id));
    }

    if (input.recruitment) {
      const target = this.requireFaithful(roster, input.recruitment.targetId);
      if (target.id === input.murderTargetId) throw new DomainError('O alvo do assassinato não pode ser recrutado');
      meeting.recruitPlayer(target.id, input.recruitment.accepted, input.recruitment.isUltimatum ?? false);
      if (input.recruitment.accepted) {
        target.recruit();
        changed.push(target);
      }
    }

    if (meeting.murder?.outcome === MurderOutcome.SUCCESS) {
      const victim = roster.require(meeting.murder.targetId);
      victim.eliminate(PlayerStatus.MURDERED, day.id);
      changed.push(victim);
    }

    await repos.traitorMeetings.create(meeting);
    await repos.players.updateMany(changed);
    return meeting.toJSON();
  }

  private requireFaithful(roster: PlayerRoster, playerId: string): Player {
    const player = roster.requireActive(playerId);
    if (player.isTraitor()) throw new DomainError(`${player.name} é traidor(a)`);
    return player;
  }
}
