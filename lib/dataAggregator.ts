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

    // Actual win rate when a player used this card (0–1)
    // Balanced card → ≈ expectedWinRate (1/playerCount)
    // OP card → significantly higher than expectedWinRate
    const winRateWhenPlayed = instances > 0 ? wins / instances : 0;

    // Normalise for display: express as how much above/below expected
    // 0.5 = neutral (= expectedWinRate), 1.0 = 2x expected (very strong), 0 = never wins
    const winCorrelation = instances > 0
      ? Math.min(winRateWhenPlayed / (expectedWinRate * 2), 1)
      : 0;

    cardStats[cardId] = {
      cardId,
      timesDrawn: estimatedDrawn,
      timesPlayed: plays,
      playRate: estimatedDrawn > 0 ? plays / estimatedDrawn : 0,
      winnerHadCard: wins,
      winCorrelation,
      avgTimesPerGame: plays / totalGames,
    };
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
    redFlags: [],
  };

  stats.redFlags = detectRedFlags(stats, expectedWinRate);
  return stats;
}
