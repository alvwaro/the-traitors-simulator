import { PhraseTone, SimulationEventKind } from '../enums';
import { AllianceBook, AllianceGroup, MAX_ALLIANCE } from './alliances';
import { surprises } from './chaos';
import { SimVote } from './decisions';
import { Narrator, SpokenLine } from './narration';
import { FeelingDelta, RelationshipMatrix } from './RelationshipMatrix';
import { chance, pickOne, Rng, shuffle } from './random';
import { isTraitor, SimPlayer } from './traits';
import { tokenList } from './tokens';

/** "{user2}, {user3} e {user4}" a partir do marcador `first`. */

/**
 * Como os acontecimentos mexem nos relacionamentos.
 * `active` devolve quem ainda está no castelo no momento da chamada.
 */
export class Social {
  constructor(
    private readonly rng: Rng,
    private readonly matrix: RelationshipMatrix,
    private readonly active: () => SimPlayer[],
    /** As alianças da temporada (grupos independentes). */
    private readonly alliances: AllianceBook,
    /** Loucura da temporada (0 a 1). */
    private readonly chaos = 0,
    /** Jogador humano: ninguém o(a) coloca numa aliança sem ele(a) aceitar (os convites vêm pelas conversas). */
    private readonly humanId?: string,
  ) {}

  /** Intensidade das reações de alguém (0.6 a 1.6). */
  private intensity(p: SimPlayer): number {
    return 0.6 + p.traits.volatility / 100;
  }

  /** Quanto o rancor amplia o ódio recebido (0.6 a 1.4). */
  private rancor(p: SimPlayer): number {
    return 0.6 + p.traits.grudge / 125;
  }

  /**
   * O que `speaker` diz sobre `target` chega a todos que estão ouvindo,
   * com força proporcional à confiança no falante e à influência dele.
   * Traidores não mudam de opinião sobre os parceiros de traição.
   */
  /** A fala saiu pela culatra: quem foi atacado(a) convence a mesa contra quem atacou. */
  private backfire(accused: SimPlayer, accuser: SimPlayer, delta: FeelingDelta): void {
    this.broadcast(accused, accuser, delta);
  }

  broadcast(speaker: SimPlayer, target: SimPlayer, delta: FeelingDelta, strength = 1): void {
    for (const listener of this.active()) {
      if (listener.id === speaker.id || listener.id === target.id) continue;
      if (isTraitor(listener) && isTraitor(target)) continue;
      const weight = (this.matrix.get(listener.id, speaker.id).trust / 100) * (0.3 + speaker.traits.influence / 100);
      this.matrix.adjust(listener.id, target.id, delta, weight * strength);
    }
  }

  /**
   * Efeito de uma fala conforme o teor. Com loucura, a fala pode sair pela culatra:
   * a acusação faz a mesa defender o acusado e desconfiar de quem acusou (e vice-versa).
   * Devolve true quando saiu pela culatra.
   */
  applyLine(line: SpokenLine): boolean {
    const { speaker, target, second } = line;
    const vol = this.intensity(speaker);
    const backfire = !!target && surprises(this.rng, this.chaos * 0.6, speaker);
    const sign = backfire ? -1 : 1;
    switch (line.phrase.tone) {
      case PhraseTone.FRIENDLY:
      case PhraseTone.HUMOR:
        if (target) this.matrix.adjust(target.id, speaker.id, { liking: 6 * sign }, this.intensity(target));
        if (target) this.matrix.adjust(speaker.id, target.id, { liking: 4 });
        break;
      case PhraseTone.ALLIANCE:
        if (target) {
          this.matrix.adjust(speaker.id, target.id, { trust: 6 });
          this.matrix.adjust(target.id, speaker.id, { trust: 5 * sign, liking: 4 * sign });
        }
        break;
      case PhraseTone.SUSPICION:
        if (target) {
          this.matrix.adjust(target.id, speaker.id, { trust: -5, hatred: 4 }, this.intensity(target) * this.rancor(target));
          this.broadcast(speaker, target, { trust: -7 * sign });
          if (backfire) this.backfire(target, speaker, { trust: -5 });
        }
        break;
      case PhraseTone.ACCUSATION:
        if (target) {
          this.matrix.adjust(target.id, speaker.id, { trust: -10, hatred: 10 }, this.intensity(target) * this.rancor(target));
          this.broadcast(speaker, target, { trust: -12 * sign }, vol);
          if (backfire) this.backfire(target, speaker, { trust: -8, liking: -4 });
          if (second) this.matrix.adjust(second.id, speaker.id, { hatred: 4 });
        }
        break;
      case PhraseTone.CONFLICT:
        if (target) {
          this.matrix.adjust(speaker.id, target.id, { hatred: 8, liking: -6, trust: -4 }, vol * this.rancor(speaker));
          this.matrix.adjust(target.id, speaker.id, { hatred: 8, liking: -6, trust: -4 }, this.intensity(target) * this.rancor(target));
        }
        break;
      case PhraseTone.DEFENSE:
        if (target) {
          this.broadcast(speaker, target, { trust: 9 * sign });
          if (backfire) this.backfire(target, speaker, { trust: -6 });
          this.matrix.adjust(target.id, speaker.id, { liking: 8, trust: 6 });
          if (second) this.matrix.adjust(second.id, speaker.id, { hatred: 5, trust: -3 });
        }
        break;
      case PhraseTone.EMOTION:
        for (const listener of shuffle(this.rng, this.active()).slice(0, 4)) {
          if (listener.id !== speaker.id) this.matrix.adjust(listener.id, speaker.id, { liking: 3 * sign });
        }
        break;
      case PhraseTone.STRATEGY:
        if (target && isTraitor(speaker) && isTraitor(target)) this.matrix.adjust(target.id, speaker.id, { trust: 2 });
        break;
      default:
        // Até uma conversa neutra aproxima um pouco.
        if (target) this.matrix.adjust(target.id, speaker.id, { liking: 2 });
        break;
    }
    return backfire;
  }

  /** O alvo do voto guarda rancor; votar num aliado tira quem votou da aliança. Devolve true se foi traição. */
  vote(voter: SimPlayer, target: SimPlayer): boolean {
    this.matrix.adjust(target.id, voter.id, { trust: -10, hatred: 10, liking: -4 }, this.intensity(target) * this.rancor(target));
    // Quem gosta do alvo (ou é aliado dele) também fica de olho em quem votou; quem odeia o alvo gosta um pouco mais.
    for (const friend of this.active()) {
      if (friend.id === voter.id || friend.id === target.id) continue;
      const bond = this.matrix.get(friend.id, target.id);
      if (bond.allied || bond.liking >= 65) this.matrix.adjust(friend.id, voter.id, { trust: -3, hatred: 3, liking: -2 }, this.rancor(friend));
      else if (bond.hatred >= 55) this.matrix.adjust(friend.id, voter.id, { liking: 2 });
    }
    return this.breakAlliance(voter, target);
  }

  /** Quem vota num aliado (em qualquer rodada) sai das alianças que dividia com ele(a); os outros membros ficam com o pé atrás. */
  breakAlliance(voter: SimPlayer, target: SimPlayer): boolean {
    if (!this.matrix.isAllied(voter.id, target.id)) return false;
    for (const id of this.alliances.leaveWith(voter.id, target.id)) {
      if (id !== target.id) this.matrix.adjust(id, voter.id, { trust: -8, liking: -4 });
    }
    this.matrix.adjust(target.id, voter.id, { hatred: 20, liking: -15, trust: -20 }, this.rancor(target));
    return true;
  }

  /** Quem votou no mesmo nome na primeira rodada se aproxima um pouco; quem recebeu o voto de alguém, se afasta dele. */
  coVoters(votes: readonly SimVote[]): void {
    const first = votes.filter((v) => v.round === 1);
    for (const a of first) {
      for (const b of first) {
        if (a.voterId === b.voterId) continue;
        if (a.targetId === b.targetId) this.matrix.adjust(a.voterId, b.voterId, { trust: 3, liking: 1 });
        else if (b.targetId === a.voterId) this.matrix.adjust(a.voterId, b.voterId, { trust: -2 });
      }
    }
  }

  /**
   * Papel revelado do banido:
   *  - traidor: quem votou nele ganha confiança; quem era aliado dele perde;
   *  - fiel: os aliados do banido passam a odiar quem votou nele e o castelo desconfia desses votantes.
   */
  reveal(banished: SimPlayer, votes: readonly SimVote[]): void {
    const voters = new Set(votes.filter((v) => v.round === 1 && v.targetId === banished.id).map((v) => v.voterId));
    const active = this.active();
    const allies = active.filter((p) => this.matrix.isAllied(p.id, banished.id));

    for (const observer of active) {
      for (const other of active) {
        if (observer.id === other.id) continue;
        if (isTraitor(banished)) {
          if (voters.has(other.id)) this.matrix.adjust(observer.id, other.id, { trust: 5 });
          if (allies.includes(other) && !isTraitor(observer)) this.matrix.adjust(observer.id, other.id, { trust: -8 });
        } else if (voters.has(other.id)) {
          const grieving = allies.includes(observer);
          this.matrix.adjust(observer.id, other.id, grieving ? { trust: -8, hatred: 12 } : { trust: -3 }, grieving ? this.rancor(observer) : 1);
        }
      }
    }
    this.alliances.removePlayer(banished.id);
  }

  /**
   * A cada manhã:
   *  - intuição: fiéis desconfiam aos poucos dos traidores (mais os intuitivos, menos com os dissimulados);
   *  - paranoicos desconfiam de todos;
   *  - reciprocidade: quem é bem tratado tende a gostar de volta;
   *  - aliados pensam parecido: a opinião de um puxa a do outro;
   *  - o tempo esfria as emoções (menos nos rancorosos) e aproxima a confiança do neutro.
   */
  dailyDrift(): void {
    const active = this.active();
    for (const observer of active) {
      const t = observer.traits;
      const allies = active.filter((p) => p.id !== observer.id && this.matrix.isAllied(observer.id, p.id));
      for (const other of active) {
        if (other.id === observer.id) continue;
        const f = this.matrix.get(observer.id, other.id);
        const back = this.matrix.get(other.id, observer.id);
        const delta: FeelingDelta = { trust: 0, liking: 0, hatred: 0 };

        if (!isTraitor(observer)) {
          delta.trust! += isTraitor(other)
            ? -(1.5 + this.rng() * 4.5) * (1.25 - other.traits.deception / 100) * (0.3 + t.paranoia / 200 + t.insight / 120)
            : this.rng() * 2.5 - 0.8;
          delta.trust! -= (t.paranoia - 50) / 40;
        }
        if (f.allied) delta.trust! += 2;

        delta.liking! += (back.liking - f.liking) * 0.05;
        const accomplices = isTraitor(observer) && isTraitor(other);
        if (!f.allied && !accomplices) delta.trust! += (50 - f.trust) * 0.01;
        if (f.hatred > 15) delta.hatred! -= (f.hatred - 15) * 0.06 * (1.3 - t.grudge / 100);

        for (const ally of allies) {
          if (ally.id === other.id) continue;
          const view = this.matrix.get(ally.id, other.id);
          delta.trust! += (view.trust - f.trust) * 0.04;
          delta.hatred! += Math.max(0, view.hatred - 40) * 0.03;
        }
        this.matrix.adjust(observer.id, other.id, delta);
      }
    }
  }

  /** Depois de um assassinato: quem a vítima desconfiava passa a ser olhado com suspeita. */
  murderAftermath(victim: SimPlayer): void {
    const active = this.active();
    const suspects = active.filter((p) => this.matrix.get(victim.id, p.id).trust < 35);
    for (const survivor of active) {
      if (isTraitor(survivor)) continue;
      for (const suspect of suspects) {
        if (suspect.id !== survivor.id) this.matrix.adjust(survivor.id, suspect.id, { trust: -4 });
      }
    }
  }

  /**
   * Alianças de 2 a 5 pessoas, cada uma um grupo próprio: a mesma pessoa pode estar em várias
   * (até 3), com gente diferente em cada. Cada um tenta trazer quem mais confia para uma das suas
   * alianças com vaga, ou fecha uma aliança nova a dois. Chance = confiança × lealdade; o convidado
   * aceita se confiar no grupo, e um membro que odeia o convidado pode vetar.
   * Tudo acontece num canto: só quem está na aliança fica sabendo. Com loucura, o convite vai para qualquer um.
   * O jogador humano nunca entra sem aceitar: os convites para ele vêm pelas conversas.
   */
  formAlliances(narrator: Narrator, maxNew = 3): void {
    const everyone = this.active();
    const byId = new Map(everyone.map((p) => [p.id, p]));
    const book = this.alliances;
    let created = 0;
    for (const proposer of shuffle(this.rng, everyone.filter((p) => p.id !== this.humanId))) {
      if (created >= maxNew) break;
      const open = book.of(proposer.id).filter((g) => g.memberIds.length < MAX_ALLIANCE);
      if (!open.length && !book.canJoin(proposer.id)) continue;
      // Quem já tem aliança procura menos gente nova.
      if (!chance(this.rng, (0.3 + proposer.traits.sociability / 250) * (book.of(proposer.id).length ? 0.55 : 1))) continue;

      // Opções: levar alguém para uma aliança com vaga, ou fechar uma nova a dois.
      type Offer = { partner: SimPlayer; group: AllianceGroup | null; appeal: number };
      const offers: Offer[] = [];
      for (const partner of everyone) {
        if (partner === proposer || partner.id === this.humanId || !book.canJoin(partner.id)) continue;
        for (const group of open) {
          if (!group.memberIds.includes(partner.id)) offers.push({ partner, group, appeal: this.groupTrust(group.memberIds, partner.id, proposer.id, 'in') });
        }
        if (book.canJoin(proposer.id) && !this.matrix.isAllied(proposer.id, partner.id)) {
          offers.push({ partner, group: null, appeal: this.matrix.get(proposer.id, partner.id).trust });
        }
      }
      const wild = surprises(this.rng, this.chaos, proposer);
      const offer = wild ? pickOne(this.rng, offers) : [...offers].sort((a, b) => b.appeal - a.appeal)[0];
      if (!offer) continue;
      const { partner, group } = offer;
      const members = group ? group.memberIds : [proposer.id];

      const trust = this.matrix.get(proposer.id, partner.id).trust;
      if (!wild && !chance(this.rng, (trust / 100) * (proposer.traits.loyalty / 100))) continue;

      // Um membro que não suporta o convidado veta a entrada.
      const veto = members.find((id) => id !== proposer.id && (this.matrix.get(id, partner.id).hatred >= 60 || this.matrix.get(id, partner.id).trust < 25));
      if (veto && !wild) {
        this.matrix.adjust(proposer.id, veto, { liking: -3 });
        narrator.line(SimulationEventKind.ALLIANCE, '{user} quis trazer {user1} para a aliança, mas {user2} vetou.', [proposer, partner, byId.get(veto)!], PhraseTone.CONFLICT, true);
        continue;
      }

      const back = this.groupTrust(members, partner.id, proposer.id, 'from');
      if (back >= 50 || chance(this.rng, back / 100)) {
        const joined = group ? book.join(group.id, partner.id) : !!book.create([proposer.id, partner.id]);
        if (!joined) continue;
        for (const id of members) {
          this.matrix.adjust(id, partner.id, { trust: 6, liking: 4 });
          this.matrix.adjust(partner.id, id, { trust: 6, liking: 4 });
        }
        const others = members.filter((id) => id !== proposer.id).map((id) => byId.get(id)!);
        let text = wild ? 'Ninguém entendeu, mas {user} e {user1} selaram uma aliança.' : '{user} e {user1} fecharam uma aliança: um protege o outro na mesa.';
        if (others.length) text = `{user} trouxe {user1} para a aliança com ${tokenList(others.length, 2)}.`;
        narrator.line(SimulationEventKind.ALLIANCE, text, [proposer, partner, ...others], PhraseTone.ALLIANCE, true);
        created++;
      } else {
        this.matrix.adjust(proposer.id, partner.id, { liking: -6, trust: -4 });
        narrator.line(SimulationEventKind.ALLIANCE, '{user} chamou {user1} para uma aliança, que desconversou.', [proposer, partner], PhraseTone.CONFLICT, true);
      }
    }
  }

  /**
   * Confiança entre um grupo e alguém (quem convida pesa em dobro):
   * 'in' = o quanto o grupo confia na pessoa; 'from' = o quanto a pessoa confia no grupo.
   */
  private groupTrust(group: readonly string[], id: string, leaderId: string, direction: 'in' | 'from'): number {
    let total = 0;
    let weight = 0;
    for (const member of group) {
      if (member === id) continue;
      const w = member === leaderId ? 2 : 1;
      total += (direction === 'in' ? this.matrix.get(member, id) : this.matrix.get(id, member)).trust * w;
      weight += w;
    }
    return weight ? total / weight : 50;
  }

  /** Traidores se conhecem: confiam uns nos outros (em segredo). */
  bondTraitors(traitors: readonly SimPlayer[]): void {
    for (const a of traitors) {
      for (const b of traitors) {
        if (a.id === b.id) continue;
        this.matrix.set(a.id, b.id, { trust: Math.max(75, this.matrix.get(a.id, b.id).trust) });
        this.matrix.adjust(a.id, b.id, { liking: 8 });
      }
    }
  }
}
