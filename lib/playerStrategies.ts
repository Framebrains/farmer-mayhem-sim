import { GameState, PendingAttack, Strategy, PlayerState } from './types';
import { CARD_DATABASE, ATTACK_HIT_THRESHOLD, hitThresholdFor } from './cardDatabase';

/** Sort a player's attack cards by hit chance (highest first). Works for both
 *  built-in and custom attack cards via hitThresholdFor(). */
function bestAttackInHand(hand: string[]): string | null {
  const attacks = [...new Set(hand)]
    .filter(c => {
      const def = CARD_DATABASE[c];
      return def?.type === 'attack';
    })
    .filter(c => hand.includes(c)) // re-check (Set dedup'd)
    .sort((a, b) => {
      const tA = hitThresholdFor(a) ?? 7;
      const tB = hitThresholdFor(b) ?? 7;
      return tA - tB; // lower threshold = better
    });
  return attacks[0] ?? null;
}

/** Find custom SPECIALTY cards in hand whose effects include a given kind.
 *  (Attack-type customs are handled via chooseAttackCard / bestAttackInHand.) */
function customsWithEffect(hand: string[], kind: 'heal' | 'draw' | 'discard' | 'steal'): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of hand) {
    if (seen.has(c)) continue;
    seen.add(c);
    const def = CARD_DATABASE[c];
    if (!def?.isCustom || def.type === 'attack' || !def.effects) continue;
    if (def.effects.some(e => e.kind === kind)) out.push(c);
  }
  return out;
}

/** Any custom specialty card with effects (catch-all for cards that don't
 *  match the heal/draw heuristic — e.g. a "discard target's hand" disruptor). */
function customSpecialtiesInHand(hand: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of hand) {
    if (seen.has(c)) continue;
    seen.add(c);
    const def = CARD_DATABASE[c];
    if (def?.isCustom && def.type !== 'attack' && def.effects && def.effects.length > 0) {
      out.push(c);
    }
  }
  return out;
}

// ─── HELPERS ────────────────────────────────────────────────

function getPlayer(state: GameState, id: number): PlayerState {
  return state.players.find(p => p.id === id)!;
}

function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter(p => !p.isEliminated);
}

function aliveOthers(state: GameState, playerId: number): PlayerState[] {
  return alivePlayers(state).filter(p => p.id !== playerId);
}

function hasCard(state: GameState, playerId: number, cardId: string): boolean {
  return getPlayer(state, playerId).hand.includes(cardId);
}

function countCard(state: GameState, playerId: number, cardId: string): number {
  return getPlayer(state, playerId).hand.filter(c => c === cardId).length;
}

// ─── STRATEGY INTERFACE ─────────────────────────────────────

export interface StrategyFunctions {
  chooseAttackCard(state: GameState, playerId: number): string | null;
  chooseAttackTarget(state: GameState, attackerId: number): number;
  shouldPlayGodMode(state: GameState, playerId: number, threat: PendingAttack): boolean;
  shouldPlayStopIt(state: GameState, playerId: number, targetTurnPlayerId: number): boolean;
  shouldRedirect(state: GameState, playerId: number, attack: PendingAttack): { play: boolean; newTargetId: number };
  shouldPlayWrongGoat(state: GameState, playerId: number, attack: PendingAttack): boolean;
  shouldPlayAdrenaline(state: GameState, playerId: number, attack: PendingAttack | null, diceResult: number): boolean;
  chooseSpecialtyCardsThisTurn(state: GameState, playerId: number): string[];
  chooseTargetForCard(state: GameState, playerId: number, cardId: string): number;
  chooseCardsToDiscard(state: GameState, playerId: number, count: number): string[];
}

// ─── SMART-BRAIN HELPERS ────────────────────────────────────
//
// All "smart" strategies share the same core decision-making. The three
// strategies (expert / aggressive / defensive) differ only in *style biases*
// applied on top — much like real human players who all understand the
// game but lean toward offence vs. defence.

/** Composite threat score for a player. HP weighs heaviest. */
function threatScore(p: PlayerState): number {
  let s = p.hp * 10 + p.hand.length * 0.5;
  const attacks = p.hand.filter(c => CARD_DATABASE[c]?.type === 'attack').length;
  s += attacks * 2;
  if (p.stationaryCards.some(x => x.cardId === 'senile_grandma')) s -= 8;
  if (p.hand.includes('insurance') && !p.hasUsedInsurance) s += 3;
  return s;
}

function findLeader(state: GameState, excludeId: number): PlayerState | null {
  const others = state.players.filter(p => !p.isEliminated && p.id !== excludeId);
  if (others.length === 0) return null;
  return others.reduce((a, b) => threatScore(a) > threatScore(b) ? a : b);
}

function hitChance(cardId: string): number {
  const threshold = hitThresholdFor(cardId);
  if (threshold == null) return 0;
  return (7 - threshold) / 6;
}

// ═══════════════════════════════════════════════════════════════
// EXPERT (Smart — balanserad). The realistic baseline.
// ═══════════════════════════════════════════════════════════════
//
// Plays like a thoughtful human with full information.
//   • Attacks the LEADER (highest threat score)
//   • Saves God Mode for likely-lethal threats
//   • Resource pacing: max 2 specialty cards / turn
//   • Combo awareness (Oppenheimer before C4 attacks)
//   • Adrenaline only on killing-blow miss or last-stand hit

const expert: StrategyFunctions = {
  chooseAttackCard(state, playerId) {
    const player = getPlayer(state, playerId);
    if (player.hand.length === 0) return null;

    const best = bestAttackInHand(player.hand);
    if (!best) return null;

    // Endgame: with one opponent left, swing with anything
    const alive = alivePlayers(state).length;
    if (alive === 2) return best;

    // At 1 HP without protection, lay low
    if (player.hp === 1) {
      const hasProtection = player.hand.includes('god_mode') || player.hand.includes('insurance');
      if (!hasProtection) return null;
    }

    // Avoid swinging Unicorn (low hit chance) unless target is at 1 HP
    if (best === 'unicorn' || hitChance(best) < 0.4) {
      const others = aliveOthers(state, playerId);
      if (!others.some(o => o.hp === 1)) {
        // Look for a better option (we already picked the best); skip attack.
        return null;
      }
    }
    return best;
  },

  chooseAttackTarget(state, attackerId) {
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;
    others.sort((a, b) => {
      const sA = threatScore(a) + (a.hp === 1 ? 5 : 0);
      const sB = threatScore(b) + (b.hp === 1 ? 5 : 0);
      return sB - sA;
    });
    return others[0].id;
  },

  shouldPlayGodMode(state, playerId, threat) {
    if (!hasCard(state, playerId, 'god_mode')) return false;
    const player = getPlayer(state, playerId);
    const isTarget = threat.targetId === playerId;
    const godModes = countCard(state, playerId, 'god_mode');

    if (!isTarget) return false;

    const hitProb = hitChance(threat.attackCardId);

    if (player.hp === 1 && !player.hand.includes('insurance')) return true;
    if (player.hp === 1 && hitProb >= 0.5 && godModes >= 1) return true;
    if (player.hp === 2 && threat.attackCardId === 'c4_goat' && godModes >= 2) return true;
    return false;
  },

  shouldPlayStopIt(state, playerId, targetTurnPlayerId) {
    if (!hasCard(state, playerId, 'stop_it')) return false;
    const player = getPlayer(state, playerId);
    const target = getPlayer(state, targetTurnPlayerId);
    const targetHasAttack = target.hand.some(c => CARD_DATABASE[c]?.type === 'attack');

    // Panic-button case: 1 HP, no other defence, target can attack
    if (player.hp === 1 && targetHasAttack) {
      const hasOtherDefense =
        player.hand.includes('god_mode') ||
        player.hand.includes('redirect') ||
        player.hand.includes('wrong_goat') ||
        player.hand.includes('insurance') ||
        player.stationaryCards.some(s => s.cardId === 'senile_grandma');
      if (!hasOtherDefense) return true;
    }

    // Stop a leader who is about to play Oppenheimer + we have C4 to protect
    if (target.hand.includes('oppenheimer') &&
        player.hand.filter(c => c === 'c4_goat').length >= 2) {
      return true;
    }
    return false;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect')) return { play: false, newTargetId: -1 };
    // ANY player can play Re-direct (rule clarification) — including bystanders.
    // The attacker would never redirect their own attack though.
    if (attack.attackerId === playerId) return { play: false, newTargetId: -1 };

    const player = getPlayer(state, playerId);
    const isTarget = attack.targetId === playerId;
    const hitProb = hitChance(attack.attackCardId);

    // CASE A — I'm the target: defensive use
    if (isTarget) {
      if (player.hp === 1 || hitProb >= 0.4) {
        const others = state.players.filter(p =>
          !p.isEliminated && p.id !== playerId && p.id !== attack.attackerId
        );
        if (others.length === 0) return { play: false, newTargetId: -1 };
        others.sort((a, b) => threatScore(b) - threatScore(a));
        return { play: true, newTargetId: others[0].id };
      }
      return { play: false, newTargetId: -1 };
    }

    // CASE B — I'm a bystander: kingmaker use
    // Only redirect if it shifts the attack onto a player who is a BIGGER threat
    // than the current target. Don't waste a card on a wash.
    if (hitProb >= 0.5) {
      const currentTarget = state.players.find(p => p.id === attack.targetId);
      if (!currentTarget) return { play: false, newTargetId: -1 };
      // Candidates: anyone alive (including attacker — sometimes attacker IS leader)
      // but NOT me (no self-target) and NOT the current target (no-op).
      const candidates = state.players.filter(p =>
        !p.isEliminated && p.id !== playerId && p.id !== attack.targetId
      );
      if (candidates.length === 0) return { play: false, newTargetId: -1 };
      candidates.sort((a, b) => threatScore(b) - threatScore(a));
      const newTarget = candidates[0];
      // Require a meaningful threat gap so we don't burn a card for marginal gain
      if (threatScore(newTarget) > threatScore(currentTarget) + 5) {
        return { play: true, newTargetId: newTarget.id };
      }
    }
    return { play: false, newTargetId: -1 };
  },

  shouldPlayWrongGoat(state, playerId, attack) {
    if (!hasCard(state, playerId, 'wrong_goat')) return false;
    // ANY player can play Wrong Goat. Attacker excluded for sanity.
    if (attack.attackerId === playerId) return false;

    const player = getPlayer(state, playerId);
    const isTarget = attack.targetId === playerId;
    const hitProb = hitChance(attack.attackCardId);

    if (isTarget) {
      if (player.hp === 1) return true;
      if (hitProb >= 0.4) return true;
      return false;
    }

    // Bystander Wrong Goat: shifts attack to most-cards player among
    // (alive \ {attacker, currentTarget}). Only worth playing if:
    //   (a) the new target isn't ME (no self-target via Wrong Goat)
    //   (b) the new target is the leader (or close to it)
    const candidates = state.players.filter(p =>
      !p.isEliminated && p.id !== attack.attackerId && p.id !== attack.targetId
    );
    if (candidates.length === 0) return false;
    const maxCards = Math.max(...candidates.map(p => p.hand.length));
    const newTarget = candidates.find(p => p.hand.length === maxCards);
    if (!newTarget || newTarget.id === playerId) return false;
    // Only play it from the sidelines if the auto-target is a serious threat
    if (hitProb >= 0.5) {
      const leader = findLeader(state, playerId);
      if (leader && newTarget.id === leader.id) return true;
    }
    return false;
  },

  shouldPlayAdrenaline(state, playerId, attack, diceResult) {
    if (!hasCard(state, playerId, 'adrenaline')) return false;
    if (!attack) return false;
    const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] ?? 4;
    const hit = diceResult >= threshold;

    if (attack.attackerId === playerId) {
      if (!hit) {
        const target = state.players.find(p => p.id === attack.targetId);
        if (target && target.hp === 1) return true;
      }
      return false;
    }
    if (attack.targetId === playerId) {
      const player = getPlayer(state, playerId);
      if (hit && player.hp === 1 && !player.hand.includes('insurance')) return true;
    }
    return false;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const others = aliveOthers(state, playerId);
    const cards: string[] = [];

    // PRIORITY 0: Free cards
    if (player.hand.includes('loot_the_corpse') &&
        state.players.some(p => p.isEliminated && p.hand.length > 0)) {
      cards.push('loot_the_corpse');
    }

    // PRIORITY 1: Defensive panic
    if (player.hp === 1 && player.hand.includes('silvertejp')) cards.push('silvertejp');
    if (player.hp === 1 && player.hand.includes('senile_grandma') &&
        !player.stationaryCards.some(s => s.cardId === 'senile_grandma')) {
      cards.push('senile_grandma');
    }

    // PRIORITY 2: Combo setup
    if (player.hand.includes('oppenheimer')) {
      const c4InOpponentHands = others.reduce(
        (sum, p) => sum + p.hand.filter(c => c === 'c4_goat').length, 0
      );
      if (c4InOpponentHands >= 1) cards.push('oppenheimer');
    }

    // PRIORITY 3: Resource gain
    if (player.hand.length <= 5 && player.hand.includes('polacken')) cards.push('polacken');
    if (player.hand.length <= 5 && player.hand.includes('begger') &&
        others.some(o => o.hand.length >= 2)) cards.push('begger');

    // PRIORITY 4: Disrupt leader
    const leader = findLeader(state, playerId);
    if (leader && player.hand.includes('steal') && leader.hand.length >= 4) cards.push('steal');
    if (player.hand.includes('haunted_barn')) {
      const candidate = others
        .filter(o => !o.stationaryCards.some(s => s.cardId === 'haunted_barn'))
        .sort((a, b) => a.hand.length - b.hand.length)[0];
      if (candidate && candidate.hand.length <= 4) cards.push('haunted_barn');
    }

    // PRIORITY 5: Desperate measures
    if (player.hp === 1 && player.hand.includes('identity_theft') &&
        others.some(o => o.hp === 2)) {
      cards.push('identity_theft');
    }
    if (player.hand.includes('moonshine_night')) {
      const target = others.find(o => o.hand.length >= player.hand.length + 4);
      if (target) cards.push('moonshine_night');
    }
    if (player.hand.includes('the_sacrifice')) {
      const losingBadly = leader && (
        leader.hp > player.hp ||
        (leader.hp === player.hp && leader.hand.length >= player.hand.length + 3)
      );
      if (player.hp === 1) cards.push('the_sacrifice');
      else if (player.hand.length >= 9) cards.push('the_sacrifice');
      else if (losingBadly && player.hand.length >= 5) cards.push('the_sacrifice');
    }

    // PRIORITY 6: Utility
    if (cards.length === 0 && player.hand.includes('skinny_dipping') && player.hand.length <= 6) {
      cards.push('skinny_dipping');
    }
    if (cards.length === 0 && player.hand.includes('blottaren')) cards.push('blottaren');

    // CUSTOM CARDS: play based on effect signature.
    //   heal → when wounded
    //   draw → when hand is small
    //   steal/discard → when opponents have hands worth disrupting
    //   catch-all → fall back to "play it" if not classified above
    for (const cardId of customsWithEffect(player.hand, 'heal')) {
      if (player.hp < 2) cards.push(cardId);
    }
    for (const cardId of customsWithEffect(player.hand, 'draw')) {
      if (player.hand.length <= 5) cards.push(cardId);
    }
    for (const cardId of customsWithEffect(player.hand, 'steal')) {
      if (others.some(o => o.hand.length >= 4)) cards.push(cardId);
    }
    for (const cardId of customsWithEffect(player.hand, 'discard')) {
      if (others.some(o => o.hand.length >= 3)) cards.push(cardId);
    }
    // Catch-all: play any unclassified custom specialty (e.g. self-only effects)
    for (const cardId of customSpecialtiesInHand(player.hand)) {
      if (!cards.includes(cardId)) cards.push(cardId);
    }

    // No artificial pacing cap — real players play as many specialty cards
    // as they need to.
    return [...new Set(cards)];
  },

  chooseTargetForCard(state, playerId, cardId) {
    const others = aliveOthers(state, playerId);
    if (others.length === 0) return -1;

    if (cardId === 'haunted_barn') {
      return others.reduce((a, b) => a.hand.length < b.hand.length ? a : b).id;
    }
    if (cardId === 'identity_theft') {
      return others.reduce((a, b) => a.hp > b.hp ? a : b).id;
    }
    if (cardId === 'moonshine_night' || cardId === 'steal') {
      return others.reduce((a, b) => a.hand.length > b.hand.length ? a : b).id;
    }
    if (cardId === 'loot_the_corpse') {
      const dead = state.players.filter(p => p.isEliminated && p.hand.length > 0);
      return dead.length > 0 ? dead[0].id : -1;
    }
    if (cardId === 'skinny_dipping' || cardId === 'blottaren') {
      const leader = findLeader(state, playerId);
      return leader ? leader.id : others[0].id;
    }
    const leader = findLeader(state, playerId);
    return leader ? leader.id : others[0].id;
  },

  chooseCardsToDiscard(state, playerId, count) {
    const hand = [...getPlayer(state, playerId).hand];
    const value: Record<string, number> = {
      god_mode: 100, insurance: 95, c4_goat: 80, senile_grandma: 75,
      silvertejp: 65, stop_it: 60, oppenheimer: 55, milking_cow: 52,
      redirect: 48, wrong_goat: 42, polacken: 38, adrenaline: 35,
      steal: 30, identity_theft: 25, begger: 22, the_sacrifice: 18,
      haunted_barn: 16, loot_the_corpse: 15, moonshine_night: 14,
      skinny_dipping: 10, blottaren: 8, unicorn: 6,
    };
    hand.sort((a, b) => (value[a] ?? 5) - (value[b] ?? 5));
    return hand.slice(0, count);
  },
};

// ═══════════════════════════════════════════════════════════════
// AGGRESSIVE (Smart — aggressiv stil)
// Same brain. Bias: attack more, use defensive cards freely, hunt kills.
// ═══════════════════════════════════════════════════════════════

const aggressive: StrategyFunctions = {
  ...expert,

  chooseAttackCard(state, playerId) {
    // Aggressive: always swings with the best attack available.
    const player = getPlayer(state, playerId);
    return bestAttackInHand(player.hand);
  },

  chooseAttackTarget(state, attackerId) {
    // Aggressive: kill-bias — pick the lowest-HP target, tiebreak by hand size.
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;
    others.sort((a, b) => {
      if (a.hp !== b.hp) return a.hp - b.hp;
      return b.hand.length - a.hand.length;
    });
    return others[0].id;
  },

  shouldPlayGodMode(state, playerId, threat) {
    // Aggressive uses God Mode more freely (doesn't hoard for emergencies).
    if (!hasCard(state, playerId, 'god_mode')) return false;
    const player = getPlayer(state, playerId);
    if (threat.targetId !== playerId) return false;

    const godModes = countCard(state, playerId, 'god_mode');
    const hitProb = hitChance(threat.attackCardId);

    if (player.hp === 1) return true; // always at 1 HP
    if (hitProb >= 0.5 && godModes >= 2) return true; // C4 / Milking Cow at 2 HP if spares
    return false;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect')) return { play: false, newTargetId: -1 };
    if (attack.attackerId === playerId) return { play: false, newTargetId: -1 };

    const player = getPlayer(state, playerId);
    const isTarget = attack.targetId === playerId;
    const hitProb = hitChance(attack.attackCardId);

    if (isTarget) {
      // Aggressive: redirect any meaningful threat, kill-shot the lowest HP target
      if (player.hp === 1 || hitProb >= 0.3) {
        const others = state.players.filter(p =>
          !p.isEliminated && p.id !== playerId && p.id !== attack.attackerId
        );
        if (others.length === 0) return { play: false, newTargetId: -1 };
        others.sort((a, b) => a.hp - b.hp);
        return { play: true, newTargetId: others[0].id };
      }
      return { play: false, newTargetId: -1 };
    }

    // Bystander aggressive — willing to redirect lower-threshold attacks
    // onto the lowest-HP enemy (set up a kill).
    if (hitProb >= 0.4) {
      const candidates = state.players.filter(p =>
        !p.isEliminated && p.id !== playerId && p.id !== attack.targetId
      );
      if (candidates.length === 0) return { play: false, newTargetId: -1 };
      candidates.sort((a, b) => a.hp - b.hp);
      const candidate = candidates[0];
      // Only worth it if the new target is at 1 HP (kill chance)
      if (candidate.hp === 1) {
        return { play: true, newTargetId: candidate.id };
      }
    }
    return { play: false, newTargetId: -1 };
  },

  shouldPlayWrongGoat(state, playerId, attack) {
    if (!hasCard(state, playerId, 'wrong_goat')) return false;
    if (attack.attackerId === playerId) return false;

    const player = getPlayer(state, playerId);
    const isTarget = attack.targetId === playerId;
    const hitProb = hitChance(attack.attackCardId);

    if (isTarget) {
      return hitProb >= 0.3 || player.hp === 1;
    }

    // Aggressive bystander — fire Wrong Goat if it shifts the attack onto
    // an enemy who isn't me and is killable
    const candidates = state.players.filter(p =>
      !p.isEliminated && p.id !== attack.attackerId && p.id !== attack.targetId
    );
    if (candidates.length === 0) return false;
    const maxCards = Math.max(...candidates.map(p => p.hand.length));
    const newTarget = candidates.find(p => p.hand.length === maxCards);
    if (!newTarget || newTarget.id === playerId) return false;
    return hitProb >= 0.4 && newTarget.hp <= 2;
  },

  shouldPlayAdrenaline(state, playerId, attack, diceResult) {
    if (!hasCard(state, playerId, 'adrenaline')) return false;
    if (!attack) return false;
    const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] ?? 4;
    const hit = diceResult >= threshold;

    if (attack.attackerId === playerId) {
      // Aggressive: reroll on miss against ANY target (not just 1 HP)
      if (!hit) return true;
      return false;
    }
    if (attack.targetId === playerId) {
      const player = getPlayer(state, playerId);
      // Reroll a hit at any HP if no insurance (or even at 2 HP — wants every advantage)
      if (hit && (player.hp === 1 || !player.hand.includes('insurance'))) return true;
    }
    return false;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const others = aliveOthers(state, playerId);
    const cards: string[] = [];

    // Always loot
    if (player.hand.includes('loot_the_corpse') &&
        state.players.some(p => p.isEliminated && p.hand.length > 0)) {
      cards.push('loot_the_corpse');
    }
    // Survival at 1 HP
    if (player.hp === 1 && player.hand.includes('silvertejp')) cards.push('silvertejp');
    if (player.hp === 1 && player.hand.includes('senile_grandma') &&
        !player.stationaryCards.some(s => s.cardId === 'senile_grandma')) {
      cards.push('senile_grandma');
    }

    // Aggressive bias: Oppenheimer almost always (don't wait for the perfect c4 count)
    if (player.hand.includes('oppenheimer')) cards.push('oppenheimer');

    // Resources at slightly higher hand sizes
    if (player.hand.length <= 6 && player.hand.includes('polacken')) cards.push('polacken');
    if (player.hand.length <= 6 && player.hand.includes('begger') &&
        others.some(o => o.hand.length >= 2)) cards.push('begger');

    // Steal at lower threshold
    const leader = findLeader(state, playerId);
    if (leader && player.hand.includes('steal') && leader.hand.length >= 3) cards.push('steal');

    if (player.hand.includes('haunted_barn')) {
      const candidate = others
        .filter(o => !o.stationaryCards.some(s => s.cardId === 'haunted_barn'))
        .sort((a, b) => a.hand.length - b.hand.length)[0];
      if (candidate && candidate.hand.length <= 5) cards.push('haunted_barn');
    }

    // Identity Theft / Moonshine — same as expert
    if (player.hp === 1 && player.hand.includes('identity_theft') &&
        others.some(o => o.hp === 2)) cards.push('identity_theft');
    if (player.hand.includes('moonshine_night')) {
      const target = others.find(o => o.hand.length >= player.hand.length + 3);
      if (target) cards.push('moonshine_night');
    }

    // Aggressive bias: The Sacrifice gambles more freely
    if (player.hand.includes('the_sacrifice')) {
      if (player.hp === 1) cards.push('the_sacrifice');
      else if (player.hand.length >= 7) cards.push('the_sacrifice');
      else if (leader && leader.hp >= player.hp && player.hand.length >= 4) {
        cards.push('the_sacrifice'); // catch-up gamble
      }
    }

    if (cards.length === 0 && player.hand.includes('skinny_dipping')) cards.push('skinny_dipping');
    if (cards.length === 0 && player.hand.includes('blottaren')) cards.push('blottaren');

    // Custom heal/draw — aggressive uses them eagerly
    for (const cardId of customsWithEffect(player.hand, 'heal')) {
      if (player.hp < 2) cards.push(cardId);
    }
    for (const cardId of customsWithEffect(player.hand, 'draw')) {
      if (player.hand.length <= 6) cards.push(cardId);
    }

    // No pacing cap — aggressive players especially won't hold back.
    return [...new Set(cards)];
  },
};

// ═══════════════════════════════════════════════════════════════
// DEFENSIVE (Smart — defensiv stil)
// Same brain. Bias: hoard defensive cards, attack only from safety.
// ═══════════════════════════════════════════════════════════════

const defensive: StrategyFunctions = {
  ...expert,

  chooseAttackCard(state, playerId) {
    const player = getPlayer(state, playerId);
    // Defensive: only attacks at FULL HP (2). Avoids drawing attention while wounded.
    if (player.hp < 2) return null;
    const best = bestAttackInHand(player.hand);
    if (!best) return null;
    // Defensive skips low-hit-chance attacks (e.g. Unicorn at 33%)
    if (hitChance(best) < 0.4) return null;
    return best;
  },

  chooseAttackTarget(state, attackerId) {
    // Defensive: disrupt the most-cards player (limit their threat), tiebreak by lowest HP
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;
    // Avoid attacking someone with Grandma (waste of attack)
    const viable = others.filter(o => !o.stationaryCards.some(s => s.cardId === 'senile_grandma'));
    const candidates = viable.length > 0 ? viable : others;
    candidates.sort((a, b) => {
      if (a.hand.length !== b.hand.length) return b.hand.length - a.hand.length;
      return a.hp - b.hp;
    });
    return candidates[0].id;
  },

  shouldPlayGodMode(state, playerId, threat) {
    if (!hasCard(state, playerId, 'god_mode')) return false;
    const player = getPlayer(state, playerId);
    if (threat.targetId !== playerId) return false;

    const godModes = countCard(state, playerId, 'god_mode');
    const hitProb = hitChance(threat.attackCardId);

    // Defensive: conserves God Mode aggressively
    if (player.hp === 1 && !player.hand.includes('insurance')) return true;
    if (player.hp === 1 && hitProb >= 0.5) return true;
    // At 2 HP: only nope C4 AND we must have ≥3 god_modes (very conservative)
    if (player.hp === 2 && threat.attackCardId === 'c4_goat' && godModes >= 3) return true;
    return false;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect')) return { play: false, newTargetId: -1 };
    if (attack.attackerId === playerId) return { play: false, newTargetId: -1 };

    const player = getPlayer(state, playerId);
    const isTarget = attack.targetId === playerId;
    const hitProb = hitChance(attack.attackCardId);

    if (isTarget) {
      // Defensive: tighter threshold (≥50%) to save Redirect for real threats
      if (player.hp === 1 || hitProb >= 0.5) {
        const others = state.players.filter(p =>
          !p.isEliminated && p.id !== playerId && p.id !== attack.attackerId
        );
        if (others.length === 0) return { play: false, newTargetId: -1 };
        others.sort((a, b) => threatScore(b) - threatScore(a));
        return { play: true, newTargetId: others[0].id };
      }
      return { play: false, newTargetId: -1 };
    }

    // Defensive almost never plays Redirect as a bystander — saves it for own
    // emergencies. Only exception: someone is one shot from killing the leader
    // and we'd benefit from accelerating it.
    return { play: false, newTargetId: -1 };
  },

  shouldPlayWrongGoat(state, playerId, attack) {
    if (!hasCard(state, playerId, 'wrong_goat')) return false;
    if (attack.attackerId === playerId) return false;

    const player = getPlayer(state, playerId);
    const isTarget = attack.targetId === playerId;
    if (isTarget) {
      if (player.hp === 1) return true;
      return hitChance(attack.attackCardId) >= 0.5;
    }
    // Defensive saves reactive cards — doesn't play Wrong Goat as bystander.
    return false;
  },

  shouldPlayAdrenaline(state, playerId, attack, diceResult) {
    if (!hasCard(state, playerId, 'adrenaline')) return false;
    if (!attack) return false;
    const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] ?? 4;
    const hit = diceResult >= threshold;

    // Defensive: only reroll to save own skin
    if (attack.targetId === playerId) {
      const player = getPlayer(state, playerId);
      if (hit && player.hp === 1 && !player.hand.includes('insurance')) return true;
    }
    return false;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const others = aliveOthers(state, playerId);
    const cards: string[] = [];

    // Always loot
    if (player.hand.includes('loot_the_corpse') &&
        state.players.some(p => p.isEliminated && p.hand.length > 0)) {
      cards.push('loot_the_corpse');
    }

    // DEFENSIVE BIAS: Place Grandma EARLY (even at 2 HP) if a leader has attack cards
    const leader = findLeader(state, playerId);
    if (player.hand.includes('senile_grandma') &&
        !player.stationaryCards.some(s => s.cardId === 'senile_grandma')) {
      const leaderHasAttack = leader && leader.hand.some(c => CARD_DATABASE[c]?.type === 'attack');
      if (player.hp === 1 || leaderHasAttack) cards.push('senile_grandma');
    }

    // Heal aggressively at 1 HP
    if (player.hp === 1 && player.hand.includes('silvertejp')) cards.push('silvertejp');

    // Resources (loves Polacken — more cards = more defence)
    if (player.hand.length <= 6 && player.hand.includes('polacken')) cards.push('polacken');
    if (player.hand.length <= 5 && player.hand.includes('begger') &&
        others.some(o => o.hand.length >= 2)) cards.push('begger');

    // Oppenheimer only if leader has many C4s
    if (player.hand.includes('oppenheimer')) {
      const c4InOpponentHands = others.reduce(
        (sum, p) => sum + p.hand.filter(c => c === 'c4_goat').length, 0
      );
      if (c4InOpponentHands >= 2) cards.push('oppenheimer');
    }

    // Steal only against a clearly-loaded leader
    if (leader && player.hand.includes('steal') && leader.hand.length >= 5) cards.push('steal');

    // Haunted Barn — wait for very small hand
    if (player.hand.includes('haunted_barn')) {
      const candidate = others
        .filter(o => !o.stationaryCards.some(s => s.cardId === 'haunted_barn'))
        .sort((a, b) => a.hand.length - b.hand.length)[0];
      if (candidate && candidate.hand.length <= 3) cards.push('haunted_barn');
    }

    // Defensive: only swap identity at 1 HP, only mix hands when really desperate
    if (player.hp === 1 && player.hand.includes('identity_theft') &&
        others.some(o => o.hp === 2)) cards.push('identity_theft');
    if (player.hand.includes('moonshine_night')) {
      const target = others.find(o => o.hand.length >= player.hand.length + 5);
      if (target) cards.push('moonshine_night');
    }

    // The Sacrifice ONLY at 1 HP — defensive never gambles when healthy
    if (player.hp === 1 && player.hand.includes('the_sacrifice')) cards.push('the_sacrifice');

    // Custom heal/draw — defensive uses heal even more eagerly, draw conservatively
    for (const cardId of customsWithEffect(player.hand, 'heal')) {
      if (player.hp < 2) cards.push(cardId);
    }
    for (const cardId of customsWithEffect(player.hand, 'draw')) {
      if (player.hand.length <= 5) cards.push(cardId);
    }

    // No utility filler — defensive holds cards until they matter.
    // No artificial cap — strategy gating already keeps defensive's plays low.
    return [...new Set(cards)];
  },
};

// ═══════════════════════════════════════════════════════════════
// NAIVE (random) — baseline control. Picks randomly with low awareness.
// ═══════════════════════════════════════════════════════════════

const randomStrategy: StrategyFunctions = {
  chooseAttackCard(state, playerId) {
    const hand = getPlayer(state, playerId).hand;
    const attacks = hand.filter(c => CARD_DATABASE[c]?.type === 'attack');
    if (attacks.length === 0 || Math.random() < 0.5) return null;
    return attacks[Math.floor(Math.random() * attacks.length)];
  },

  chooseAttackTarget(state, attackerId) {
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;
    return others[Math.floor(Math.random() * others.length)].id;
  },

  shouldPlayGodMode(state, playerId) {
    return hasCard(state, playerId, 'god_mode') && Math.random() < 0.5;
  },

  shouldPlayStopIt(state, playerId) {
    return hasCard(state, playerId, 'stop_it') && Math.random() < 0.3;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect') || Math.random() < 0.5) {
      return { play: false, newTargetId: -1 };
    }
    const others = aliveOthers(state, playerId).filter(p => p.id !== attack.attackerId);
    if (others.length === 0) return { play: false, newTargetId: -1 };
    return { play: true, newTargetId: others[Math.floor(Math.random() * others.length)].id };
  },

  shouldPlayWrongGoat(state, playerId) {
    return hasCard(state, playerId, 'wrong_goat') && Math.random() < 0.5;
  },

  shouldPlayAdrenaline(state, playerId) {
    return hasCard(state, playerId, 'adrenaline') && Math.random() < 0.5;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const ownTurnCards = player.hand.filter(c => {
      const def = CARD_DATABASE[c];
      return def && def.timing === 'own_turn' && def.type !== 'attack';
    });
    return ownTurnCards.filter(() => Math.random() < 0.6);
  },

  chooseTargetForCard(state, playerId) {
    const others = aliveOthers(state, playerId);
    if (others.length === 0) return -1;
    return others[Math.floor(Math.random() * others.length)].id;
  },

  chooseCardsToDiscard(state, playerId, count) {
    const hand = [...getPlayer(state, playerId).hand];
    for (let i = hand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hand[i], hand[j]] = [hand[j], hand[i]];
    }
    return hand.slice(0, count);
  },
};

// ─── STRATEGY MAP ───────────────────────────────────────────

const STRATEGIES: Record<Strategy, StrategyFunctions> = {
  expert,
  aggressive,
  defensive,
  random: randomStrategy,
};

/** Get strategy functions for a given strategy type */
export function getStrategy(strategy: Strategy): StrategyFunctions {
  return STRATEGIES[strategy];
}
