import { SimulationStats, RedFlag } from './types';
import { CARD_DATABASE } from './cardDatabase';

/**
 * Analyze simulation statistics and return balance warnings.
 *
 * winCorrelation in CardStat is normalised to [0, 1] where:
 *   0.5 = neutral (win rate exactly as expected = 1/playerCount)
 *   1.0 = 2× expected win rate (very strong)
 *   0.0 = never contributes to wins
 *
 * Raw win rate = winCorrelation * 2 * expectedWinRate
 */
export function detectRedFlags(stats: SimulationStats, expectedWinRate: number): RedFlag[] {
  const flags: RedFlag[] = [];
  const expected = expectedWinRate; // e.g. 0.333 for 3 players

  // ── CRITICAL: card's win rate when played > 1.8× expected ──────────────
  // e.g. for 3 players: winCorrelation > (0.333 * 1.8) / (0.333 * 2) = 0.9
  const criticalNormThreshold = 0.9; // normalised threshold
  const criticalRawThreshold = expected * 1.8;

  for (const [id, card] of Object.entries(stats.cardStats)) {
    const def = CARD_DATABASE[id];
    if (!def || def.type === 'trap' || def.timing === 'automatic') continue;
    // Require meaningful sample: played in at least 10% of games
    if (card.timesPlayed < stats.totalGames * 0.1) continue;

    const rawWinRate = card.winCorrelation * 2 * expected;

    if (card.winCorrelation > criticalNormThreshold) {
      const name = def.name;
      flags.push({
        severity: 'critical',
        category: 'card_balance',
        message: `${name} är potentiellt för kraftigt`,
        detail: `Vinstfrekvens när spelat: ${(rawWinRate * 100).toFixed(0)}% (förväntat: ${(expected * 100).toFixed(0)}%)`,
        suggestion: 'Minska antal i leken, justera effekten, eller lägg till motåtgärder',
        value: rawWinRate,
        threshold: criticalRawThreshold,
      });
    }
  }

  // ── WARNING: card's win rate < 0.4× expected (kortet bidrar inte) ──────
  const weakRawThreshold = expected * 0.4;
  for (const [id, card] of Object.entries(stats.cardStats)) {
    const def = CARD_DATABASE[id];
    if (!def || def.type === 'trap' || def.timing === 'automatic') continue;
    if (card.timesPlayed < stats.totalGames * 0.1) continue;

    const rawWinRate = card.winCorrelation * 2 * expected;
    if (rawWinRate < weakRawThreshold && card.winCorrelation > 0) {
      const name = def.name;
      flags.push({
        severity: 'warning',
        category: 'card_balance',
        message: `${name} bidrar sällan till vinst`,
        detail: `Vinstfrekvens när spelat: ${(rawWinRate * 100).toFixed(0)}% (förväntat: ${(expected * 100).toFixed(0)}%)`,
        suggestion: 'Överväg att stärka kortet eller öka antalet i leken',
        value: rawWinRate,
        threshold: weakRawThreshold,
      });
    }
  }

  // ── WARNING: play rate < 20% for own-turn cards ──────────────────────
  for (const [id, card] of Object.entries(stats.cardStats)) {
    const def = CARD_DATABASE[id];
    if (!def || def.type === 'trap' || def.timing === 'automatic' || def.timing === 'any_time') continue;
    if (card.timesDrawn < stats.totalGames * 0.1) continue;
    if (card.playRate < 0.2 && card.timesDrawn > 0) {
      const name = def.name;
      flags.push({
        severity: 'warning',
        category: 'card_balance',
        message: `${name} spelas sällan när det dras`,
        detail: `Spelades i ${(card.playRate * 100).toFixed(0)}% av fallen det drogs`,
        suggestion: 'Kortet kan vara svårt att använda eller situationsspecifikt — överväg redesign',
        value: card.playRate,
        threshold: 0.2,
      });
    }
  }

  // ── WARNING: first-mover advantage > 15pp over expected ────────────────
  if (stats.winRateByPosition.length > 0) {
    const firstRate = stats.winRateByPosition[0];
    if (firstRate > expected + 0.15) {
      flags.push({
        severity: 'warning',
        category: 'player_balance',
        message: 'Förstadragsfördelar detekterad',
        detail: `Startspelaren vinner ${(firstRate * 100).toFixed(1)}% vs förväntat ${(expected * 100).toFixed(1)}%`,
        suggestion: 'Ge kompensation till senare spelare (fler kort, extra åtgärd)',
        value: firstRate,
        threshold: expected + 0.15,
      });
    }
  }

  // ── WARNING: defensive strategy wins < 40% of expected ──────────────────
  const defRate = stats.winRateByStrategy.defensive;
  if (defRate < expected * 0.4 && stats.totalGames > 200) {
    flags.push({
      severity: 'warning',
      category: 'strategy_balance',
      message: 'Defensiv strategi är för svag',
      detail: `Defensiv vinner ${(defRate * 100).toFixed(1)}% vs förväntat ${(expected * 100).toFixed(1)}%`,
      suggestion: 'Stärk defensiva kort (Grandma, God Mode, Insurance)',
      value: defRate,
      threshold: expected * 0.4,
    });
  }

  // ── CRITICAL: average game > 25 min (~43 rounds) ────────────────────────
  if (stats.avgTurns > 43) {
    flags.push({
      severity: 'critical',
      category: 'game_length',
      message: 'Spelen tar för lång tid',
      detail: `Snitt ${stats.avgTurns.toFixed(0)} rundor ≈ ${stats.avgMinutes.toFixed(0)} min`,
      suggestion: 'Öka attackstyrka eller minska HP/healing',
      value: stats.avgTurns,
      threshold: 43,
    });
  }

  // ── WARNING: average game < 5 min (~9 rounds) ────────────────────────────
  if (stats.avgTurns < 9) {
    flags.push({
      severity: 'warning',
      category: 'game_length',
      message: 'Spelen är för korta',
      detail: `Snitt ${stats.avgTurns.toFixed(0)} rundor ≈ ${stats.avgMinutes.toFixed(0)} min`,
      suggestion: 'Minska attackstyrka eller öka HP/healing',
      value: stats.avgTurns,
      threshold: 9,
    });
  }

  // ── WARNING: draw rate > 8% ───────────────────────────────────────────────
  if (stats.drawRate > 0.08) {
    flags.push({
      severity: 'warning',
      category: 'game_length',
      message: 'Hög andel oavgjorda spel',
      detail: `${(stats.drawRate * 100).toFixed(1)}% av spelen slutar oavgjort`,
      suggestion: 'Lägg till sudden-death-mekanism eller minska max rundor',
      value: stats.drawRate,
      threshold: 0.08,
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
