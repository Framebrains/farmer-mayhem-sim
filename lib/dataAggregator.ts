import { SingleGameResult, SimConfig, SimulationStats, CardStat, Strategy } from './types';
import { CARD_DATABASE } from './cardDatabase';
import { detectRedFlags } from './redFlagDetector';

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ALL event types that indicate a card was actively used by a player
const PLAY_EVENT_TYPES = new Set([
  'card_played',          // specialty cards on own turn
  'attack_declared',      // attack initiated
  'attack_hit',           // attack resolved (hit)
  'attack_missed',        // attack resolved (miss)
  'attack_noped',         // god_mode used
  'attack_redirected',    // redirect or wrong_goat used
  'mad_cow_triggered',    // mad cow drawn
  'insurance_triggered',  // insurance auto-triggered
  'sacrifice_wheel_spun', // the_sacrifice played
  'haunted_barn_triggered',
]);

/** Aggregate raw game results into simulation statistics */
export function aggregateResults(results: SingleGameResult[], config: SimConfig): SimulationStats {
  const totalGames = results.length;

  // ── Game length ──────────────────────────────────────────
  const turns = results.map(r => r.turnsPlayed);
  const avgTurns = mean(turns);
  const minTurns = Math.min(...turns);
  const maxTurns = Math.max(...turns);
  const avgMinutes = avgTurns * (35 / 60);

  // ── Wins by position ─────────────────────────────────────
  const winsByPosition = Array(config.playerCount).fill(0) as number[];
  results.forEach(r => {
    if (r.winnerId !== null) {
      const winner = r.playerResults.find(p => p.id === r.winnerId);
      if (winner) winsByPosition[winner.turnOrder]++;
    }
  });
  const winRateByPosition = winsByPosition.map(w => w / totalGames);

  // ── Wins by strategy ─────────────────────────────────────
  const winsByStrategy: Record<Strategy, number> = {
    aggressive: 0, defensive: 0, balanced: 0, random: 0,
  };
  const strategyGameSlots: Record<Strategy, number> = {
    aggressive: 0, defensive: 0, balanced: 0, random: 0,
  };

  results.forEach(r => {
    r.playerResults.forEach(p => { strategyGameSlots[p.strategy]++; });
    if (r.winnerId !== null) {
      const winner = r.playerResults.find(p => p.id === r.winnerId);
      if (winner) winsByStrategy[winner.strategy]++;
    }
  });

  const winRateByStrategy: Record<Strategy, number> = {
    aggressive: 0, defensive: 0, balanced: 0, random: 0,
  };
  for (const s of ['aggressive', 'defensive', 'balanced', 'random'] as Strategy[]) {
    const gamesAsPlayer = strategyGameSlots[s] / config.playerCount;
    winRateByStrategy[s] = gamesAsPlayer > 0 ? winsByStrategy[s] / gamesAsPlayer : 0;
  }

  // ── Draws ────────────────────────────────────────────────
  const drawCount = results.filter(r => r.isDraw).length;
  const drawRate = drawCount / totalGames;

  // ── Card stats (per-player-game approach) ────────────────
  //
  // For each (player, game) pair where the player used card X:
  //   - playerInstances[X]++
  //   - if that player WON: playerWins[X]++
  //
  // winCorrelation = playerWins[X] / playerInstances[X]
  //   → "win rate among players who played this card"
  //   → Expected = 1/playerCount (e.g. 33% for 3 players)
  //   → Values 2x above expected = potentially OP
  //
  // This avoids the false positive where "C4-Goat appears in 99% of
  // winning games" simply because everyone plays C4-Goat every game.

  const playerInstances: Record<string, number> = {};   // (player,game) count
  const playerWins: Record<string, number> = {};        // subset where player won
  const totalPlays: Record<string, number> = {};        // raw event count

  for (const cardId of Object.keys(CARD_DATABASE)) {
    playerInstances[cardId] = 0;
    playerWins[cardId] = 0;
    totalPlays[cardId] = 0;
  }

  results.forEach(r => {
    // Collect which unique card IDs each player used this game
    const usedByPlayer = new Map<number, Set<string>>();
    for (const p of r.playerResults) {
      usedByPlayer.set(p.id, new Set());
    }

    r.events.forEach(e => {
      if (!e.cardId || !PLAY_EVENT_TYPES.has(e.type)) return;
      totalPlays[e.cardId] = (totalPlays[e.cardId] || 0) + 1;
      usedByPlayer.get(e.actorId)?.add(e.cardId);
    });

    for (const [playerId, cards] of usedByPlayer) {
      for (const cardId of cards) {
        playerInstances[cardId]++;
        if (r.winnerId === playerId) {
          playerWins[cardId]++;
        }
      }
    }
  });

  // Estimate timesDrawn for playRate (probabilistic from deck composition)
  const totalDeckSize = Object.values(CARD_DATABASE)
    .filter(c => c.type !== 'trap')
    .reduce((sum, c) => sum + c.count, 0);
  const cardsDealtPerGame = 7 * config.playerCount;

  const cardStats: Record<string, CardStat> = {};
  const expectedWinRate = 1 / config.playerCount;

  for (const [cardId, cardDef] of Object.entries(CARD_DATABASE)) {
    if (cardDef.type === 'trap') continue;

    const deckCount = config.deckConfig.overrides[cardId] ?? cardDef.count;
    const estimatedDrawn = Math.max(
      Math.round((deckCount / totalDeckSize) * cardsDealtPerGame * totalGames),
      1,
    );

    const instances = playerInstances[cardId] || 0;
    const wins = playerWins[cardId] || 0;
    const plays = totalPlays[cardId] || 0;

    // Raw win rate (unsmoothed) — for display only
    const rawWinRate = instances > 0 ? wins / instances : 0;

    // ── Bayesian smoothing ────────────────────────────────────────────────
    // Problem: rare cards (e.g. Unicorn ×7) are played in few (player,game) pairs.
    // If those few players happen to win, the raw rate looks huge (survivorship bias).
    // Fix: add α pseudo-observations at the expected win rate before computing.
    //
    // α scales with total games so that with more data, real signal dominates:
    //   100 games  → α = max(20, 10)  = 20  (heavy smoothing — don't trust 100 games)
    //   1 000 games → α = max(20, 100) = 100 (moderate)
    //   5 000 games → α = max(20, 500) = 500 (light smoothing)
    //
    // Result: a rare card played 15 times with 10 wins (raw 67%) →
    //   α=20: smoothed = (10 + 20×0.33) / (15+20) = 16.7/35 = 47.7% ≈ balanced ✓
    const BAYES_ALPHA = Math.max(20, totalGames * 0.1);
    const smoothedWins = wins + BAYES_ALPHA * expectedWinRate;
    const smoothedInstances = instances + BAYES_ALPHA;
    const smoothedWinRate = smoothedInstances > 0 ? smoothedWins / smoothedInstances : expectedWinRate;

    // Normalise: 0.5 = expected, 1.0 = 2× expected, 0 = never wins
    const winCorrelation = instances > 0
      ? Math.min(smoothedWinRate / (expectedWinRate * 2), 1)
      : 0;

    cardStats[cardId] = {
      cardId,
      timesDrawn: estimatedDrawn,
      timesPlayed: plays,
      playRate: estimatedDrawn > 0 ? plays / estimatedDrawn : 0,
      winnerHadCard: wins,
      winCorrelation,
      rawWinRate,
      instanceCount: instances,
      avgTimesPerGame: plays / totalGames,
    };
  }

  // ── Killing blow & draw cause analysis ─────────────────────
  //
  // For each game we scan backwards from the last player_eliminated event
  // to find what caused the decisive elimination:
  //   attack_hit       → the attack card (c4_goat, milking_cow, unicorn)
  //   mad_cow_triggered (with diceRoll) → mad_cow
  //   haunted_barn_triggered            → haunted_barn
  //   sacrifice_wheel_spun (nuke)       → the_sacrifice
  //   you_die segment                   → the_sacrifice
  //
  // Draws are split into:
  //   nuke    – all players eliminated by sacrifice/nuke in the same game
  //   timeout – game hit the MAX_TURNS cap

  const killingBlowCounts: Record<string, number> = {};
  let drawTimeout = 0;
  let drawNuke = 0;

  for (const result of results) {
    if (result.isDraw) {
      const hasNuke = result.events.some(
        e => e.type === 'sacrifice_wheel_spun' && e.detail === 'nuke'
      );
      if (hasNuke) drawNuke++;
      else drawTimeout++;
      continue;
    }

    if (result.winnerId === null) continue;

    // Find the last player_eliminated event index
    let lastElimIdx = -1;
    for (let i = result.events.length - 1; i >= 0; i--) {
      if (result.events[i].type === 'player_eliminated') {
        lastElimIdx = i;
        break;
      }
    }
    if (lastElimIdx < 0) continue;

    const eliminatedId = result.events[lastElimIdx].actorId;

    // Walk backwards to find the cause
    let found = false;
    for (let i = lastElimIdx - 1; i >= 0 && !found; i--) {
      const e = result.events[i];

      // These are effects, not causes — skip
      if (e.type === 'player_damaged' || e.type === 'insurance_triggered') continue;

      if (e.type === 'attack_hit' && e.targetId === eliminatedId && e.cardId) {
        killingBlowCounts[e.cardId] = (killingBlowCounts[e.cardId] ?? 0) + 1;
        found = true;
      } else if (e.type === 'mad_cow_triggered' && e.actorId === eliminatedId && e.diceRoll !== undefined) {
        killingBlowCounts['mad_cow'] = (killingBlowCounts['mad_cow'] ?? 0) + 1;
        found = true;
      } else if (e.type === 'haunted_barn_triggered' && e.actorId === eliminatedId) {
        killingBlowCounts['haunted_barn'] = (killingBlowCounts['haunted_barn'] ?? 0) + 1;
        found = true;
      } else if (e.type === 'sacrifice_wheel_spun') {
        killingBlowCounts['the_sacrifice'] = (killingBlowCounts['the_sacrifice'] ?? 0) + 1;
        found = true;
      } else if (e.type === 'turn_start' && i < lastElimIdx - 2) {
        // Don't scan past the previous turn start
        break;
      }
    }
  }

  const stats: SimulationStats = {
    totalGames,
    playerCount: config.playerCount,
    deckConfig: config.deckConfig,
    avgTurns,
    minTurns,
    maxTurns,
    avgMinutes,
    winsByPosition,
    winRateByPosition,
    winsByStrategy,
    winRateByStrategy,
    drawCount,
    drawRate,
    cardStats,
    killingBlowCounts,
    drawCauses: { timeout: drawTimeout, nuke: drawNuke },
    redFlags: [],
  };

  stats.redFlags = detectRedFlags(stats, expectedWinRate);
  // Pick a game near the median length for a representative sample
  const sorted = [...results].sort((a, b) => a.turnsPlayed - b.turnsPlayed);
  stats.sampleGame = sorted[Math.floor(sorted.length / 2)];
  return stats;
}
