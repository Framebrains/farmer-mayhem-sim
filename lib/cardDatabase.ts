import { CardDefinition } from './types';

/**
 * Complete card database for Farmer Mayhem.
 *
 * NOTE: This is a `let` (not `const`) so custom user-defined cards can be
 * merged in at runtime via mergeCustomCards(). Existing code that reads
 * CARD_DATABASE will see both built-in and custom cards seamlessly.
 */
export const CARD_DATABASE: Record<string, CardDefinition> = {
  // ─── ATTACK ──────────────────────────────────────────────
  c4_goat: {
    id: 'c4_goat', name: 'C4-Goat', type: 'attack',
    timing: 'own_turn', count: 18, canBeNopedByGodMode: true,
    description: 'Attack. Slå tärningen — träff på 3+ (66% chans). Träff = 1 HP skada till valt mål. Kan nopa:s av God Mode.',
  },
  milking_cow: {
    id: 'milking_cow', name: 'Milking Cow', type: 'attack',
    timing: 'own_turn', count: 12, canBeNopedByGodMode: true,
    description: 'Attack. Slå tärningen — träff på 4+ (50% chans). Träff = 1 HP skada. Kan nopa:s av God Mode.',
  },
  unicorn: {
    id: 'unicorn', name: 'Unicorn', type: 'attack',
    timing: 'own_turn', count: 7, canBeNopedByGodMode: true,
    description: 'Attack. Slå tärningen — träff på 5+ (33% chans). Träff = 1 HP skada. Lekens svagaste attack.',
  },

  // ─── REAKTIVA SPECIALKORT (kan spelas när som helst) ─────
  god_mode: {
    id: 'god_mode', name: 'God Mode', type: 'specialty',
    timing: 'any_time', count: 6, canBeNopedByGodMode: true,
    description: 'Reaktivt. Annullerar en attack eller redirect helt. Kan motnope:as av nytt God Mode — reaktionskedjan har ingen fast gräns.',
  },
  stop_it: {
    id: 'stop_it', name: 'Stop It', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: false,
    description: 'Reaktivt. Avbryter motspelarens hela tur. Måste spelas INNAN tärningen kastats. Kan INTE nopa:s av God Mode.',
  },
  wrong_goat: {
    id: 'wrong_goat', name: 'Wrong Goat', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: true,
    description: 'Reaktivt (bara om du är mål). Omdirigerar attacken till spelaren med FLEST kort på handen (exkl. angriparen).',
  },
  redirect: {
    id: 'redirect', name: 'Re-direct', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: true,
    description: 'Reaktivt (bara om du är mål). Omdirigerar attacken till en valfri annan spelare.',
  },
  adrenaline: {
    id: 'adrenaline', name: 'Adrenaline', type: 'specialty',
    timing: 'any_time', count: 3, canBeNopedByGodMode: true,
    description: 'Reaktivt. Efter att tärningen kastats — tvingar fram en omkastning. Endast EN omkastning per attack.',
  },

  // ─── SPECIALKORT PÅ EGEN TUR ─────────────────────────────
  identity_theft: {
    id: 'identity_theft', name: 'Identity Theft', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true,
    description: 'Byter HP och stationära kort (Grandma, Haunted Barn) med vald motspelare. Handkorten påverkas inte.',
  },
  blottaren: {
    id: 'blottaren', name: 'Blottaren', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true,
    description: 'Avslöjar en vald motspelares hand (du får se vad de har). Ingen annan mekanisk effekt.',
  },
  skinny_dipping: {
    id: 'skinny_dipping', name: 'Skinny Dipping', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true,
    description: 'Tärningsduel mot vald motspelare. Båda slår tills olika värden. Vinnaren drar 2 kort.',
  },
  the_sacrifice: {
    id: 'the_sacrifice', name: 'The Sacrifice', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: false,
    description: 'Snurra Dirty Devil-hjulet. 8 vanliga utfall (~11.5% var) + 1% Nuke (alla dör → oavgjort). Kan INTE nopa:s.',
  },
  oppenheimer: {
    id: 'oppenheimer', name: 'Oppenheimer', type: 'specialty',
    timing: 'own_turn', count: 1, canBeNopedByGodMode: true,
    description: 'Stjäl ALLA C4-Goat-kort från alla motspelares händer. Lekens enda Oppenheimer.',
  },
  begger: {
    id: 'begger', name: 'Begger', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true,
    description: 'Varje motspelare ger dig 1 kort. De väljer själva (i simuleringen ger de sitt sämsta kort).',
  },
  steal: {
    id: 'steal', name: 'Steal', type: 'specialty',
    timing: 'own_turn', count: 4, canBeNopedByGodMode: true,
    description: 'Stjäl 2 slumpmässiga kort från vald motspelare (du ser bara baksidan).',
  },
  silvertejp: {
    id: 'silvertejp', name: 'Silvertejp', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: false,
    description: 'Återställ till 2 HP. Spelas bara om du är på 1 HP. Kan INTE nopa:s.',
  },
  moonshine_night: {
    id: 'moonshine_night', name: 'Moonshine Night', type: 'specialty',
    timing: 'own_turn', count: 1, canBeNopedByGodMode: true,
    description: 'Byt hela din hand med en valfri motspelares hand. Motspelaren kan inte neka. Lekens enda Moonshine Night.',
  },
  loot_the_corpse: {
    id: 'loot_the_corpse', name: 'Loot the Corpse', type: 'specialty',
    timing: 'own_turn', count: 1, canBeNopedByGodMode: true,
    description: 'Ta ALLA kort från en eliminerad spelares hand. Bara om någon redan är ute med kort kvar.',
  },
  polacken: {
    id: 'polacken', name: 'Polacken', type: 'specialty',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: true,
    description: 'Dra 3 nya kort från leken. (Mad Cow triggrar direkt om du drar den.)',
  },

  // ─── AUTOMATISKA KORT ───────────────────────────────────
  insurance: {
    id: 'insurance', name: 'Insurance', type: 'specialty',
    timing: 'automatic', count: 2, canBeNopedByGodMode: false,
    description: 'Auto-triggar vid dödlig skada. Återställer dig till 2 HP. Funkar INTE mot Nuke. Endast EN gång per spel.',
  },

  // ─── TRAP-KORT ──────────────────────────────────────────
  mad_cow: {
    id: 'mad_cow', name: 'Mad Cow', type: 'trap',
    timing: 'trap', count: 3, canBeNopedByGodMode: false,
    description: 'Trapp / huskort. Triggar DIREKT när den dras — slå tärning, ojämnt (1/3/5) = 1 HP skada. Hamnar aldrig i handen.',
  },

  // ─── STATIONARY CARDS ────────────────────────────────────
  senile_grandma: {
    id: 'senile_grandma', name: 'Senile Grandma', type: 'stationary',
    timing: 'own_turn', count: 5, canBeNopedByGodMode: false,
    description: 'Stationär — placeras på din egen gård. Absorberar nästa attack helt (du tar 0 skada). Försvinner efter användning.',
  },
  haunted_barn: {
    id: 'haunted_barn', name: 'Haunted Barn', type: 'stationary',
    timing: 'own_turn', count: 3, canBeNopedByGodMode: false,
    description: 'Stationär — placeras på motspelares gård. I slutet av deras tur: om de har <2 kort → 1 HP skada. Försvinner efter trigger.',
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

/**
 * Attack-card hit thresholds (built-in). For CUSTOM attack cards the
 * threshold is read from CARD_DATABASE[id].hitThreshold instead.
 *
 * Helper hitThresholdFor() respects both.
 */
export const ATTACK_HIT_THRESHOLD: Record<string, number> = {
  c4_goat: 3,
  milking_cow: 4,
  unicorn: 5,
};

/** Look up the hit threshold for any attack card (built-in or custom). */
export function hitThresholdFor(cardId: string): number | null {
  const built = ATTACK_HIT_THRESHOLD[cardId];
  if (built) return built;
  const def = CARD_DATABASE[cardId];
  if (def?.template === 'attack' && def.hitThreshold) return def.hitThreshold;
  return null;
}

/** Look up the damage value for any attack card (built-in = 1, custom can vary). */
export function damageFor(cardId: string): number {
  const def = CARD_DATABASE[cardId];
  if (def?.template === 'attack' && def.damage) return def.damage;
  return 1;
}

// ─── CUSTOM CARDS ─────────────────────────────────────────
//
// User-defined cards stored in localStorage. mergeCustomCards() is called
// once at app startup (client-side) so the rest of the codebase can keep
// reading CARD_DATABASE directly without caring whether a card is built-in
// or user-created.

const CUSTOM_CARDS_KEY = 'farmer_custom_cards';

export function loadCustomCards(): Record<string, CardDefinition> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_CARDS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, CardDefinition>;
  } catch {
    /* ignore */
  }
  return {};
}

export function saveCustomCards(cards: Record<string, CardDefinition>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(cards));
  } catch {
    /* ignore */
  }
}

/** Merge a custom card into CARD_DATABASE. Idempotent. */
export function registerCustomCard(card: CardDefinition) {
  CARD_DATABASE[card.id] = { ...card, isCustom: true };
}

/** Remove a custom card by id (only allowed for cards marked isCustom). */
export function unregisterCustomCard(id: string) {
  const def = CARD_DATABASE[id];
  if (def?.isCustom) delete CARD_DATABASE[id];
}

/** Hydrate all custom cards from localStorage into CARD_DATABASE. */
export function mergeCustomCards() {
  const custom = loadCustomCards();
  for (const id of Object.keys(custom)) {
    registerCustomCard(custom[id]);
  }
}

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
