import { SimulationStats, RedFlag } from './types';
import { CARD_DATABASE } from './cardDatabase';

/** Analyze simulation statistics and return balance warnings */
export function detectRedFlags(stats: SimulationStats): RedFlag[] {
  const flags: RedFlag[] = [];

  // CRITICAL: Card with winCorrelation > 0.75
  for (const [id, card] of Object.entries(stats.cardStats)) {
    if (card.winCorrelation > 0.75 && card.timesDrawn > stats.totalGames * 0.1) {
      const name = CARD_DATABASE[id]?.name || id;
      flags.push({
        severity: 'critical',
        category: 'card_balance',
        message: `${name} är för kraftigt`,
        detail: `Vinnaren hade kortet i ${(card.winCorrelation * 100).toFixed(0)}% av spelen`,
        suggestion: 'Minska antal i leken eller begränsa effekten',
        value: card.winCorrelation,
        threshold: 0.75,
      });
    }
  }

  // WARNING: Card with playRate < 0.3
  for (const [id, card] of Object.entries(stats.cardStats)) {
    if (card.playRate < 0.3 && card.timesDrawn > stats.totalGames * 0.05) {
      const name = CARD_DATABASE[id]?.name || id;
      const cardDef = CARD_DATABASE[id];
      if (cardDef && cardDef.type !== 'trap' && cardDef.timing !== 'automatic') {
        flags.push({
          severity: 'warning',
          category: 'card_balance',
          message: `${name} spelas sällan`,
          detail: `Spelas bara i ${(card.playRate * 100).toFixed(0)}% av fallen det dras`,
          suggestion: 'Överväg att buffa kortet eller minska kostnaden',
          value: card.playRate,
          threshold: 0.3,
        });
      }
    }
  }

  // WARNING: First-mover advantage > 10% over expected
  const expectedWinRate = 1 / stats.playerCount;
  if (stats.winRateByPosition.length > 0) {
    const firstMoverRate = stats.winRateByPosition[0];
    if (firstMoverRate > expectedWinRate + 0.10) {
      flags.push({
        severity: 'warning',
        category: 'player_balance',
        message: 'Förstadragsfördelar detekterad',
        detail: `Spelare 1 vinner ${(firstMoverRate * 100).toFixed(1)}% vs förväntat ${(expectedWinRate * 100).toFixed(1)}%`,
        suggestion: 'Ge kompensation till senare spelare eller randomisera startordning',
        value: firstMoverRate,
        threshold: expectedWinRate + 0.10,
      });
    }
  }

  // WARNING: Defensive strategy wins < half of expected
  const defWinRate = stats.winRateByStrategy.defensive;
  if (defWinRate < expectedWinRate * 0.5 && defWinRate >= 0) {
    flags.push({
      severity: 'warning',
      category: 'strategy_balance',
      message: 'Defensiv strategi är för svag',
      detail: `Defensiv vinner ${(defWinRate * 100).toFixed(1)}% vs förväntat ${(expectedWinRate * 100).toFixed(1)}%`,
      suggestion: 'Stärk defensiva kort eller ge defensiva spelare fler kort',
      value: defWinRate,
      threshold: expectedWinRate * 0.5,
    });
  }

  // CRITICAL: Average game length > 25 minutes (~43 rounds)
  if (stats.avgTurns > 43) {
    flags.push({
      severity: 'critical',
      category: 'game_length',
      message: 'Spelen tar för lång tid',
      detail: `Snitt ${stats.avgTurns.toFixed(0)} rundor (${stats.avgMinutes.toFixed(0)} min)`,
      suggestion: 'Öka attackstyrka eller minska HP/healing',
      value: stats.avgTurns,
      threshold: 43,
    });
  }

  // WARNING: Average game length < 5 minutes (~9 rounds)
  if (stats.avgTurns < 9) {
    flags.push({
      severity: 'warning',
      category: 'game_length',
      message: 'Spelen är för korta',
      detail: `Snitt ${stats.avgTurns.toFixed(0)} rundor (${stats.avgMinutes.toFixed(0)} min)`,
      suggestion: 'Minska attackstyrka eller öka HP/healing-möjligheter',
      value: stats.avgTurns,
      threshold: 9,
    });
  }

  // WARNING: Draw rate > 5%
  if (stats.drawRate > 0.05) {
    flags.push({
      severity: 'warning',
      category: 'game_length',
      message: 'Hög andel oavgjorda spel',
      detail: `${(stats.drawRate * 100).toFixed(1)}% av spelen slutar oavgjort`,
      suggestion: 'Lägg till sudden-death-mekanism eller minska max rundor',
      value: stats.drawRate,
      threshold: 0.05,
    });
  }

  // INFO: Cards that are never played
  for (const [id, card] of Object.entries(stats.cardStats)) {
    if (card.timesPlayed === 0 && card.timesDrawn > stats.totalGames * 0.05) {
      const name = CARD_DATABASE[id]?.name || id;
      const cardDef = CARD_DATABASE[id];
      if (cardDef && cardDef.type !== 'trap' && cardDef.timing !== 'automatic') {
        flags.push({
          severity: 'info',
          category: 'card_balance',
          message: `${name} spelas aldrig`,
          detail: `Drogs ${card.timesDrawn} gånger men spelades 0 gånger`,
          suggestion: 'Överväg att ta bort kortet eller redesigna effekten',
          value: 0,
          threshold: 0,
        });
      }
    }
  }

  // Sort by severity
  const order = { critical: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
