/**
 * Statistical confidence intervals.
 *
 * We use the Wilson score interval for proportions because it's more accurate
 * than the normal approximation (which collapses to "0% ± 0%" when p ≈ 0 or 1
 * and a normal-margin estimate that goes outside [0,1]).
 *
 * Reference: https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval
 */

const Z_95 = 1.96; // 95% confidence

export interface WilsonInterval {
  /** Centre of the interval (Wilson-adjusted, NOT the raw observed rate). */
  centre: number;
  /** Half-width of the interval. */
  margin: number;
  /** Lower bound (centre - margin), clamped to [0, 1]. */
  low: number;
  /** Upper bound (centre + margin), clamped to [0, 1]. */
  high: number;
}

/**
 * Wilson score interval for a binomial proportion.
 * @param successes  Number of successes
 * @param total      Number of trials
 * @param z          z-score (default 1.96 = 95% CI)
 */
export function wilsonInterval(successes: number, total: number, z = Z_95): WilsonInterval {
  if (total === 0) return { centre: 0, margin: 0, low: 0, high: 0 };
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const centre = (p + z2 / (2 * total)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom;
  return {
    centre,
    margin,
    low: Math.max(0, centre - margin),
    high: Math.min(1, centre + margin),
  };
}

/**
 * Format a proportion with its 95% CI margin: "36.2% ± 1.4%".
 * Pass the OBSERVED rate (not the Wilson centre) for the headline number,
 * and only the margin for the ± component, so the visible value matches what
 * users see elsewhere.
 */
export function formatRateCI(observedRate: number, ci: WilsonInterval): string {
  const pct = (observedRate * 100).toFixed(1);
  const mpct = (ci.margin * 100).toFixed(1);
  return `${pct}% ± ${mpct}%`;
}

/**
 * Standard error of the mean for a value (e.g. game length).
 * 95% CI half-width = 1.96 * stdDev / sqrt(n).
 */
export function meanMarginOfError(stdDev: number, n: number, z = Z_95): number {
  if (n <= 1) return 0;
  return (z * stdDev) / Math.sqrt(n);
}

/** Format mean ± margin for a continuous metric: "12.3 ± 0.2 rundor". */
export function formatMeanCI(mean: number, stdDev: number, n: number, unit = '', decimals = 1): string {
  const margin = meanMarginOfError(stdDev, n);
  return `${mean.toFixed(decimals)}${unit} ± ${margin.toFixed(decimals)}${unit}`;
}
