import { GameState, PlayerState, GameEvent, StationarySlot } from './types';
import { ATTACK_HIT_THRESHOLD, spinWheel, WheelSegment } from './cardDatabase';

// ─── HELPERS ────────────────────────────────────────────────

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function removeCardFromHand(player: PlayerState, cardId: string): PlayerState {
  const idx = player.hand.indexOf(cardId);
  if (idx === -1) return player;
  const hand = [...player.hand];
  hand.splice(idx, 1);
  return { ...player, hand };
}

function updatePlayer(state: GameState, playerId: number, updates: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map(p => p.id === playerId ? { ...p, ...updates } : p),
  };
}

function addEvent(state: GameState, event: Omit<GameEvent, 'turn'>): GameState {
  return {
    ...state,
    events: [...state.events, { ...event, turn: state.turnNumber } as GameEvent],
  };
}

function drawCards(state: GameState, playerId: number, count: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const drawn: string[] = [];
  let deck = [...state.deck];
  let discardPile = [...state.discardPile];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discardPile.length === 0) break;
      deck = shuffleArray(discardPile);
      discardPile = [];
    }
    drawn.push(deck.shift()!);
  }

  return {
    ...state,
    deck,
    discardPile,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, hand: [...p.hand, ...drawn] } : p
    ),
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter(p => !p.isEliminated);
}

function checkWinCondition(state: GameState): GameState {
  const alive = alivePlayers(state);
  if (alive.length === 1) {
    return {
      ...state,
      isOver: true,
      winnerId: alive[0].id,
    };
  }
  if (alive.length === 0) {
    return {
      ...state,
      isOver: true,
      isDraw: true,
    };
  }
  return state;
}

// ─── DAMAGE (CENTRAL) ───────────────────────────────────────

/** Apply damage to a target — handles Senile Grandma absorption and Insurance */
export function applyDamage(state: GameState, targetId: number, amount: number, isNuke = false): GameState {
  const target = state.players.find(p => p.id === targetId)!;
  if (target.isEliminated) return state;

  // Check Senile Grandma
  const grandmaIdx = target.stationaryCards.findIndex(s => s.cardId === 'senile_grandma');
  if (grandmaIdx !== -1 && !isNuke) {
    const newStationary = [...target.stationaryCards];
    newStationary.splice(grandmaIdx, 1);
    state = updatePlayer(state, targetId, { stationaryCards: newStationary });
    state = addEvent(state, { type: 'card_played', actorId: targetId, cardId: 'senile_grandma', detail: 'Grandma absorbed damage' });
    return state;
  }

  const newHp = target.hp - amount;
  state = updatePlayer(state, targetId, {
    hp: Math.max(0, newHp),
    damageReceived: target.damageReceived + amount,
  });
  state = addEvent(state, { type: 'player_damaged', actorId: targetId, targetId, detail: `Took ${amount} damage` });

  if (newHp <= 0) {
    const updatedTarget = state.players.find(p => p.id === targetId)!;
    // Check Insurance (not for nuke)
    if (!isNuke && updatedTarget.hand.includes('insurance') && !updatedTarget.hasUsedInsurance) {
      state = updatePlayer(state, targetId, {
        hp: 2,
        hasUsedInsurance: true,
        hand: removeCardFromHand(updatedTarget, 'insurance').hand,
      });
      state = addEvent(state, { type: 'insurance_triggered', actorId: targetId });
    } else {
      // Eliminate player
      state = updatePlayer(state, targetId, {
        isEliminated: true,
        hp: 0,
        stationaryCards: [],
      });
      state = addEvent(state, { type: 'player_eliminated', actorId: targetId });
      state = checkWinCondition(state);
    }
  }

  return state;
}

// ─── ATTACK EFFECTS ─────────────────────────────────────────

/** Resolve an attack card's dice roll and apply damage if it hits */
export function applyAttackDamage(state: GameState, attackerId: number, targetId: number, attackCardId: string, diceRoll: number): GameState {
  const threshold = ATTACK_HIT_THRESHOLD[attackCardId];
  if (!threshold) return state;

  if (diceRoll >= threshold) {
    state = addEvent(state, { type: 'attack_hit', actorId: attackerId, targetId, cardId: attackCardId, diceRoll });
    const attacker = state.players.find(p => p.id === attackerId)!;
    state = updatePlayer(state, attackerId, { damageDealt: attacker.damageDealt + 1 });
    state = applyDamage(state, targetId, 1);
  } else {
    state = addEvent(state, { type: 'attack_missed', actorId: attackerId, targetId, cardId: attackCardId, diceRoll });
  }
  return state;
}

// ─── GOD MODE ───────────────────────────────────────────────

/** Nope an attack or specialty card effect */
export function applyGodMode(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'god_mode').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });
  state = addEvent(state, { type: 'attack_noped', actorId: playerId, cardId: 'god_mode' });
  return state;
}

// ─── STOP IT ────────────────────────────────────────────────

/** End the current player's turn immediately (skip to draw card).
 *  stopTargetId = the player whose turn is being stopped. */
export function applyStopIt(state: GameState, playerId: number, stopTargetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'stop_it').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });
  // actorId = player who played Stop It; targetId = player whose turn ends
  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId: stopTargetId, cardId: 'stop_it' });
  return { ...state, phase: 'draw_card', pendingAttack: null };
}

// ─── WRONG GOAT ─────────────────────────────────────────────

/** Redirect attack to the player with the most cards (excl. attacker and current target) */
export function applyWrongGoat(state: GameState, playerId: number, attackerId: number, currentTargetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'wrong_goat').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });

  const candidates = alivePlayers(state).filter(p => p.id !== attackerId && p.id !== currentTargetId);
  if (candidates.length === 0) return state;

  const maxCards = Math.max(...candidates.map(p => p.hand.length));
  const tied = candidates.filter(p => p.hand.length === maxCards);
  const newTarget = tied.reduce((a, b) => a.id < b.id ? a : b);

  state = addEvent(state, { type: 'attack_redirected', actorId: playerId, cardId: 'wrong_goat', targetId: newTarget.id });

  if (state.pendingAttack) {
    state = {
      ...state,
      pendingAttack: {
        ...state.pendingAttack,
        targetId: newTarget.id,
        chainHistory: [...state.pendingAttack.chainHistory, {
          type: 'wrong_goat', playerId, cardId: 'wrong_goat', newTargetId: newTarget.id,
        }],
      },
    };
  }
  return state;
}

// ─── REDIRECT ───────────────────────────────────────────────

/** Redirect attack to a new target */
export function applyRedirect(state: GameState, playerId: number, newTargetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'redirect').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });

  state = addEvent(state, { type: 'attack_redirected', actorId: playerId, cardId: 'redirect', targetId: newTargetId });

  if (state.pendingAttack) {
    state = {
      ...state,
      pendingAttack: {
        ...state.pendingAttack,
        targetId: newTargetId,
        chainHistory: [...state.pendingAttack.chainHistory, {
          type: 'redirect', playerId, cardId: 'redirect', newTargetId,
        }],
      },
    };
  }
  return state;
}

// ─── ADRENALINE ─────────────────────────────────────────────

/** Play adrenaline to reroll a dice */
export function applyAdrenaline(state: GameState, playerId: number): { state: GameState; newRoll: number } {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'adrenaline').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });
  const newRoll = rollDice();
  state = addEvent(state, { type: 'card_played', actorId: playerId, cardId: 'adrenaline', diceRoll: newRoll });
  return { state, newRoll };
}

// ─── IDENTITY THEFT ─────────────────────────────────────────

/** Swap HP and stationary cards between two players */
export function applyIdentityTheft(state: GameState, playerId: number, targetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const target = state.players.find(p => p.id === targetId)!;

  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'identity_theft').hand,
    cardsPlayed: player.cardsPlayed + 1,
    hp: target.hp,
    stationaryCards: target.stationaryCards,
  });
  state = updatePlayer(state, targetId, {
    hp: player.hp,
    stationaryCards: player.stationaryCards,
  });

  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId, cardId: 'identity_theft' });
  return state;
}

// ─── BLOTTAREN ──────────────────────────────────────────────

/** Expose target's hand (in simulation: logged for strategy reference) */
export function applyBlottaren(state: GameState, playerId: number, targetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'blottaren').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });
  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId, cardId: 'blottaren' });
  return state;
}

// ─── SKINNY DIPPING ─────────────────────────────────────────

/** Dice duel — winner draws 2 cards */
export function applySkinnyDipping(state: GameState, playerId: number, targetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'skinny_dipping').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });

  let playerRoll = rollDice();
  let targetRoll = rollDice();
  while (playerRoll === targetRoll) {
    playerRoll = rollDice();
    targetRoll = rollDice();
  }

  const winnerId = playerRoll > targetRoll ? playerId : targetId;
  state = drawCards(state, winnerId, 2);
  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId, cardId: 'skinny_dipping', detail: `Player ${winnerId} won the duel` });
  return state;
}

// ─── THE SACRIFICE ──────────────────────────────────────────

/** Spin the Dirty Devil wheel and apply the result */
export function applyTheSacrifice(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'the_sacrifice').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });

  const segment = spinWheel();
  state = addEvent(state, { type: 'sacrifice_wheel_spun', actorId: playerId, detail: segment });

  const alive = alivePlayers(state);
  const playerIdx = alive.findIndex(p => p.id === playerId);

  switch (segment) {
    case 'draw_3':
      state = drawCards(state, playerId, 3);
      break;

    case 'right_discard_2': {
      const rightPlayer = alive[(playerIdx + 1) % alive.length];
      if (rightPlayer && rightPlayer.id !== playerId) {
        const toDiscard = rightPlayer.hand.slice(0, Math.min(2, rightPlayer.hand.length));
        state = updatePlayer(state, rightPlayer.id, {
          hand: rightPlayer.hand.filter((_, i) => i >= toDiscard.length),
        });
        state = { ...state, discardPile: [...state.discardPile, ...toDiscard] };
      }
      break;
    }

    case 'left_discard_2': {
      const leftPlayer = alive[(playerIdx - 1 + alive.length) % alive.length];
      if (leftPlayer && leftPlayer.id !== playerId) {
        const toDiscard = leftPlayer.hand.slice(0, Math.min(2, leftPlayer.hand.length));
        state = updatePlayer(state, leftPlayer.id, {
          hand: leftPlayer.hand.filter((_, i) => i >= toDiscard.length),
        });
        state = { ...state, discardPile: [...state.discardPile, ...toDiscard] };
      }
      break;
    }

    case 'steal_2': {
      const others = alive.filter(p => p.id !== playerId && p.hand.length > 0);
      if (others.length > 0) {
        const victim = others[Math.floor(Math.random() * others.length)];
        const shuffledHand = shuffleArray(victim.hand);
        const stolen = shuffledHand.slice(0, Math.min(2, shuffledHand.length));
        const remainingHand = victim.hand.filter(c => !stolen.includes(c));
        // Handle duplicates carefully
        const remaining = [...victim.hand];
        for (const s of stolen) {
          const idx = remaining.indexOf(s);
          if (idx !== -1) remaining.splice(idx, 1);
        }
        state = updatePlayer(state, victim.id, { hand: remaining });
        const p = state.players.find(pp => pp.id === playerId)!;
        state = updatePlayer(state, playerId, { hand: [...p.hand, ...stolen] });
      }
      break;
    }

    case 'discard_2_self': {
      const p = state.players.find(pp => pp.id === playerId)!;
      const toDiscard = p.hand.slice(0, Math.min(2, p.hand.length));
      state = updatePlayer(state, playerId, {
        hand: p.hand.filter((_, i) => i >= toDiscard.length),
      });
      state = { ...state, discardPile: [...state.discardPile, ...toDiscard] };
      break;
    }

    case 'swap_hand': {
      const others = alive.filter(p => p.id !== playerId);
      if (others.length > 0) {
        const target = others[Math.floor(Math.random() * others.length)];
        const pHand = state.players.find(pp => pp.id === playerId)!.hand;
        const tHand = target.hand;
        state = updatePlayer(state, playerId, { hand: [...tHand] });
        state = updatePlayer(state, target.id, { hand: [...pHand] });
      }
      break;
    }

    case 'you_die':
      state = applyDamage(state, playerId, 1);
      break;

    case 'give_take_1': {
      const others = alive.filter(p => p.id !== playerId && p.hand.length > 0);
      if (others.length > 0) {
        const target = others[Math.floor(Math.random() * others.length)];
        const p = state.players.find(pp => pp.id === playerId)!;
        // Give 1 card
        if (p.hand.length > 0) {
          const giveCard = p.hand[0];
          state = updatePlayer(state, playerId, { hand: p.hand.slice(1) });
          const t = state.players.find(pp => pp.id === target.id)!;
          state = updatePlayer(state, target.id, { hand: [...t.hand, giveCard] });
        }
        // Take 1 random card
        const updatedTarget = state.players.find(pp => pp.id === target.id)!;
        if (updatedTarget.hand.length > 0) {
          const takeIdx = Math.floor(Math.random() * updatedTarget.hand.length);
          const takeCard = updatedTarget.hand[takeIdx];
          const newTargetHand = [...updatedTarget.hand];
          newTargetHand.splice(takeIdx, 1);
          state = updatePlayer(state, target.id, { hand: newTargetHand });
          const updatedPlayer = state.players.find(pp => pp.id === playerId)!;
          state = updatePlayer(state, playerId, { hand: [...updatedPlayer.hand, takeCard] });
        }
      }
      break;
    }

    case 'nuke': {
      // ALL players die — including the one who played The Sacrifice.
      // Insurance does NOT work against nuke. Always results in a draw.
      for (const p of alive) {
        state = applyDamage(state, p.id, 99, true);
        if (state.isOver) break;
      }
      break;
    }
  }

  return state;
}

// ─── OPPENHEIMER ────────────────────────────────────────────

/** Steal all C4-Goat cards from other players */
export function applyOppenheimer(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'oppenheimer').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });

  const stolenCards: string[] = [];
  for (const other of alivePlayers(state)) {
    if (other.id === playerId) continue;
    const c4Count = other.hand.filter(c => c === 'c4_goat').length;
    if (c4Count > 0) {
      const newHand = other.hand.filter(c => c !== 'c4_goat');
      state = updatePlayer(state, other.id, { hand: newHand });
      for (let i = 0; i < c4Count; i++) stolenCards.push('c4_goat');
    }
  }

  const updatedPlayer = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, { hand: [...updatedPlayer.hand, ...stolenCards] });
  state = addEvent(state, { type: 'card_played', actorId: playerId, cardId: 'oppenheimer', detail: `Stole ${stolenCards.length} C4-Goats` });
  return state;
}

// ─── BEGGER ─────────────────────────────────────────────────

/** Each other player gives 1 card to the begger */
export function applyBegger(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'begger').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });

  const received: string[] = [];
  for (const other of alivePlayers(state)) {
    if (other.id === playerId || other.hand.length === 0) continue;
    // Each player gives a random card (they choose any card from their hand)
    const giveIdx = Math.floor(Math.random() * other.hand.length);
    const giveCard = other.hand[giveIdx];
    const newHand = [...other.hand];
    newHand.splice(giveIdx, 1);
    state = updatePlayer(state, other.id, { hand: newHand });
    received.push(giveCard);
  }

  const updatedPlayer = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, { hand: [...updatedPlayer.hand, ...received] });
  state = addEvent(state, { type: 'card_played', actorId: playerId, cardId: 'begger', detail: `Received ${received.length} cards` });
  return state;
}

// ─── STEAL ──────────────────────────────────────────────────

/** Take 2 random cards from a target */
export function applySteal(state: GameState, playerId: number, targetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const target = state.players.find(p => p.id === targetId)!;

  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'steal').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });

  const shuffledHand = shuffleArray(target.hand);
  const stolen = shuffledHand.slice(0, Math.min(2, shuffledHand.length));
  const remaining = [...target.hand];
  for (const s of stolen) {
    const idx = remaining.indexOf(s);
    if (idx !== -1) remaining.splice(idx, 1);
  }

  state = updatePlayer(state, targetId, { hand: remaining });
  const updatedPlayer = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, { hand: [...updatedPlayer.hand, ...stolen] });
  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId, cardId: 'steal' });
  return state;
}

// ─── SILVERTEJP ─────────────────────────────────────────────

/** Heal to 2 HP if currently at 1 HP */
export function applySilvertejp(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  if (player.hp >= 2) return state;

  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'silvertejp').hand,
    cardsPlayed: player.cardsPlayed + 1,
    hp: 2,
  });
  state = addEvent(state, { type: 'card_played', actorId: playerId, cardId: 'silvertejp' });
  return state;
}

// ─── MOONSHINE NIGHT ────────────────────────────────────────

/** Swap entire hand with a target */
export function applyMoonshineNight(state: GameState, playerId: number, targetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const target = state.players.find(p => p.id === targetId)!;

  const playerHand = removeCardFromHand(player, 'moonshine_night').hand;
  const targetHand = [...target.hand];

  state = updatePlayer(state, playerId, {
    hand: targetHand,
    cardsPlayed: player.cardsPlayed + 1,
  });
  state = updatePlayer(state, targetId, { hand: playerHand });
  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId, cardId: 'moonshine_night' });
  return state;
}

// ─── LOOT THE CORPSE ────────────────────────────────────────

/** Take all cards from an eliminated player */
export function applyLootTheCorpse(state: GameState, playerId: number, deadPlayerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const dead = state.players.find(p => p.id === deadPlayerId)!;

  state = updatePlayer(state, playerId, {
    hand: [...removeCardFromHand(player, 'loot_the_corpse').hand, ...dead.hand],
    cardsPlayed: player.cardsPlayed + 1,
  });
  state = updatePlayer(state, deadPlayerId, { hand: [] });
  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId: deadPlayerId, cardId: 'loot_the_corpse' });
  return state;
}

// ─── POLACKEN ───────────────────────────────────────────────

/** Draw 3 cards from the deck */
export function applyPolacken(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'polacken').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });
  state = drawCards(state, playerId, 3);
  state = addEvent(state, { type: 'card_played', actorId: playerId, cardId: 'polacken' });
  return state;
}

// ─── MAD COW ────────────────────────────────────────────────

/** Triggered when drawn — odd dice = 1 damage, even = safe */
export function applyMadCow(state: GameState, playerId: number): GameState {
  const diceRoll = rollDice();
  state = addEvent(state, { type: 'mad_cow_triggered', actorId: playerId, diceRoll });

  if (diceRoll % 2 !== 0) {
    state = applyDamage(state, playerId, 1);
  }
  return state;
}

// ─── SENILE GRANDMA ─────────────────────────────────────────

/** Place Grandma as a stationary card on your farm */
export function applySenileGrandma(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  if (player.stationaryCards.some(s => s.cardId === 'senile_grandma')) return state;

  const newSlot: StationarySlot = { cardId: 'senile_grandma', ownerId: playerId };
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'senile_grandma').hand,
    cardsPlayed: player.cardsPlayed + 1,
    stationaryCards: [...player.stationaryCards, newSlot],
  });
  state = addEvent(state, { type: 'card_played', actorId: playerId, cardId: 'senile_grandma' });
  return state;
}

// ─── HAUNTED BARN ───────────────────────────────────────────

/** Place Haunted Barn on another player's farm */
export function applyHauntedBarn(state: GameState, playerId: number, targetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const target = state.players.find(p => p.id === targetId)!;
  if (target.stationaryCards.some(s => s.cardId === 'haunted_barn')) return state;

  const newSlot: StationarySlot = { cardId: 'haunted_barn', ownerId: playerId };
  state = updatePlayer(state, playerId, {
    hand: removeCardFromHand(player, 'haunted_barn').hand,
    cardsPlayed: player.cardsPlayed + 1,
  });
  state = updatePlayer(state, targetId, {
    stationaryCards: [...target.stationaryCards, newSlot],
  });
  state = addEvent(state, { type: 'card_played', actorId: playerId, targetId, cardId: 'haunted_barn' });
  return state;
}

// ─── HAUNTED BARN TRIGGER ───────────────────────────────────

/** Check and trigger Haunted Barn at end of turn */
export function checkHauntedBarnTrigger(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  if (player.isEliminated) return state;

  const barnIdx = player.stationaryCards.findIndex(s => s.cardId === 'haunted_barn');
  if (barnIdx !== -1 && player.hand.length < 2) {
    const newStationary = [...player.stationaryCards];
    newStationary.splice(barnIdx, 1);
    state = updatePlayer(state, playerId, { stationaryCards: newStationary });
    state = addEvent(state, { type: 'haunted_barn_triggered', actorId: playerId });
    state = applyDamage(state, playerId, 1);
  }
  return state;
}
