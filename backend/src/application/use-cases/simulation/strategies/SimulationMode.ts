import { Day, Player, Season } from '../../../../domain/entities';
import { EndgameChoice, GamePhase } from '../../../../domain/enums';
import { DomainError } from '../../../../domain/errors/DomainError';
import {
  expireInvites,
  HumanEndgameChoice,
  HumanOffer,
  HumanTowerChoice,
  MeetingDecision,
  murdersOver,
  RelationshipMatrix,
  SeerAnnouncement,
  seerDinnerTonight,
  SimulationEngine,
  SimulationFlags,
} from '../../../../domain/simulation';
import { HumanDecision } from '../../../dtos/GameDTOs';
import { Repositories } from '../../../ports/IUnitOfWork';
import { buildPlayerView } from '../../../services/playerView';
import { SimulationState } from '../../../services/simulation';

/**
 * Strategy: de onde vêm as decisões de quem joga.
 *  - Automática: ninguém decide; a simulação escolhe tudo.
 *  - Jogador: o voto, a mesa final, a torre e a resposta aos convites vêm do usuário (e são validados).
 */
export interface SimulationMode {
  /** O usuário ainda está no jogo (cada decisão dele é obrigatória). */
  readonly playing: boolean;
  /** Antes de simular a fase: o que muda só neste modo. */
  prepare(engine: SimulationEngine, matrix: RelationshipMatrix, day: Day, phase: GamePhase): void;
  vote(decision: HumanDecision): string | undefined;
  /** Voto na revotação de um empate (só entre os empatados). */
  revote(decision: HumanDecision, tiedIds: readonly string[]): string | undefined;
  finalChoice(decision: HumanDecision): HumanEndgameChoice | undefined;
  towerChoice(repos: Repositories, season: Season, day: Day, decision: HumanDecision): Promise<HumanTowerChoice | undefined>;
  answerOffer(engine: SimulationEngine, offer: HumanOffer, decision: HumanDecision): MeetingDecision;
  /** Vidente humano: com quem janta esta noite (undefined = a simulação escolhe). */
  seerGuest(flags: SimulationFlags, day: Day, decision: HumanDecision): string | undefined;
  /** Vidente humano, no café: o que conta ao castelo. */
  seerAnnouncement(decision: HumanDecision): SeerAnnouncement | undefined;
}

export class AutomaticMode implements SimulationMode {
  readonly playing = false;
  prepare(): void {}
  vote(): undefined {
    return undefined;
  }
  revote(): undefined {
    return undefined;
  }
  finalChoice(): undefined {
    return undefined;
  }
  towerChoice(): Promise<undefined> {
    return Promise.resolve(undefined);
  }
  answerOffer(): MeetingDecision {
    throw new DomainError('Não há convite esperando resposta nesta temporada');
  }
  seerGuest(): undefined {
    return undefined;
  }
  seerAnnouncement(): undefined {
    return undefined;
  }
}

export class PlayerMode implements SimulationMode {
  constructor(
    private readonly human: Player,
    private readonly players: readonly Player[],
  ) {}

  get playing(): boolean {
    return this.human.isActive();
  }

  /** Convite para aliança que ficou sem resposta expira (e quem convidou nota). */
  prepare(engine: SimulationEngine, matrix: RelationshipMatrix, day: Day, phase: GamePhase): void {
    const memory = engine.flags.human;
    if (memory?.invites?.length) expireInvites(matrix, memory, this.human.id, day.number, phase);
  }

  vote(decision: HumanDecision): string | undefined {
    if (!this.playing) return undefined;
    const targetId = decision.voteTargetId;
    if (!targetId) throw new DomainError('Escolha em quem você vota');
    const target = this.players.find((p) => p.id === targetId);
    if (!target?.isActive() || target.id === this.human.id) throw new DomainError('Vote em alguém que está na mesa (e não em você)');
    return target.id;
  }

  revote(decision: HumanDecision, tiedIds: readonly string[]): string | undefined {
    if (!this.playing) return undefined;
    const targetId = decision.voteTargetId;
    if (!targetId || !tiedIds.includes(targetId) || targetId === this.human.id) throw new DomainError('Empate: vote em uma das pessoas empatadas (que não seja você)');
    return targetId;
  }

  finalChoice(decision: HumanDecision): HumanEndgameChoice | undefined {
    if (!this.playing) return undefined;
    if (decision.endgameChoice !== EndgameChoice.END_GAME && decision.endgameChoice !== EndgameChoice.BANISH_AGAIN) {
      throw new DomainError('Escolha entre encerrar o jogo ou banir mais alguém');
    }
    // O voto vem depois, se alguém escolher banir (ver EndgameSimulation).
    return { choice: decision.endgameChoice };
  }

  /** Vidente: o convidado precisa estar no jogo (e não ser você). */
  seerGuest(flags: SimulationFlags, day: Day, decision: HumanDecision): string | undefined {
    if (!this.playing || flags.seer?.seerId !== this.human.id || !seerDinnerTonight(flags, day.number)) return undefined;
    const guest = this.players.find((p) => p.id === decision.seerGuestId);
    if (!guest?.isActive() || guest.id === this.human.id) throw new DomainError('Vidente: escolha com quem você vai jantar esta noite');
    return guest.id;
  }

  seerAnnouncement(decision: HumanDecision): SeerAnnouncement | undefined {
    if (!this.playing) return undefined;
    const choice = decision.seerAnnouncement;
    return choice === 'TRUTH' || choice === 'LIE' || choice === 'SECRET' ? choice : undefined;
  }

  async towerChoice(repos: Repositories, season: Season, day: Day, decision: HumanDecision): Promise<HumanTowerChoice | undefined> {
    if (!this.playing || !this.human.isTraitor()) return undefined;
    // Na reta final não há mais assassinatos, nem na noite em que a missão fechou a torre.
    if (murdersOver(this.players.filter((p) => p.isActive()).length)) return undefined;
    if ((season.simState as SimulationFlags).noMurderDay === day.number) return undefined;
    const view = await buildPlayerView(repos, season, this.players, day);
    const faithful = (id: string | null | undefined) => {
      const p = this.players.find((x) => x.id === id);
      return !!p && p.isActive() && !p.isTraitor() && p.id !== this.human.id;
    };
    if (decision.recruit) {
      const { targetId, ultimatum, victimIfAcceptedId } = decision.recruit;
      if (!faithful(targetId)) throw new DomainError('Só dá para recrutar um fiel que ainda está no jogo');
      if (ultimatum ? !view?.canUltimatum : !view?.canRecruit) {
        throw new DomainError(ultimatum ? 'O ultimato só vale para o último traidor restante' : 'Os Traidores não podem recrutar esta noite');
      }
      if (ultimatum && (!faithful(victimIfAcceptedId) || victimIfAcceptedId === targetId)) {
        throw new DomainError('No ultimato, escolha também quem vocês matam juntos se ele(a) aceitar');
      }
      return { recruit: { targetId, ultimatum, victimIfAcceptedId: ultimatum ? victimIfAcceptedId : null } };
    }
    if (!faithful(decision.murderTargetId)) throw new DomainError('Escolha um fiel para assassinar');
    if (view?.dungeonIds.length && !view.dungeonIds.includes(decision.murderTargetId!)) {
      throw new DomainError('Esta noite só é possível matar um dos condenados da masmorra');
    }
    if (view?.coffinNight) {
      const ids = [...new Set(decision.coffinIds ?? [])];
      const valid = ids.every((id) => this.players.some((p) => p.id === id && p.isActive() && p.id !== this.human.id));
      if (ids.length !== 3 || !valid || !ids.includes(decision.murderTargetId!)) {
        throw new DomainError('Noite dos caixões: escolha três nomes (pode incluir um traidor, menos você) e qual caixão será pregado');
      }
      return { murderTargetId: decision.murderTargetId, coffinIds: ids };
    }
    return { murderTargetId: decision.murderTargetId };
  }

  answerOffer(engine: SimulationEngine, offer: HumanOffer, decision: HumanDecision): MeetingDecision {
    if (decision.offerResponse !== 'ACCEPT' && decision.offerResponse !== 'DECLINE') throw new DomainError('Responda ao convite: aceitar ou recusar');
    const accept = decision.offerResponse === 'ACCEPT';
    if (accept && offer.ultimatum) {
      const victim = this.players.find((p) => p.id === decision.victimId);
      if (!victim?.isActive() || victim.isTraitor() || victim.id === this.human.id) throw new DomainError('Escolha o fiel que vocês vão assassinar juntos');
    }
    return engine.answerOffer(offer, accept, decision.victimId);
  }
}

/** Escolhe a estratégia pelo tipo de temporada. */
export function simulationModeFor(season: Season, state: SimulationState): SimulationMode {
  const human = season.isPlayerMode() ? state.players.find((p) => p.isHuman) : undefined;
  return human ? new PlayerMode(human, state.players) : new AutomaticMode();
}

