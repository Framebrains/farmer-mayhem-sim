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

// ─── STRATEGY MAP ───────────────────────────────────────────

const STRATEGIES: Record<Strategy, StrategyFunctions> = {
  aggressive,
  defensive,
  balanced,
  random: randomStrategy,
};

/** Get strategy functions for a given strategy type */
export function getStrategy(strategy: Strategy): StrategyFunctions {
  return STRATEGIES[strategy];
}
