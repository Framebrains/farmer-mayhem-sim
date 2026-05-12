'use client';

import { SimulationStats } from '@/lib/types';
import MetricCard from '@/components/ui/MetricCard';
import { wilsonInterval, meanMarginOfError } from '@/lib/confidence';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ErrorBar,
} from 'recharts';

const STRATEGY_LABELS: Record<string, string> = {
  expert: 'Smart',
  aggressive: 'Smart-Aggressiv',
  defensive: 'Smart-Defensiv',
  random: 'Naiv',
};

export default function OverviewTab({ stats }: { stats: SimulationStats }) {
  // Per-position 95% Wilson CI (using observed wins, total = totalGames)
  const positionData = stats.winRateByPosition.map((rate, i) => {
    const wins = stats.winsByPosition[i] ?? Math.round(rate * stats.totalGames);
    const ci = wilsonInterval(wins, stats.totalGames);
    return {
      name: `Pos ${i + 1}`,
      winRate: parseFloat((rate * 100).toFixed(1)),
      // Recharts ErrorBar value: array form for asymmetric, scalar for symmetric
      errorMargin: parseFloat((ci.margin * 100).toFixed(1)),
    };
  });

  const strategyData = Object.entries(stats.winRateByStrategy)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => {
      // Rough strategy CI: approximate sample size based on its share of player slots.
      // strategyGameSlots was used during aggregation but isn't kept; fall back to totalGames * playerCount / activeStrategies
      const wins = stats.winsByStrategy[key as keyof typeof stats.winsByStrategy] ?? 0;
      const totalForStrat = value > 0 ? Math.round(wins / value) : stats.totalGames;
      const ci = wilsonInterval(wins, totalForStrat);
      return {
        name: STRATEGY_LABELS[key] || key,
        winRate: parseFloat((value * 100).toFixed(1)),
        errorMargin: parseFloat((ci.margin * 100).toFixed(1)),
      };
    });

  const expected = 100 / stats.playerCount;

  // ── Card-level CIs for headline metrics ─────────────────
  const drawCI = wilsonInterval(stats.drawCount, stats.totalGames);
  const turnsMargin = meanMarginOfError(stats.turnsStdDev, stats.totalGames);
  const minutesMargin = turnsMargin * (35 / 60);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Snitt-rundor"
          value={stats.avgTurns.toFixed(1)}
          ci={`± ${turnsMargin.toFixed(1)} (95% CI)`}
          subtitle={`Min: ${stats.minTurns} / Max: ${stats.maxTurns} · σ=${stats.turnsStdDev.toFixed(1)}`}
        />
        <MetricCard
          label="Snitt-tid"
          value={`${stats.avgMinutes.toFixed(1)} min`}
          ci={`± ${minutesMargin.toFixed(1)} min`}
          subtitle="Estimat (35 sek/runda)"
        />
        <MetricCard
          label="Simuleringar"
          value={stats.totalGames.toLocaleString()}
          subtitle={`${stats.playerCount} spelare`}
        />
        <MetricCard
          label="Oavgjorda"
          value={`${(stats.drawRate * 100).toFixed(1)}%`}
          ci={`± ${(drawCI.margin * 100).toFixed(1)}%`}
          subtitle={`${stats.drawCount} spel`}
        />
      </div>

      {/* Win rate by position */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">Vinstfrekvens per startposition</h3>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">felstaplar = 95% CI</span>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={positionData} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              labelStyle={{ color: '#e4e4e7' }}
              formatter={(v, _n, p) => {
                const m = (p.payload as { errorMargin?: number })?.errorMargin ?? 0;
                return [`${v}% ± ${m}%`, 'Vinstfrekvens (95% CI)'];
              }}
            />
            <Bar dataKey="winRate" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {positionData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.winRate > expected + 5 ? '#ef4444' : entry.winRate < expected - 5 ? '#3b82f6' : '#10b981'}
                />
              ))}
              <ErrorBar dataKey="errorMargin" width={6} strokeWidth={1.5} stroke="#fafafa" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-500 mt-2">
          Förväntat: {expected.toFixed(1)}% per position (lika fördelning).
          Om felstaplarna OVERLAPPAR med förväntat värde är skillnaden inte statistiskt signifikant.
        </p>
      </div>

      {/* Win rate by strategy */}
      {strategyData.length > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">Vinstfrekvens per strategi</h3>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">felstaplar = 95% CI</span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, strategyData.length * 50)}>
            <BarChart data={strategyData} layout="vertical" margin={{ top: 4, right: 50, bottom: 4, left: 90 }}>
              <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                formatter={(v, _n, p) => {
                  const m = (p.payload as { errorMargin?: number })?.errorMargin ?? 0;
                  return [`${v}% ± ${m}%`, 'Vinstfrekvens (95% CI)'];
                }}
              />
              <Bar dataKey="winRate" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={36}>
                <ErrorBar dataKey="errorMargin" width={6} strokeWidth={1.5} stroke="#fafafa" direction="x" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
