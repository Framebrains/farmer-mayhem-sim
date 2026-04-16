import { SingleGameResult, SimConfig, SimulationStats, CardStat, Strategy } from './types';
import { CARD_DATABASE } from './cardDatabase';
import { detectRedFlags } from './redFlagDetector';

/** Calculate mean of an array of numbers */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Aggregate raw game results into simulation statistics */
export function aggregateResults(results: SingleGameResult[], config: SimConfig): SimulationStats {
  const totalGames = results.length;

  // Game length stats
  const turns = results.map(r => r.turnsPlayed);
  const avgTurns = mean(turns);
  const minTurns = Math.min(...turns);
  const maxTurns = Math.max(...turns);
  const avgMinutes = avgTurns * (35 / 60);

  // Wins by position
  const winsByPosition = Array(config.playerCount).fill(0) as number[];
  results.forEach(r => {
    if (r.winnerId !== null) {
      const winner = r.playerResults.find(p => p.id === r.winnerId);
      if (winner) winsByPosition[winner.turnOrder]++;
    }
  });
  const winRateByPosition = winsByPosition.map(w => w / totalGames);

  // Wins by strategy
  const winsByStrategy: Record<Strategy, number> = {
    aggressive: 0, defensive: 0, balanced: 0, random: 0,
  };
  const strategyAppearances: Record<Strategy, number> = {
    aggressive: 0, defensive: 0, balanced: 0, random: 0,
  };

  results.forEach(r => {
    r.playerResults.forEach(p => {
      strategyAppearances[p.strategy]++;
    });
    if (r.winnerId !== null) {
      const winner = r.playerResults.find(p => p.id === r.winnerId);
      if (winner) winsByStrategy[winner.strategy]++;
    }
  });

  const winRateByStrategy: Record<Strategy, number> = {
    aggressive: 0, defensive: 0, balanced: 0, random: 0,
  };
  for (const s of ['aggressive', 'defensive', 'balanced', 'random'] as Strategy[]) {
    winRateByStrategy[s] = strategyAppearances[s] > 0
      ? winsByStrategy[s] / (strategyAppearances[s] / config.playerCount)
      : 0;
  }

  // Draw stats
  const drawCount = results.filter(r => r.isDraw).length;
  const drawRate = drawCount / totalGames;

  // Card stats
  const cardStats: Record<string, CardStat> = {};

  // Track card appearances across all games
  const cardDrawnCount: Record<string, number> = {};
  const cardPlayedCount: Record<string, number> = {};
  const cardWinnerHadCount: Record<string, number> = {};
  const cardGamesAppeared: Record<string, number> = {};

  // Initialize all cards
  for (const cardId of Object.keys(CARD_DATABASE)) {
    cardDrawnCount[cardId] = 0;
    cardPlayedCount[cardId] = 0;
    cardWinnerHadCount[cardId] = 0;
    cardGamesAppeared[cardId] = 0;
  }

  results.forEach(r => {
    // Count cards played from events
    const playedThisGame: Record<string, number> = {};
    const drawnThisGame = new Set<string>();

    r.events.forEach(e => {
      if (e.cardId) {
        if (e.type === 'card_played' || e.type === 'attack_declared' || e.type === 'attack_hit' || e.type === 'attack_missed') {
          playedThisGame[e.cardId] = (playedThisGame[e.cardId] || 0) + 1;
          cardPlayedCount[e.cardId] = (cardPlayedCount[e.cardId] || 0) + 1;
        }
      }
    });

    // Estimate cards drawn from player results
    r.playerResults.forEach(p => {
      // Cards played = cards that were in hand at some point
      // Approximate: each player drew 7 initial + some from deck
    });

    // Track what the winner had
    if (r.winnerId !== null) {
      const winner = r.playerResults.find(p => p.id === r.winnerId);
      if (winner) {
        // The winner played these cards
        r.events.forEach(e => {
          if (e.cardId && e.actorId === r.winnerId) {
            if (e.type === 'card_played' || e.type === 'attack_declared') {
              cardWinnerHadCount[e.cardId] = (cardWinnerHadCount[e.cardId] || 0) + 1;
            }
          }
        });
      }
    }

    // Count unique card appearances per game
    for (const cardId of Object.keys(playedThisGame)) {
      cardGamesAppeared[cardId] = (cardGamesAppeared[cardId] || 0) + 1;
    }
  });

  // Estimate drawn count (each game deals 7 * playerCount cards initially)
  const cardsDealtPerGame = 7 * config.playerCount;
  for (const cardId of Object.keys(CARD_DATABASE)) {
    const card = CARD_DATABASE[cardId];
    if (card.type === 'trap') continue;
    // Probability of being dealt = count / total deck size
    const totalDeckSize = Object.values(CARD_DATABASE)
      .filter(c => c.type !== 'trap')
      .reduce((sum, c) => sum + c.count, 0);
    const drawProbPerCard = card.count / totalDeckSize;
    cardDrawnCount[cardId] = Math.round(drawProbPerCard * cardsDealtPerGame * totalGames);
  }

  for (const cardId of Object.keys(CARD_DATABASE)) {
    const drawn = Math.max(cardDrawnCount[cardId] || 0, 1);
    const played = cardPlayedCount[cardId] || 0;
    const winnerHad = cardWinnerHadCount[cardId] || 0;

    cardStats[cardId] = {
      cardId,
      timesDrawn: drawn,
      timesPlayed: played,
      playRate: played / drawn,
      winnerHadCard: winnerHad,
      winCorrelation: winnerHad / Math.max(cardGamesAppeared[cardId] || 1, 1),
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
