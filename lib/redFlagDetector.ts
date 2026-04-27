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

  // ── CARD BALANCE FLAGS ─────────────────────────────────────────────────
  //
  // Requirements before flagging a card:
  //   • At least 1 000 simulated games (below this the noise dominates)
  //   • Card played in ≥ 25% of all games (ensures adequate sample)
  //   • winCorrelation uses Bayesian-smoothed values (see dataAggregator)
  //     so survivorship bias from rare cards is already corrected for
  //
  // Thresholds (normalised winCorrelation, 0.5 = balanced):
  //   Critical  > 0.92  → smoothed win rate > 1.85× expected
  //   Warning   < 0.30  → card barely appears in any win

  const MIN_GAMES_FOR_CARD_FLAGS = 1000;
  const MIN_PLAY_FRACTION = 0.25; // card must be played in ≥25% of games

  if (stats.totalGames >= MIN_GAMES_FOR_CARD_FLAGS) {
    for (const [id, card] of Object.entries(stats.cardStats)) {
      const def = CARD_DATABASE[id];
      if (!def || def.type === 'trap' || def.timing === 'automatic') continue;
      if (card.instanceCount < stats.totalGames * MIN_PLAY_FRACTION) continue;

      const smoothedRate = card.winCorrelation * 2 * expected; // display rate

      // Critical: consistently strong across many plays
      if (card.winCorrelation > 0.92) {
        flags.push({
          severity: 'critical',
          category: 'card_balance',
          message: `${def.name} verkar konsekvent för kraftigt`,
          detail: `Justerad vinstfrekvens: ${(smoothedRate * 100).toFixed(0)}% (förväntat: ${(expected * 100).toFixed(0)}%) — baserat på ${card.instanceCount} spel`,
          suggestion: 'Minska antal i leken, justera effekten, eller lägg till motåtgärder',
          value: smoothedRate,
          threshold: expected * 1.85,
        });
      }

      // Weak: frequently played but rarely helps
      if (card.winCorrelation < 0.28 && card.timesPlayed > 0) {
        flags.push({
          severity: 'warning',
          category: 'card_balance',
          message: `${def.name} bidrar sällan till vinst trots hög spelfrekvens`,
          detail: `Justerad vinstfrekvens: ${(smoothedRate * 100).toFixed(0)}% (förväntat: ${(expected * 100).toFixed(0)}%) — baserat på ${card.instanceCount} spel`,
          suggestion: 'Kortet är defensivt/reaktivt eller för svagt — överväg att stärka det',
          value: smoothedRate,
          threshold: expected * 0.55,
        });
      }
    }
  }

  // ── WARNING: play rate < 20% for own-turn cards ──────────────────────
  for (const [id, card] of Object.entries(stats.cardStats)) {
    const def = CARD_DATABASE[id];
    if (!def || def.type === 'trap' || def.timing === 'automatic' || def.timing === 'any_time') continue;
    if (stats.totalGames < 500) continue;
    if (card.timesPlayed < 5) continue;
    if (card.timesDrawn < stats.totalGames * 0.1) continue;
    if (card.playRate < 0.2 && card.timesDrawn > 0) {
      flags.push({
        severity: 'warning',
        category: 'card_balance',
        message: `${def.name} spelas sällan när det dras`,
        detail: `Spelades i ${(card.playRate * 100).toFixed(0)}% av fallen det drogs`,
        suggestion: 'Kortet kan vara svårt att använda eller situationsspecifikt — överväg redesign',
        value: card.playRate,
        threshold: 0.2,
      });
    }
  }

  // ── WARNING: first-mover advantage — only flag with enough data ────────
  // Require 500+ games to avoid noise (53% from 100 games = 5 extra wins = noise)
  if (stats.totalGames >= 500 && stats.winRateByPosition.length > 0) {
    const firstRate = stats.winRateByPosition[0];
    if (firstRate > expected + 0.12) {
      flags.push({
        severity: 'warning',
        category: 'player_balance',
        message: 'Förstadragsfördelar detekterad',
        detail: `Startspelaren vinner ${(firstRate * 100).toFixed(1)}% vs förväntat ${(expected * 100).toFixed(1)}%`,
        suggestion: 'Ge kompensation till senare spelare (fler kort, extra åtgärd)',
        value: firstRate,
        threshold: expected + 0.12,
      });
    }
  }

  // ── WARNING: defensive strategy wins < 40% of expected ──────────────────
  const defRate = stats.winRateByStrategy.defensive;
  if (defRate < expected * 0.4 && stats.totalGames >= 500) {
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
