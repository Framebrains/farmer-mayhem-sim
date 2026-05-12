import { GameState, PendingAttack, Strategy, PlayerState } from './types';
import { CARD_DATABASE, ATTACK_HIT_THRESHOLD } from './cardDatabase';

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

// ─── AGGRESSIVE ─────────────────────────────────────────────

const aggressive: StrategyFunctions = {
  chooseAttackCard(state, playerId) {
    const hand = getPlayer(state, playerId).hand;
    if (hand.includes('c4_goat')) return 'c4_goat';
    if (hand.includes('milking_cow')) return 'milking_cow';
    if (hand.includes('unicorn')) return 'unicorn';
    return null;
  },

  chooseAttackTarget(state, attackerId) {
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;
    // Target player with lowest HP, then most cards
    others.sort((a, b) => {
      if (a.hp !== b.hp) return a.hp - b.hp;
      return b.hand.length - a.hand.length;
    });
    return others[0].id;
  },

  shouldPlayGodMode(state, playerId, threat) {
    if (!hasCard(state, playerId, 'god_mode')) return false;
    return threat.targetId === playerId;
  },

  shouldPlayStopIt(state, playerId, targetTurnPlayerId) {
    if (!hasCard(state, playerId, 'stop_it')) return false;
    const others = aliveOthers(state, playerId);
    if (others.length === 0) return false;
    const leader = others.reduce((a, b) => a.hand.length > b.hand.length ? a : b);
    return targetTurnPlayerId === leader.id;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect')) return { play: false, newTargetId: -1 };
    if (attack.targetId !== playerId) return { play: false, newTargetId: -1 };
    const others = aliveOthers(state, playerId).filter(p => p.id !== attack.attackerId);
    if (others.length === 0) return { play: false, newTargetId: -1 };
    others.sort((a, b) => a.hp - b.hp);
    return { play: true, newTargetId: others[0].id };
  },

  shouldPlayWrongGoat(state, playerId, attack) {
    if (!hasCard(state, playerId, 'wrong_goat')) return false;
    return attack.targetId === playerId;
  },

  shouldPlayAdrenaline(state, playerId, attack, diceResult) {
    if (!hasCard(state, playerId, 'adrenaline')) return false;
    if (!attack) return false;
    // If we're the attacker and missed, reroll
    if (attack.attackerId === playerId) {
      const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] || 4;
      return diceResult < threshold;
    }
    return false;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const others = aliveOthers(state, playerId);
    const cards: string[] = [];

    if (player.hand.includes('oppenheimer')) cards.push('oppenheimer');
    if (player.hand.includes('polacken')) cards.push('polacken');
    if (player.hand.includes('begger')) cards.push('begger');
    if (player.hand.includes('steal')) cards.push('steal');
    if (player.hand.includes('blottaren')) cards.push('blottaren');
    if (player.hand.includes('skinny_dipping')) cards.push('skinny_dipping');
    if (player.hand.includes('the_sacrifice')) cards.push('the_sacrifice');
    if (player.hand.includes('haunted_barn')) cards.push('haunted_barn');
    if (player.hand.includes('identity_theft') && others.some(o => o.hp > player.hp)) cards.push('identity_theft');
    if (player.hand.includes('moonshine_night') && others.some(o => o.hand.length >= player.hand.length + 3)) cards.push('moonshine_night');
    if (player.hand.includes('loot_the_corpse') && state.players.some(p => p.isEliminated && p.hand.length > 0)) cards.push('loot_the_corpse');
    if (player.hand.includes('senile_grandma') && !player.stationaryCards.some(s => s.cardId === 'senile_grandma') && (player.hp <= 1 || player.hand.length > 6)) {
      cards.push('senile_grandma');
    }
    if (player.hp <= 1 && player.hand.includes('silvertejp')) cards.push('silvertejp');

    return [...new Set(cards)];
  },

  chooseTargetForCard(state, playerId, cardId) {
    const others = aliveOthers(state, playerId);
    if (others.length === 0) return -1;

    if (cardId === 'steal') {
      return others.reduce((a, b) => a.hand.length > b.hand.length ? a : b).id;
    }
    if (cardId === 'haunted_barn') {
      return others.reduce((a, b) => a.hand.length < b.hand.length ? a : b).id;
    }
    if (cardId === 'identity_theft') {
      return others.reduce((a, b) => a.hp > b.hp ? a : b).id;
    }
    if (cardId === 'loot_the_corpse') {
      const dead = state.players.filter(p => p.isEliminated && p.hand.length > 0);
      return dead.length > 0 ? dead[0].id : -1;
    }
    if (cardId === 'moonshine_night') {
      return others.reduce((a, b) => a.hand.length > b.hand.length ? a : b).id;
    }
    // Default: target weakest
    return others.reduce((a, b) => a.hp < b.hp ? a : b).id;
  },

  chooseCardsToDiscard(state, playerId, count) {
    const hand = [...getPlayer(state, playerId).hand];
    // Keep attack cards and god_mode/insurance, discard least valuable
    const priority = ['insurance', 'god_mode', 'c4_goat', 'milking_cow', 'stop_it', 'redirect', 'adrenaline'];
    hand.sort((a, b) => {
      const aP = priority.indexOf(a);
      const bP = priority.indexOf(b);
      return (bP === -1 ? -1 : bP) - (aP === -1 ? -1 : aP);
    });
    return hand.slice(0, count);
  },
};

// ─── DEFENSIVE ──────────────────────────────────────────────

const defensive: StrategyFunctions = {
  chooseAttackCard(state, playerId) {
    const player = getPlayer(state, playerId);
    if (player.hp < 2) return null;
    if (player.hand.includes('c4_goat')) return 'c4_goat';
    if (player.hand.includes('milking_cow')) return 'milking_cow';
    return null;
  },

  chooseAttackTarget(state, attackerId) {
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;
    // Target biggest threat (most cards = potential attacks)
    others.sort((a, b) => b.hand.length - a.hand.length);
    return others[0].id;
  },

  shouldPlayGodMode(state, playerId, threat) {
    if (!hasCard(state, playerId, 'god_mode')) return false;
    return threat.targetId === playerId;
  },

  shouldPlayStopIt(state, playerId, targetTurnPlayerId) {
    if (!hasCard(state, playerId, 'stop_it')) return false;
    const player = getPlayer(state, playerId);
    return player.hp < 2;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect')) return { play: false, newTargetId: -1 };
    if (attack.targetId !== playerId) return { play: false, newTargetId: -1 };
    const player = getPlayer(state, playerId);
    if (player.hp >= 2) return { play: false, newTargetId: -1 };
    const others = aliveOthers(state, playerId).filter(p => p.id !== attack.attackerId);
    if (others.length === 0) return { play: false, newTargetId: -1 };
    others.sort((a, b) => b.hand.length - a.hand.length);
    return { play: true, newTargetId: others[0].id };
  },

  shouldPlayWrongGoat(state, playerId, attack) {
    if (!hasCard(state, playerId, 'wrong_goat')) return false;
    return attack.targetId === playerId;
  },

  shouldPlayAdrenaline(state, playerId, attack, diceResult) {
    if (!hasCard(state, playerId, 'adrenaline')) return false;
    if (!attack) return false;
    // Only if we're the target and the attack hit
    if (attack.targetId === playerId) {
      const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] || 4;
      return diceResult >= threshold;
    }
    return false;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const others = aliveOthers(state, playerId);
    const cards: string[] = [];

    if (player.hand.includes('polacken')) cards.push('polacken');
    if (player.hand.includes('senile_grandma') && !player.stationaryCards.some(s => s.cardId === 'senile_grandma')) {
      cards.push('senile_grandma');
    }
    if (player.hp <= 1 && player.hand.includes('silvertejp')) cards.push('silvertejp');
    if (player.hand.includes('haunted_barn')) cards.push('haunted_barn');
    if (player.hand.includes('begger')) cards.push('begger');
    if (player.hand.includes('steal')) cards.push('steal');
    if (player.hand.includes('loot_the_corpse') && state.players.some(p => p.isEliminated && p.hand.length > 0)) cards.push('loot_the_corpse');
    if (player.hand.includes('blottaren')) cards.push('blottaren');
    if (player.hand.includes('skinny_dipping')) cards.push('skinny_dipping');
    if (player.hp === 2 && player.hand.includes('the_sacrifice')) cards.push('the_sacrifice');
    if (player.hp === 1 && player.hand.includes('identity_theft') && others.some(o => o.hp === 2)) cards.push('identity_theft');
    if (player.hand.includes('moonshine_night') && others.some(o => o.hand.length >= player.hand.length + 4)) cards.push('moonshine_night');

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
    if (cardId === 'steal') {
      return others.reduce((a, b) => a.hand.length > b.hand.length ? a : b).id;
    }
    if (cardId === 'loot_the_corpse') {
      const dead = state.players.filter(p => p.isEliminated && p.hand.length > 0);
      return dead.length > 0 ? dead[0].id : -1;
    }
    return others[0].id;
  },

  chooseCardsToDiscard(state, playerId, count) {
    const hand = [...getPlayer(state, playerId).hand];
    // Never discard god_mode or insurance
    const keep = ['god_mode', 'insurance', 'stop_it', 'redirect', 'senile_grandma', 'silvertejp'];
    const discardable = hand.filter(c => !keep.includes(c));
    if (discardable.length >= count) return discardable.slice(0, count);
    return hand.slice(0, count);
  },
};

// ─── BALANCED ───────────────────────────────────────────────

const balanced: StrategyFunctions = {
  chooseAttackCard(state, playerId) {
    const player = getPlayer(state, playerId);
    if (player.hp < 1) return null;
    if (player.hand.includes('c4_goat')) return 'c4_goat';
    if (player.hand.includes('milking_cow')) return 'milking_cow';
    return null;
  },

  chooseAttackTarget(state, attackerId) {
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;
    // Target the "leader" — score = HP * 2 + hand.length / 3
    others.sort((a, b) => {
      const scoreA = a.hp * 2 + a.hand.length / 3;
      const scoreB = b.hp * 2 + b.hand.length / 3;
      return scoreB - scoreA;
    });
    return others[0].id;
  },

  shouldPlayGodMode(state, playerId, threat) {
    if (!hasCard(state, playerId, 'god_mode')) return false;
    if (threat.targetId !== playerId) return false;
    const player = getPlayer(state, playerId);
    if (player.hp <= 1) return true;
    // 50% chance otherwise (use deterministic check based on turn number)
    return state.turnNumber % 2 === 0;
  },

  shouldPlayStopIt(state, playerId, targetTurnPlayerId) {
    if (!hasCard(state, playerId, 'stop_it')) return false;
    const player = getPlayer(state, playerId);
    if (player.hp <= 1) return true;
    return false;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect')) return { play: false, newTargetId: -1 };
    if (attack.targetId !== playerId) return { play: false, newTargetId: -1 };
    const others = aliveOthers(state, playerId).filter(p => p.id !== attack.attackerId);
    if (others.length === 0) return { play: false, newTargetId: -1 };
    // Redirect to player with highest score
    others.sort((a, b) => (b.hp * 2 + b.hand.length / 3) - (a.hp * 2 + a.hand.length / 3));
    return { play: true, newTargetId: others[0].id };
  },

  shouldPlayWrongGoat(state, playerId, attack) {
    if (!hasCard(state, playerId, 'wrong_goat')) return false;
    return attack.targetId === playerId;
  },

  shouldPlayAdrenaline(state, playerId, attack, diceResult) {
    if (!hasCard(state, playerId, 'adrenaline')) return false;
    if (!attack) return false;
    if (attack.attackerId === playerId) {
      const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] || 4;
      return diceResult < threshold;
    }
    if (attack.targetId === playerId) {
      const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] || 4;
      return diceResult >= threshold;
    }
    return false;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const cards: string[] = [];

    if (player.hand.includes('oppenheimer')) cards.push('oppenheimer');
    if (player.hp <= 1 && player.hand.includes('senile_grandma') && !player.stationaryCards.some(s => s.cardId === 'senile_grandma')) {
      cards.push('senile_grandma');
    }
    if (player.hand.length > 6 && player.hand.includes('senile_grandma') && !player.stationaryCards.some(s => s.cardId === 'senile_grandma')) {
      cards.push('senile_grandma');
    }
    if (player.hp <= 1 && player.hand.includes('silvertejp')) cards.push('silvertejp');
    if (player.hand.includes('polacken')) cards.push('polacken');
    if (player.hand.includes('steal')) cards.push('steal');
    if (player.hand.includes('haunted_barn')) cards.push('haunted_barn');
    if (player.hand.includes('begger')) cards.push('begger');

    // Keep hand under 8 cards
    if (player.hand.length > 8) {
      if (player.hand.includes('skinny_dipping')) cards.push('skinny_dipping');
      if (player.hand.includes('the_sacrifice')) cards.push('the_sacrifice');
    }

    return [...new Set(cards)];
  },

  chooseTargetForCard(state, playerId, cardId) {
    const others = aliveOthers(state, playerId);
    if (others.length === 0) return -1;

    // Target the leader
    const leader = others.reduce((a, b) => {
      const scoreA = a.hp * 2 + a.hand.length / 3;
      const scoreB = b.hp * 2 + b.hand.length / 3;
      return scoreA > scoreB ? a : b;
    });

    if (cardId === 'haunted_barn') {
      return others.reduce((a, b) => a.hand.length < b.hand.length ? a : b).id;
    }
    if (cardId === 'loot_the_corpse') {
      const dead = state.players.filter(p => p.isEliminated && p.hand.length > 0);
      return dead.length > 0 ? dead[0].id : -1;
    }
    return leader.id;
  },

  chooseCardsToDiscard(state, playerId, count) {
    const hand = [...getPlayer(state, playerId).hand];
    const keep = ['insurance', 'god_mode', 'c4_goat'];
    const discardable = hand.filter(c => !keep.includes(c));
    if (discardable.length >= count) return discardable.slice(0, count);
    return hand.slice(0, count);
  },
};

// ─── RANDOM ─────────────────────────────────────────────────

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
    return hasCard(state, playerId, 'stop_it') && Math.random() < 0.5;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect') || Math.random() < 0.5) return { play: false, newTargetId: -1 };
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
    // Shuffle and take first N
    for (let i = hand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hand[i], hand[j]] = [hand[j], hand[i]];
    }
    return hand.slice(0, count);
  },
};

// ─── EXPERT ─────────────────────────────────────────────────
//
// Plays like a thoughtful human with full information. Key principles:
//   • Threat assessment   – attack the LEADER, not the weakest
//   • Resource pacing     – max 2 specialty cards per turn (unless hand bloated)
//   • Combo awareness     – Oppenheimer BEFORE C4 attacks
//   • Defensive economy   – God Mode only on likely-lethal threats
//   • Endgame instinct    – aggressive once only 2 players remain
//
// Helper: composite threat score for a player.
//   HP weighs heaviest (×10) because surviving = winning.
//   Hand size matters (more options = more threat).
//   Attack cards in hand are scored extra.
//   Stationary defenders (Grandma) make a player LESS attractive to attack.

function threatScore(p: PlayerState): number {
  let s = p.hp * 10 + p.hand.length * 0.5;
  const attacks = p.hand.filter(c => CARD_DATABASE[c]?.type === 'attack').length;
  s += attacks * 2;
  if (p.stationaryCards.some(x => x.cardId === 'senile_grandma')) s -= 8;
  if (p.hand.includes('insurance') && !p.hasUsedInsurance) s += 3; // harder to kill = more dangerous
  return s;
}

function findLeader(state: GameState, excludeId: number): PlayerState | null {
  const others = state.players.filter(p => !p.isEliminated && p.id !== excludeId);
  if (others.length === 0) return null;
  return others.reduce((a, b) => threatScore(a) > threatScore(b) ? a : b);
}

function hitChance(cardId: string): number {
  const threshold = ATTACK_HIT_THRESHOLD[cardId];
  if (!threshold) return 0;
  return (7 - threshold) / 6; // p(roll >= threshold)
}

const expert: StrategyFunctions = {
  chooseAttackCard(state, playerId) {
    const player = getPlayer(state, playerId);
    if (player.hand.length === 0) return null;

    // Endgame: with one opponent left, attack hard with anything
    const alive = alivePlayers(state).length;
    if (alive === 2) {
      if (player.hand.includes('c4_goat')) return 'c4_goat';
      if (player.hand.includes('milking_cow')) return 'milking_cow';
      if (player.hand.includes('unicorn')) return 'unicorn';
      return null;
    }

    // At 1 HP with no protection, lay low (don't reveal yourself)
    if (player.hp === 1) {
      const hasProtection =
        player.hand.includes('god_mode') || player.hand.includes('insurance');
      if (!hasProtection) return null;
    }

    // Prefer highest-hit chance
    if (player.hand.includes('c4_goat')) return 'c4_goat';
    if (player.hand.includes('milking_cow')) return 'milking_cow';
    // Unicorn is risky — only use when it would matter (target at 1 HP)
    if (player.hand.includes('unicorn')) {
      const others = aliveOthers(state, playerId);
      if (others.some(o => o.hp === 1)) return 'unicorn';
    }
    return null;
  },

  chooseAttackTarget(state, attackerId) {
    const others = aliveOthers(state, attackerId);
    if (others.length === 0) return -1;

    // Always attack the highest-threat player.
    // Tiebreaker: prefer 1 HP over 2 HP (killing blow opportunity)
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

    // Only react if we're the target (avoid wasting on others unless we have spares)
    if (!isTarget) {
      // Use spare god_mode if a powerful redirect chain is hitting us indirectly
      return false;
    }

    const hitProb = hitChance(threat.attackCardId);

    // ALWAYS nope if at 1 HP AND no insurance (would die)
    if (player.hp === 1 && !player.hand.includes('insurance')) return true;

    // At 1 HP with insurance: only nope if likely hit (save insurance for later threats)
    if (player.hp === 1 && hitProb >= 0.5 && godModes >= 1) return true;

    // At 2 HP: only nope C4 (the only attack with 66% hit chance)
    // AND only if we have ≥2 god_mode (don't burn your last one)
    if (player.hp === 2 && threat.attackCardId === 'c4_goat' && godModes >= 2) {
      return true;
    }

    return false;
  },

  shouldPlayStopIt(state, playerId, targetTurnPlayerId) {
    if (!hasCard(state, playerId, 'stop_it')) return false;

    const player = getPlayer(state, playerId);
    const target = getPlayer(state, targetTurnPlayerId);
    const leader = findLeader(state, playerId);

    // Only stop the LEADER (don't waste on weak players)
    if (!leader || leader.id !== target.id) return false;

    // Stop if leader has Oppenheimer (massive board disruption)
    if (target.hand.includes('oppenheimer')) return true;

    // Stop if I'm at 1 HP AND leader has an attack ready
    const leaderHasAttack = target.hand.some(c => CARD_DATABASE[c]?.type === 'attack');
    if (player.hp === 1 && leaderHasAttack && !player.hand.includes('god_mode')) {
      return true;
    }

    // Endgame: stop the opponent every turn
    if (alivePlayers(state).length === 2 && leaderHasAttack) return true;

    return false;
  },

  shouldRedirect(state, playerId, attack) {
    if (!hasCard(state, playerId, 'redirect')) return { play: false, newTargetId: -1 };
    if (attack.targetId !== playerId) return { play: false, newTargetId: -1 };

    const player = getPlayer(state, playerId);
    const hitProb = hitChance(attack.attackCardId);

    // Don't waste Redirect at 2 HP against a low-chance attack (Unicorn)
    if (player.hp === 2 && hitProb < 0.4) return { play: false, newTargetId: -1 };

    // Save Redirect if I have God Mode and the attack is weak
    if (player.hp === 2 && hitProb < 0.55 && player.hand.includes('god_mode')) {
      return { play: false, newTargetId: -1 };
    }

    // Redirect to the leader (excluding attacker)
    const others = aliveOthers(state, playerId).filter(p => p.id !== attack.attackerId);
    if (others.length === 0) return { play: false, newTargetId: -1 };
    others.sort((a, b) => threatScore(b) - threatScore(a));
    return { play: true, newTargetId: others[0].id };
  },

  shouldPlayWrongGoat(state, playerId, attack) {
    if (!hasCard(state, playerId, 'wrong_goat')) return false;
    if (attack.targetId !== playerId) return false;

    const player = getPlayer(state, playerId);
    const hitProb = hitChance(attack.attackCardId);

    // Always defend at 1 HP
    if (player.hp === 1) return true;

    // At 2 HP: only against high-hit-chance attacks (C4)
    if (hitProb >= 0.6) return true;

    return false;
  },

  shouldPlayAdrenaline(state, playerId, attack, diceResult) {
    if (!hasCard(state, playerId, 'adrenaline')) return false;
    if (!attack) return false;

    const threshold = ATTACK_HIT_THRESHOLD[attack.attackCardId] ?? 4;
    const hit = diceResult >= threshold;

    if (attack.attackerId === playerId) {
      // Reroll on miss only if killing blow available (target at 1 HP)
      if (!hit) {
        const target = state.players.find(p => p.id === attack.targetId);
        if (target && target.hp === 1) return true;
      }
      return false;
    }

    if (attack.targetId === playerId) {
      const player = getPlayer(state, playerId);
      // Reroll only if hit AND at 1 HP AND no insurance to fall back on
      if (hit && player.hp === 1 && !player.hand.includes('insurance')) return true;
    }

    return false;
  },

  chooseSpecialtyCardsThisTurn(state, playerId) {
    const player = getPlayer(state, playerId);
    const others = aliveOthers(state, playerId);
    const cards: string[] = [];

    // ── PRIORITY 1: Defensive / setup cards ──

    // Silvertejp at 1 HP (heal first, before risking attack)
    if (player.hp === 1 && player.hand.includes('silvertejp')) {
      cards.push('silvertejp');
    }

    // Senile Grandma at 1 HP (absorb next attack)
    if (player.hp === 1 && player.hand.includes('senile_grandma') &&
        !player.stationaryCards.some(s => s.cardId === 'senile_grandma')) {
      cards.push('senile_grandma');
    }

    // ── PRIORITY 2: Combo setup ──

    // Oppenheimer BEFORE attacks (combo). Only if opponents actually have C4.
    if (player.hand.includes('oppenheimer')) {
      const c4InOpponentHands = others.reduce(
        (sum, p) => sum + p.hand.filter(c => c === 'c4_goat').length, 0
      );
      if (c4InOpponentHands >= 1) cards.push('oppenheimer');
    }

    // ── PRIORITY 3: Resource gain (hand-management) ──

    // Polacken when hand is small
    if (player.hand.length <= 5 && player.hand.includes('polacken')) {
      cards.push('polacken');
    }

    // Begger when hand is small AND opponents have hands to give
    if (player.hand.length <= 5 && player.hand.includes('begger') &&
        others.some(o => o.hand.length >= 2)) {
      cards.push('begger');
    }

    // Loot the Corpse — free cards
    if (player.hand.includes('loot_the_corpse') &&
        state.players.some(p => p.isEliminated && p.hand.length > 0)) {
      cards.push('loot_the_corpse');
    }

    // ── PRIORITY 4: Disrupt leader ──

    const leader = findLeader(state, playerId);

    // Steal against leader if their hand is big
    if (leader && player.hand.includes('steal') && leader.hand.length >= 4) {
      cards.push('steal');
    }

    // Haunted Barn on opponent with smallest hand (most likely to trigger)
    if (player.hand.includes('haunted_barn')) {
      const candidate = others
        .filter(o => !o.stationaryCards.some(s => s.cardId === 'haunted_barn'))
        .sort((a, b) => a.hand.length - b.hand.length)[0];
      if (candidate && candidate.hand.length <= 4) cards.push('haunted_barn');
    }

    // ── PRIORITY 5: Desperate measures ──

    // Identity Theft at 1 HP if opponent has 2 HP
    if (player.hp === 1 && player.hand.includes('identity_theft') &&
        others.some(o => o.hp === 2)) {
      cards.push('identity_theft');
    }

    // Moonshine if opponent's hand is significantly bigger
    if (player.hand.includes('moonshine_night')) {
      const target = others.find(o => o.hand.length >= player.hand.length + 4);
      if (target) cards.push('moonshine_night');
    }

    // The Sacrifice ONLY when desperate (1 HP) or hand bloated (≥9)
    if (player.hand.includes('the_sacrifice') &&
        (player.hp === 1 || player.hand.length >= 9)) {
      cards.push('the_sacrifice');
    }

    // ── PRIORITY 6: Utility (if nothing else to do) ──

    if (cards.length === 0 && player.hand.includes('skinny_dipping') &&
        player.hand.length <= 6) {
      cards.push('skinny_dipping');
    }

    // Blottaren is information-only — low priority
    if (cards.length === 0 && player.hand.includes('blottaren')) {
      cards.push('blottaren');
    }

    // ── PACING ── Cap at 2 specialty cards per turn unless hand is bloated.
    const unique = [...new Set(cards)];
    if (player.hand.length < 9) return unique.slice(0, 2);
    return unique;
  },

  chooseTargetForCard(state, playerId, cardId) {
    const others = aliveOthers(state, playerId);
    if (others.length === 0) return -1;

    if (cardId === 'haunted_barn') {
      // Smallest hand = most likely to trigger
      return others.reduce((a, b) => a.hand.length < b.hand.length ? a : b).id;
    }
    if (cardId === 'identity_theft') {
      // Highest HP = best to swap with when we're at 1
      return others.reduce((a, b) => a.hp > b.hp ? a : b).id;
    }
    if (cardId === 'moonshine_night' || cardId === 'steal') {
      // Biggest hand
      return others.reduce((a, b) => a.hand.length > b.hand.length ? a : b).id;
    }
    if (cardId === 'loot_the_corpse') {
      const dead = state.players.filter(p => p.isEliminated && p.hand.length > 0);
      return dead.length > 0 ? dead[0].id : -1;
    }
    if (cardId === 'skinny_dipping' || cardId === 'blottaren') {
      // Target leader (most info / best matchup)
      const leader = findLeader(state, playerId);
      return leader ? leader.id : others[0].id;
    }

    // Default: leader
    const leader = findLeader(state, playerId);
    return leader ? leader.id : others[0].id;
  },

  chooseCardsToDiscard(state, playerId, count) {
    const hand = [...getPlayer(state, playerId).hand];
    // Value ranking (higher = keep)
    const value: Record<string, number> = {
      god_mode: 100, insurance: 95, c4_goat: 80, silvertejp: 70,
      stop_it: 65, milking_cow: 55, redirect: 50, wrong_goat: 45,
      adrenaline: 40, oppenheimer: 38, senile_grandma: 36,
      polacken: 30, steal: 28, identity_theft: 25, the_sacrifice: 22,
      begger: 20, moonshine_night: 18, loot_the_corpse: 15,
      haunted_barn: 12, skinny_dipping: 10, blottaren: 8, unicorn: 6,
    };
    hand.sort((a, b) => (value[a] ?? 5) - (value[b] ?? 5));
    return hand.slice(0, count);
  },
};

// ─── STRATEGY MAP ───────────────────────────────────────────

const STRATEGIES: Record<Strategy, StrategyFunctions> = {
  aggressive,
  defensive,
  balanced,
  random: randomStrategy,
  expert,
};

/** Get strategy functions for a given strategy type */
export function getStrategy(strategy: Strategy): StrategyFunctions {
  return STRATEGIES[strategy];
}
