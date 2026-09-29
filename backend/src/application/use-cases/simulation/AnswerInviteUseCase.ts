import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { AnswerInviteInput, GameStateOutput } from '../../dtos/GameDTOs';
import { DomainError } from '../../../domain/errors/DomainError';
import { answerInvite } from '../../../domain/simulation';
import { loadHumanTurn, saveHumanTurn } from '../../services/humanTurn';

/**
 * Modo Jogador: responder a um convite para aliança feito por um personagem.
 * Não gasta conversa; aceitar põe o jogador naquela aliança (as outras dele continuam), recusar magoa quem convidou.
 */
export class AnswerInviteUseCase implements IUseCase<AnswerInviteInput, GameStateOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: AnswerInviteInput): Promise<GameStateOutput> {
    return this.uow.run(async (repos) => {
      const turn = await loadHumanTurn(repos, input.seasonId, 'Convites só existem no modo Jogador');
      const { view, active, human, memory, state, alliances, day } = turn;
      const groupId = input.groupId ?? null;
      if (!view.invites.some((i) => i.fromId === input.inviterId && i.groupId === groupId)) throw new DomainError('Esse convite não está mais de pé');

      const inviter = active.find((p) => p.id === input.inviterId);
      if (!inviter) throw new DomainError('Quem convidou não está mais no castelo');
      const invite = (memory.invites ?? []).find((i) => i.fromId === inviter.id && (i.groupId ?? null) === groupId);
      if (!invite) throw new DomainError('Esse convite não está mais de pé');

      const events = answerInvite({ matrix: state.matrix, alliances, invite, human, inviter, active, accept: input.accept, memory, day: day.number });
      if (!events) throw new DomainError('Não dá para entrar: a aliança está cheia (máx. 5) ou você já está em alianças demais');
      return saveHumanTurn(repos, turn, events);
    });
  }
}
