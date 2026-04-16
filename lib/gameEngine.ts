import { GameState, PlayerState, SimConfig, PendingAttack } from './types';
import { buildDeck, buildTrapCards, CARD_DATABASE, ATTACK_HIT_THRESHOLD } from './cardDatabase';
import { getStrategy } from './playerStrategies';
import {
  applyAttackDamage, applyGodMode, applyStopIt, applyWrongGoat, applyRedirect,
  applyAdrenaline, applyIdentityTheft, applyBlottaren, applySkinnyDipping,
  applyTheSacrifice, applyOppenheimer, applyBegger, applySteal, applySilvertejp,
  applyMoonshineNight, applyLootTheCorpse, applyPolacken, applyMadCow,
  applySenileGrandma, applyHauntedBarn, checkHauntedBarnTrigger, applyDamage,
} from './cardEffects';

const MAX_TURNS = 200;
const CARDS_PER_PLAYER = 7;

// ─── SHUFFLE ────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ─── INIT GAME ──────────────────────────────────────────────

/** Initialize a new game state from config */
export function initGame(config: SimConfig): GameState {
  let deck = shuffleArray(buildDeck(config.deckConfig.overrides));
  const trapCards = buildTrapCards(config.deckConfig.overrides);

  const players: PlayerState[] = [];

  for (let i = 0; i < config.playerCount; i++) {
    const hand: string[] = [];

    // Deal 7 cards, replacing any Mad Cow draws
    for (let c = 0; c < CARDS_PER_PLAYER; c++) {
      if (deck.length === 0) break;
      let card = deck.shift()!;
      // Mad Cow shouldn't be in the main deck before trap insertion, but safety check
      while (card === 'mad_cow' && deck.length > 0) {
        deck.push(card);
        deck = shuffleArray(deck);
        card = deck.shift()!;
      }
      hand.push(card);
    }

    players.push({
      id: i,
      hp: 2,
      hand,
      stationaryCards: [],
      strategy: config.strategies[i] || 'balanced',
      isEliminated: false,
      hasUsedInsurance: false,
      turnsPlayed: 0,
      cardsPlayed: 0,
      damageDealt: 0,
      damageReceived: 0,
    });
  }

  // Shuffle trap cards into remaining deck
  deck = shuffleArray([...deck, ...trapCards]);

  return {
    players,
    deck,
    discardPile: [],
    currentPlayerIndex: 0,
    turnNumber: 0,
    phase: 'play_cards',
    pendingAttack: null,
    isOver: false,
    winnerId: null,
    isDraw: false,
    events: [],
  };
}

// ─── HELPERS ────────────────────────────────────────────────

function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter(p => !p.isEliminated);
}

function nextAlivePlayerIndex(state: GameState, fromIndex: number): number {
  const n = state.players.length;
  let idx = (fromIndex + 1) % n;
  let safety = 0;
  while (state.players[idx].isEliminated && safety < n) {
    idx = (idx + 1) % n;
    safety++;
  }
  return idx;
}

function drawCardFromDeck(state: GameState): { state: GameState; card: string | null } {
  let deck = [...state.deck];
  let discardPile = [...state.discardPile];

  if (deck.length === 0) {
    if (discardPile.length === 0) return { state, card: null };
    deck = shuffleArray(discardPile);
    discardPile = [];
  }

  const card = deck.shift()!;
  return {
    state: { ...state, deck, discardPile },
    card,
  };
}

// ─── PLAY SPECIALTY CARD ────────────────────────────────────

function playSpecialtyCard(state: GameState, playerId: number, cardId: string): GameState {
  const strategy = getStrategy(state.players.find(p => p.id === playerId)!.strategy);

  switch (cardId) {
    case 'identity_theft': {
      const targetId = strategy.chooseTargetForCard(state, playerId, cardId);
      if (targetId < 0) return state;
      return applyIdentityTheft(state, playerId, targetId);
    }
    case 'blottaren': {
      const targetId = strategy.chooseTargetForCard(state, playerId, cardId);
      if (targetId < 0) return state;
      return applyBlottaren(state, playerId, targetId);
    }
    case 'skinny_dipping': {
      const targetId = strategy.chooseTargetForCard(state, playerId, cardId);
      if (targetId < 0) return state;
      return applySkinnyDipping(state, playerId, targetId);
    }
    case 'the_sacrifice':
      return applyTheSacrifice(state, playerId);
    case 'oppenheimer':
      return applyOppenheimer(state, playerId);
    case 'begger':
      return applyBegger(state, playerId);
    case 'steal': {
      const targetId = strategy.chooseTargetForCard(state, playerId, cardId);
      if (targetId < 0) return state;
      return applySteal(state, playerId, targetId);
    }
    case 'silvertejp':
      return applySilvertejp(state, playerId);
    case 'moonshine_night': {
      const targetId = strategy.chooseTargetForCard(state, playerId, cardId);
      if (targetId < 0) return state;
      return applyMoonshineNight(state, playerId, targetId);
    }
    case 'loot_the_corpse': {
      const targetId = strategy.chooseTargetForCard(state, playerId, cardId);
      if (targetId < 0) return state;
      return applyLootTheCorpse(state, playerId, targetId);
    }
    case 'polacken':
      return applyPolacken(state, playerId);
    case 'senile_grandma':
      return applySenileGrandma(state, playerId);
    case 'haunted_barn': {
      const targetId = strategy.chooseTargetForCard(state, playerId, cardId);
      if (targetId < 0) return state;
      return applyHauntedBarn(state, playerId, targetId);
    }
    default:
      return state;
  }
}

// ─── RUN TURN ───────────────────────────────────────────────

/** Execute one complete turn for the current player */
export function runTurn(state: GameState): GameState {
  if (state.isOver) return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.isEliminated) {
    return {
      ...state,
      currentPlayerIndex: nextAlivePlayerIndex(state, state.currentPlayerIndex),
    };
  }

  state = { ...state, turnNumber: state.turnNumber + 1, phase: 'play_cards' };

  if (state.turnNumber > MAX_TURNS) {
    return { ...state, isOver: true, isDraw: true };
  }

  const playerId = currentPlayer.id;
  const playerStrategy = getStrategy(currentPlayer.strategy);

  // ── PHASE 1: Check Stop It from other players ──
  const alive = alivePlayers(state);
  for (const other of alive) {
    if (other.id === playerId) continue;
    const otherStrategy = getStrategy(other.strategy);
    if (otherStrategy.shouldPlayStopIt(state, other.id, playerId)) {
      state = applyStopIt(state, other.id);
      // Skip to draw card phase
      state = drawPhase(state, playerId);
      state = endTurnPhase(state, playerId);
      return advanceTurn(state);
    }
  }

  // ── PHASE 1b: Play specialty cards on own turn ──
  const specialtyCards = playerStrategy.chooseSpecialtyCardsThisTurn(state, playerId);
  for (const cardId of specialtyCards) {
    if (state.isOver) break;
    const player = state.players.find(p => p.id === playerId)!;
    if (!player.hand.includes(cardId)) continue;
    if (player.isEliminated) break;

    // Check if God Mode can nope this card
    const cardDef = CARD_DATABASE[cardId];
    if (cardDef && cardDef.canBeNopedByGodMode) {
      let noped = false;
      for (const other of alive) {
        if (other.id === playerId || other.isEliminated) continue;
        const otherStrategy = getStrategy(other.strategy);
        // Create a fake pending attack for God Mode check
        const fakeThreat: PendingAttack = {
          attackerId: playerId, targetId: other.id,
          attackCardId: cardId, chainHistory: [],
        };
        if (otherStrategy.shouldPlayGodMode(state, other.id, fakeThreat)) {
          state = applyGodMode(state, other.id);
          noped = true;
          break;
        }
      }
      if (noped) continue;
    }

    state = playSpecialtyCard(state, playerId, cardId);
  }

  if (state.isOver) return advanceTurn(state);

  // ── PHASE 1c: Choose attack ──
  const updatedPlayer = state.players.find(p => p.id === playerId)!;
  if (updatedPlayer.isEliminated) return advanceTurn(state);

  const attackCard = playerStrategy.chooseAttackCard(state, playerId);
  if (attackCard && updatedPlayer.hand.includes(attackCard)) {
    const targetId = playerStrategy.chooseAttackTarget(state, playerId);
    if (targetId >= 0) {
      // Remove attack card from hand
      const hand = [...updatedPlayer.hand];
      const idx = hand.indexOf(attackCard);
      if (idx !== -1) hand.splice(idx, 1);
      state = {
        ...state,
        players: state.players.map(p => p.id === playerId ? {
          ...p, hand, cardsPlayed: p.cardsPlayed + 1,
        } : p),
        phase: 'attack_chain',
        pendingAttack: {
          attackerId: playerId,
          targetId,
          attackCardId: attackCard,
          chainHistory: [],
        },
        events: [...state.events, {
          turn: state.turnNumber,
          type: 'attack_declared',
          actorId: playerId,
          targetId,
          cardId: attackCard,
        }],
      };

      // ── PHASE 2: Attack chain (shake window) ──
      state = resolveAttackChain(state);

      // ── PHASE 3: Resolve attack ──
      if (state.pendingAttack && !state.isOver) {
        state = resolveAttack(state);
      }
    }
  }

  if (state.isOver) return advanceTurn(state);

  // ── PHASE 4: Draw card ──
  state = drawPhase(state, playerId);

  // ── PHASE 5: End turn ──
  state = endTurnPhase(state, playerId);

  return advanceTurn(state);
}

// ─── ATTACK CHAIN ───────────────────────────────────────────

function resolveAttackChain(state: GameState): GameState {
  if (!state.pendingAttack) return state;

  let changed = true;
  let iterations = 0;

  while (changed && iterations < 20 && !state.isOver) {
    changed = false;
    iterations++;
    const attack = state.pendingAttack!;
    if (!attack) break;

    // Get reaction order: target first, then clockwise, attacker last
    const alive = alivePlayers(state);
    const targetIdx = alive.findIndex(p => p.id === attack.targetId);
    const ordered: PlayerState[] = [];
    if (targetIdx >= 0) {
      for (let i = 0; i < alive.length; i++) {
        const p = alive[(targetIdx + i) % alive.length];
        if (p.id !== attack.attackerId) ordered.push(p);
      }
    }
    // Attacker reacts last
    const attacker = alive.find(p => p.id === attack.attackerId);
    if (attacker) ordered.push(attacker);

    for (const reactor of ordered) {
      if (state.isOver || !state.pendingAttack) break;
      const strategy = getStrategy(reactor.strategy);
      const currentAttack = state.pendingAttack!;

      // Check redirect
      if (currentAttack.targetId === reactor.id) {
        const redirect = strategy.shouldRedirect(state, reactor.id, currentAttack);
        if (redirect.play && redirect.newTargetId >= 0) {
          state = applyRedirect(state, reactor.id, redirect.newTargetId);
          changed = true;
          break;
        }

        // Check Wrong Goat
        if (strategy.shouldPlayWrongGoat(state, reactor.id, currentAttack)) {
          state = applyWrongGoat(state, reactor.id, currentAttack.attackerId, currentAttack.targetId);
          changed = true;
          break;
        }
      }

      // Check God Mode
      if (strategy.shouldPlayGodMode(state, reactor.id, currentAttack)) {
        state = applyGodMode(state, reactor.id);

        // Check counter-nope chain
        const counterPlayer = currentAttack.attackerId === reactor.id
          ? state.players.find(p => p.id === currentAttack.targetId)
          : state.players.find(p => p.id === currentAttack.attackerId);

        if (counterPlayer && !counterPlayer.isEliminated) {
          const counterStrategy = getStrategy(counterPlayer.strategy);
          if (counterStrategy.shouldPlayGodMode(state, counterPlayer.id, currentAttack)) {
            // Counter-nope: the God Mode is cancelled, attack continues
            state = applyGodMode(state, counterPlayer.id);
            changed = true;
            break;
          }
        }

        // Attack is noped
        state = { ...state, pendingAttack: null };
        return state;
      }
    }
  }

  return state;
}

// ─── RESOLVE ATTACK ─────────────────────────────────────────

function resolveAttack(state: GameState): GameState {
  const attack = state.pendingAttack!;
  if (!attack) return state;

  let diceRoll = rollDice();

  // Check Adrenaline from all players
  const alive = alivePlayers(state);
  for (const player of alive) {
    if (state.isOver) break;
    const strategy = getStrategy(player.strategy);
    if (strategy.shouldPlayAdrenaline(state, player.id, attack, diceRoll)) {
      const result = applyAdrenaline(state, player.id);
      state = result.state;
      diceRoll = result.newRoll;
      break;
    }
  }

  state = applyAttackDamage(state, attack.attackerId, attack.targetId, attack.attackCardId, diceRoll);
  state = {
    ...state,
    pendingAttack: null,
    discardPile: [...state.discardPile, attack.attackCardId],
  };

  return state;
}

// ─── DRAW PHASE ─────────────────────────────────────────────

function drawPhase(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.isEliminated) return state;

  const result = drawCardFromDeck(state);
  state = result.state;
  const card = result.card;

  if (!card) return state;

  if (card === 'mad_cow') {
    state = {
      ...state,
      events: [...state.events, {
        turn: state.turnNumber,
        type: 'mad_cow_triggered',
        actorId: playerId,
        cardId: 'mad_cow',
      }],
    };
    state = applyMadCow(state, playerId);
    state = { ...state, discardPile: [...state.discardPile, 'mad_cow'] };
  } else {
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === playerId ? { ...p, hand: [...p.hand, card] } : p
      ),
    };
  }

  return state;
}

// ─── END TURN ───────────────────────────────────────────────

function endTurnPhase(state: GameState, playerId: number): GameState {
  state = checkHauntedBarnTrigger(state, playerId);

  // Increment turns played
  state = {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, turnsPlayed: p.turnsPlayed + 1 } : p
    ),
  };

  return state;
}

function advanceTurn(state: GameState): GameState {
  if (state.isOver) return state;
  return {
    ...state,
    currentPlayerIndex: nextAlivePlayerIndex(state, state.currentPlayerIndex),
    phase: 'play_cards',
    pendingAttack: null,
  };
}
