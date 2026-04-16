import { SingleGameResult, SimConfig, SimulationStats, CardStat, Strategy } from './types';
import { CARD_DATABASE } from './cardDatabase';
import { detectRedFlags } from './redFlagDetector';

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

const PLAY_EVENT_TYPES = new Set([
  'card_played', 'attack_declared', 'attack_hit', 'attack_missed',
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
    // Normalise: "if this strategy filled a full seat every game, how often did it win?"
    const gamesAsPlayer = strategyGameSlots[s] / config.playerCount;
    winRateByStrategy[s] = gamesAsPlayer > 0 ? winsByStrategy[s] / gamesAsPlayer : 0;
  }

  // ── Draws ────────────────────────────────────────────────
  const drawCount = results.filter(r => r.isDraw).length;
  const drawRate = drawCount / totalGames;

  // ── Card stats ───────────────────────────────────────────
  // All counters are PER-GAME (using Sets), not per-event.
  // This ensures winCorrelation is always in [0, 1].
  //
  // gamesCardPlayed[id]       = # games where card was played by anyone
  // gamesWinnerPlayedCard[id] = # games where the winner played the card
  // totalTimesPlayed[id]      = raw event count across all games (for avgTimesPerGame)

  const gamesCardPlayed: Record<string, number> = {};
  const gamesWinnerPlayedCard: Record<string, number> = {};
  const totalTimesPlayed: Record<string, number> = {};

  for (const cardId of Object.keys(CARD_DATABASE)) {
    gamesCardPlayed[cardId] = 0;
    gamesWinnerPlayedCard[cardId] = 0;
    totalTimesPlayed[cardId] = 0;
  }

  results.forEach(r => {
    // Sets track unique card IDs per game (not event counts)
    const playedThisGame = new Set<string>();
    const winnerPlayedThisGame = new Set<string>();

    r.events.forEach(e => {
      if (!e.cardId || !PLAY_EVENT_TYPES.has(e.type)) return;

      totalTimesPlayed[e.cardId] = (totalTimesPlayed[e.cardId] || 0) + 1;
      playedThisGame.add(e.cardId);

      if (r.winnerId !== null && e.actorId === r.winnerId) {
        winnerPlayedThisGame.add(e.cardId);
      }
    });

    for (const cardId of playedThisGame) {
      gamesCardPlayed[cardId]++;
    }
    for (const cardId of winnerPlayedThisGame) {
      gamesWinnerPlayedCard[cardId]++;
    }
  });

  // Estimate timesDrawn from deck probability (for playRate display)
  const totalDeckSize = Object.values(CARD_DATABASE)
    .filter(c => c.type !== 'trap')
    .reduce((sum, c) => sum + c.count, 0);
  const cardsDealtPerGame = 7 * config.playerCount;

  const cardStats: Record<string, CardStat> = {};

  for (const [cardId, cardDef] of Object.entries(CARD_DATABASE)) {
    if (cardDef.type === 'trap') continue;

    const count = config.deckConfig.overrides[cardId] ?? cardDef.count;
    const estimatedDrawn = Math.max(
      Math.round((count / totalDeckSize) * cardsDealtPerGame * totalGames),
      1,
    );
    const played = totalTimesPlayed[cardId] || 0;
    const gamesPlayed = gamesCardPlayed[cardId] || 0;
    const gamesWinnerPlayed = gamesWinnerPlayedCard[cardId] || 0;

    // winCorrelation: "of games where this card was played by anyone,
    // what fraction had the winner play it?"
    // Expected value = 1 / playerCount. Values >> expected = potentially overpowered.
    const winCorrelation = gamesPlayed > 0
      ? gamesWinnerPlayed / gamesPlayed
      : 0;

    cardStats[cardId] = {
      cardId,
      timesDrawn: estimatedDrawn,
      timesPlayed: played,
      playRate: estimatedDrawn > 0 ? played / estimatedDrawn : 0,
      winnerHadCard: gamesWinnerPlayed,
      winCorrelation,
      avgTimesPerGame: played / totalGames,
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

  stats.redFlags = detectRedFlags(stats);
  return stats;
}
