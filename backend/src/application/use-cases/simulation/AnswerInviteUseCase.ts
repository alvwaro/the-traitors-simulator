import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { AnswerInviteInput, GameStateOutput } from '../../dtos/GameDTOs';
import { SimulationEvent } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { AllianceBook, answerInvite, HumanMemory, SimulationFlags } from '../../../domain/simulation';
import { loadActiveGame } from '../../services/gameGuards';
import { readGameState } from '../../services/gameState';
import { buildPlayerView } from '../../services/playerView';
import { activeSim, ensureRelationships } from '../../services/simulation';

/**
 * Modo Jogador: responder a um convite para aliança feito por um personagem.
 * Não gasta conversa; aceitar põe o jogador naquela aliança (as outras dele continuam), recusar magoa quem convidou.
 */
export class AnswerInviteUseCase implements IUseCase<AnswerInviteInput, GameStateOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: AnswerInviteInput): Promise<GameStateOutput> {
    return this.uow.run(async (repos) => {
      const { season, day, phase } = await loadActiveGame(repos, input.seasonId);
      if (!season.isPlayerMode()) throw new DomainError('Convites só existem no modo Jogador');

      const state = await ensureRelationships(repos, season.id);
      const view = await buildPlayerView(repos, season, state.players, day);
      if (!view?.isActive) throw new DomainError('Você não está mais no jogo');
      const groupId = input.groupId ?? null;
      if (!view.invites.some((i) => i.fromId === input.inviterId && i.groupId === groupId)) throw new DomainError('Esse convite não está mais de pé');

      const active = activeSim(state);
      const human = active.find((p) => p.id === view.playerId)!;
      const inviter = active.find((p) => p.id === input.inviterId);
      if (!inviter) throw new DomainError('Quem convidou não está mais no castelo');

      const flags = { ...(season.simState as SimulationFlags) };
      const memory: HumanMemory = { ...(flags.human ?? {}) };
      const invite = (memory.invites ?? []).find((i) => i.fromId === inviter.id && (i.groupId ?? null) === groupId);
      if (!invite) throw new DomainError('Esse convite não está mais de pé');
      const alliances = new AllianceBook(state.matrix, flags, active.map((p) => p.id));
      const events = answerInvite({ matrix: state.matrix, alliances, invite, human, inviter, active, accept: input.accept, memory, day: day.number });
      if (!events) throw new DomainError('Não dá para entrar: a aliança está cheia (máx. 5) ou você já está em alianças demais');

      await repos.relationships.saveMany(season.id, state.matrix.changed());
      season.recordSimState({ ...flags, human: memory });
      await repos.seasons.update(season);
      const sequence = (await repos.simulationEvents.findByDay(day.id)).filter((e) => e.phase === phase).length;
      await repos.simulationEvents.createMany(
        events.map((e, i) => SimulationEvent.create({ seasonId: season.id, dayId: day.id, phase, sequence: sequence + i + 1, ...e })),
      );
      return readGameState(repos, season.id);
    });
  }
}
