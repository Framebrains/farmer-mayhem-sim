import { CardDefinition } from './types';

/** Complete card database for Farmer Mayhem — all 96 cards */
export const CARD_DATABASE: Record<string, CardDefinition> = {
  // ─── ATTACK ──────────────────────────────────────────────
  c4_goat: {
    id: 'c4_goat', name: 'C4-Goat', type: 'attack',
    timing: 'own_turn', count: 18, canBeNopedByGodMode: true
  },
  milking_cow: {
    id: 'milking_cow', name: 'Milking Cow', type: 'attack',
    timing: 'own_turn', count: 12, canBeNopedByGodMode: true
  },
  unicorn: {
    id: 'unicorn', name: 'Unicorn', type: 'attack',
    timing: 'own_turn', count: 7, canBeNopedByGodMode: true
  },

  // ─── REAKTIVA SPECIALKORT (kan spelas när som helst) ─────
  god_mode: {
    id: 'god_mode', name: 'God Mode', type: 'specialty',
    timing: 'any_time', count: 6, canBeNopedByGodMode: true
  },
  stop_it: {
    id: 'stop_it', name: 'Stop It', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: false
  },
  wrong_goat: {
    id: 'wrong_goat', name: 'Wrong Goat', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: true
  },
  redirect: {
    id: 'redirect', name: 'Re-direct', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: true
  },
  adrenaline: {
    id: 'adrenaline', name: 'Adrenaline', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: true
  },

  // ─── SPECIALKORT PÅ EGEN TUR ─────────────────────────────
  identity_theft: {
    id: 'identity_theft', name: 'Identity Theft', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true
  },
  blottaren: {
    id: 'blottaren', name: 'Blottaren', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true
  },
  skinny_dipping: {
    id: 'skinny_dipping', name: 'Skinny Dipping', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true
  },
  the_sacrifice: {
    id: 'the_sacrifice', name: 'The Sacrifice', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: false
  },
  oppenheimer: {
    id: 'oppenheimer', name: 'Oppenheimer', type: 'specialty',
    timing: 'own_turn', count: 1, canBeNopedByGodMode: true
  },
  begger: {
    id: 'begger', name: 'Begger', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true
  },
  steal: {
    id: 'steal', name: 'Steal', type: 'specialty',
    timing: 'own_turn', count: 4, canBeNopedByGodMode: true
  },
  silvertejp: {
    id: 'silvertejp', name: 'Silvertejp', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: false
  },
  moonshine_night: {
    id: 'moonshine_night', name: 'Moonshine Night', type: 'specialty',
    timing: 'own_turn', count: 1, canBeNopedByGodMode: true
  },
  loot_the_corpse: {
    id: 'loot_the_corpse', name: 'Loot the Corpse', type: 'specialty',
    timing: 'own_turn', count: 1, canBeNopedByGodMode: true
  },
  polacken: {
    id: 'polacken', name: 'Polacken', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true
  },

  // ─── AUTOMATISKA KORT ───────────────────────────────────
  insurance: {
    id: 'insurance', name: 'Insurance', type: 'specialty',
    timing: 'automatic', count: 2, canBeNopedByGodMode: false
  },

  // ─── TRAP-KORT ──────────────────────────────────────────
  mad_cow: {
    id: 'mad_cow', name: 'Mad Cow', type: 'trap',
    timing: 'trap', count: 3, canBeNopedByGodMode: false
  },

  // ─── STATIONARY CARDS ────────────────────────────────────
  senile_grandma: {
    id: 'senile_grandma', name: 'Senile Grandma', type: 'stationary',
    timing: 'own_turn', count: 5, canBeNopedByGodMode: false
  },
  haunted_barn: {
    id: 'haunted_barn', name: 'Haunted Barn', type: 'stationary',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: false
  },
};

/** Build the main deck (excludes trap cards — those are shuffled in after dealing) */
export function buildDeck(overrides: Record<string, number> = {}): string[] {
  const deck: string[] = [];
  for (const [id, card] of Object.entries(CARD_DATABASE)) {
    if (card.type === 'trap') continue;
    const count = overrides[id] ?? card.count;
    for (let i = 0; i < count; i++) deck.push(id);
  }
  return deck;
}

/** Build the trap card pool to shuffle in after dealing hands */
export function buildTrapCards(overrides: Record<string, number> = {}): string[] {
  const traps: string[] = [];
  for (const [id, card] of Object.entries(CARD_DATABASE)) {
    if (card.type !== 'trap') continue;
    const count = overrides[id] ?? card.count;
    for (let i = 0; i < count; i++) traps.push(id);
  }
  return traps;
}

/** Attack cards hit threshold — roll must be >= threshold to hit */
export const ATTACK_HIT_THRESHOLD: Record<string, number> = {
  c4_goat: 3,
  milking_cow: 4,
  unicorn: 5,
};

/** Dirty Devil wheel segments */
export type WheelSegment =
  | 'draw_3'
  | 'right_discard_2'
  | 'left_discard_2'
  | 'steal_2'
  | 'discard_2_self'
  | 'swap_hand'
  | 'you_die'
  | 'give_take_1'
  | 'nuke';

export const WHEEL_WEIGHTS: Record<WheelSegment, number> = {
  draw_3: 11.5,
  right_discard_2: 11.5,
  left_discard_2: 11.5,
  steal_2: 11.5,
  discard_2_self: 11.5,
  swap_hand: 11.5,
  you_die: 11.5,
  give_take_1: 11.5,
  nuke: 1.0,
};

/** Spin the wheel using weighted random */
export function spinWheel(): WheelSegment {
  const segments = Object.keys(WHEEL_WEIGHTS) as WheelSegment[];
  const totalWeight = Object.values(WHEEL_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  for (const seg of segments) {
    roll -= WHEEL_WEIGHTS[seg];
    if (roll <= 0) return seg;
  }
  return segments[segments.length - 1];
}
