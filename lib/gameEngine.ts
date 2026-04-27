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

  // ── Determine starting player via dice roll (highest starts) ──
  let diceRolls = players.map(p => ({ id: p.id, roll: rollDice() }));
  let maxRoll = Math.max(...diceRolls.map(r => r.roll));
  let candidates = diceRolls.filter(r => r.roll === maxRoll);
  // Re-roll ties until one winner
  while (candidates.length > 1) {
    candidates = candidates.map(c => ({ id: c.id, roll: rollDice() }));
    maxRoll = Math.max(...candidates.map(r => r.roll));
    candidates = candidates.filter(r => r.roll === maxRoll);
  }
  const startPlayerIndex = candidates[0].id;

  return {
    players,
    deck,
    discardPile: [],
    currentPlayerIndex: startPlayerIndex,
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

  // Log turn_start so the game log can correctly label whose turn it is
  state = {
    ...state,
    events: [...state.events, { turn: state.turnNumber, type: 'turn_start', actorId: playerId }],
  };

  // ── PHASE 1: Check Stop It from other players ──
  // Stop It can ONLY be played by a player who is NOT the current turn player.
  const alive = alivePlayers(state);
  for (const other of alive) {
    if (other.id === playerId) continue;
    const otherStrategy = getStrategy(other.strategy);
    if (otherStrategy.shouldPlayStopIt(state, other.id, playerId)) {
      state = applyStopIt(state, other.id, playerId); // playerId = whose turn is stopped
      state = drawPhase(state, playerId);
      state = endTurnPhase(state, playerId);
      return advanceTurn(state);
    }
  }

  // ── PHASE 1b: Play specialty cards on own turn ──
  // God Mode is purely reactive — never used proactively to nope specialty cards
  const specialtyCards = playerStrategy.chooseSpecialtyCardsThisTurn(state, playerId);
  for (const cardId of specialtyCards) {
    if (state.isOver) break;
    const player = state.players.find(p => p.id === playerId)!;
    if (!player.hand.includes(cardId)) continue;
    if (player.isEliminated) break;
    state = playSpecialtyCard(state, playerId, cardId);
  }

  if (state.isOver) return advanceTurn(state);

  // ── PHASE 1c: Choose attack ──
  const updatedPlayer = state.players.find(p => p.id === playerId)!;
  if (updatedPlayer.isEliminated) return advanceTurn(state);

  const attackCard = playerStrategy.chooseAttackCard(state, playerId);
  if (attackCard && updatedPlayer.hand.includes(attackCard)) {
    // ── Stop It window: can also be played right before the attack dice roll ──
    let stopItPlayed = false;
    for (const other of alivePlayers(state)) {
      if (other.id === playerId) continue; // current player CANNOT Stop It their own turn
      const otherStrategy = getStrategy(other.strategy);
      if (otherStrategy.shouldPlayStopIt(state, other.id, playerId)) {
        state = applyStopIt(state, other.id, playerId);
        stopItPlayed = true;
        break;
      }
    }
    if (stopItPlayed) {
      state = drawPhase(state, playerId);
      state = endTurnPhase(state, playerId);
      return advanceTurn(state);
    }

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

      // ── PHASE 2: Attack chain (God Mode / Redirect / Wrong Goat) ──
      state = resolveAttackChain(state);

      // ── PHASE 3: Resolve attack (dice roll) ──
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

  // Each iteration handles ONE reaction (redirect/wrong_goat changes target → re-evaluate).
  // ── CHAIN RULES ─────────────────────────────────────────────
  //
  // Each iteration of the loop resolves ONE reaction window:
  //
  // 1. Current target may play Redirect or Wrong Goat (changes target).
  //    → Records previousTargetId so God Mode can revert it.
  //
  // 2. God Mode nopes the LAST CARD played in the chain:
  //    • If a redirect just happened → God Mode nopes the redirect,
  //      target reverts to previousTargetId. The redirect player can
  //      counter-nope (God Mode the God Mode) to keep the redirect.
  //    • If no redirect yet → God Mode nopes the attack itself.
  //      The attacker can counter-nope to push the attack through.
  //
  // Safety cap prevents infinite loops from rogue redirect chains.

  const SAFETY_CAP = 100;
  let iterations = 0;

  while (state.pendingAttack && !state.isOver && iterations < SAFETY_CAP) {
    iterations++;
    const attack = state.pendingAttack;

    // Reaction order: current target first, clockwise (excl. attacker), attacker last
    const alive = alivePlayers(state);
    const targetIdx = alive.findIndex(p => p.id === attack.targetId);
    const ordered: PlayerState[] = [];
    if (targetIdx >= 0) {
      for (let i = 0; i < alive.length; i++) {
        const p = alive[(targetIdx + i) % alive.length];
        if (p.id !== attack.attackerId) ordered.push(p);
      }
    }
    const attackerState = alive.find(p => p.id === attack.attackerId);
    if (attackerState) ordered.push(attackerState);

    let anyReaction = false;

    for (const reactor of ordered) {
      if (state.isOver || !state.pendingAttack) break;
      const currentAttack = state.pendingAttack;
      const strategy = getStrategy(reactor.strategy);

      // ── Step A: Current target can redirect (Redirect / Wrong Goat) ──
      if (currentAttack.targetId === reactor.id) {
        const redirect = strategy.shouldRedirect(state, reactor.id, currentAttack);
        if (redirect.play && redirect.newTargetId >= 0) {
          const prevTarget = currentAttack.targetId;
          state = applyRedirect(state, reactor.id, redirect.newTargetId);
          // Tag the new chain event with the previous target for potential revert
          if (state.pendingAttack && state.pendingAttack.chainHistory.length > 0) {
            const last = state.pendingAttack.chainHistory[state.pendingAttack.chainHistory.length - 1];
            last.previousTargetId = prevTarget;
          }
          anyReaction = true;
          break;
        }

        if (strategy.shouldPlayWrongGoat(state, reactor.id, currentAttack)) {
          const prevTarget = currentAttack.targetId;
          state = applyWrongGoat(state, reactor.id, currentAttack.attackerId, currentAttack.targetId);
          if (state.pendingAttack && state.pendingAttack.chainHistory.length > 0) {
            const last = state.pendingAttack.chainHistory[state.pendingAttack.chainHistory.length - 1];
            last.previousTargetId = prevTarget;
          }
          anyReaction = true;
          break;
        }
      }

      // ── Step B: Any player can God Mode ──
      if (strategy.shouldPlayGodMode(state, reactor.id, currentAttack)) {
        state = applyGodMode(state, reactor.id);

        const lastChainEvent = currentAttack.chainHistory.at(-1);
        const isNopingRedirect = lastChainEvent &&
          (lastChainEvent.type === 'redirect' || lastChainEvent.type === 'wrong_goat');

        if (isNopingRedirect) {
          // ── God Mode nopes the REDIRECT ──
          // The player who played the redirect can counter-nope to keep it.
          const redirectPlayerId = lastChainEvent.playerId;
          const redirectPlayer = state.players.find(p => p.id === redirectPlayerId && !p.isEliminated);
          if (redirectPlayer) {
            const redirectStrategy = getStrategy(redirectPlayer.strategy);
            if (redirectStrategy.shouldPlayGodMode(state, redirectPlayer.id, currentAttack)) {
              state = applyGodMode(state, redirectPlayer.id);
              // Counter-nope: redirect stands, restart loop with new target
              anyReaction = true;
              break;
            }
          }
          // God Mode succeeds: revert target to what it was before the redirect
          const prevTargetId = lastChainEvent.previousTargetId;
          if (state.pendingAttack && prevTargetId !== undefined) {
            state = {
              ...state,
              pendingAttack: {
                ...state.pendingAttack,
                targetId: prevTargetId,
                chainHistory: state.pendingAttack.chainHistory.slice(0, -1),
              },
            };
          }
          anyReaction = true;
          break;

        } else {
          // ── God Mode nopes the ATTACK ITSELF ──
          // The attacker can counter-nope to push the attack through.
          const attackerPlayer = state.players.find(p => p.id === currentAttack.attackerId && !p.isEliminated);
          if (attackerPlayer && reactor.id !== currentAttack.attackerId) {
            const attackerStrategy = getStrategy(attackerPlayer.strategy);
            if (attackerStrategy.shouldPlayGodMode(state, attackerPlayer.id, currentAttack)) {
              state = applyGodMode(state, attackerPlayer.id);
              // Counter-nope: attack proceeds, chain ends
              return state;
            }
          }
          // God Mode succeeds: attack is cancelled
          state = { ...state, pendingAttack: null };
          return state;
        }
      }
    }

    // No reactions → proceed to dice roll
    if (!anyReaction) break;
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
