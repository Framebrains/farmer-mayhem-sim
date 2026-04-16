'use client';

import { SimulationStats } from '@/lib/types';
import MetricCard from '@/components/ui/MetricCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const STRATEGY_LABELS: Record<string, string> = {
  aggressive: 'Aggressiv',
  defensive: 'Defensiv',
  balanced: 'Balanserad',
  random: 'Slumpmässig',
};

export default function OverviewTab({ stats }: { stats: SimulationStats }) {
  const positionData = stats.winRateByPosition.map((rate, i) => ({
    name: `Pos ${i + 1}`,
    winRate: parseFloat((rate * 100).toFixed(1)),
  }));

  const strategyData = Object.entries(stats.winRateByStrategy)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STRATEGY_LABELS[key] || key,
      winRate: parseFloat((value * 100).toFixed(1)),
    }));

  const expected = 100 / stats.playerCount;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Snitt-rundor"
          value={stats.avgTurns.toFixed(1)}
          subtitle={`Min: ${stats.minTurns} / Max: ${stats.maxTurns}`}
        />
        <MetricCard
          label="Snitt-tid"
          value={`${stats.avgMinutes.toFixed(1)} min`}
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
          subtitle={`${stats.drawCount} spel`}
        />
      </div>

      {/* Win rate by position */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Vinstfrekvens per startposition</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={positionData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              labelStyle={{ color: '#e4e4e7' }}
              formatter={(v) => [`${v}%`, 'Vinstfrekvens']}
            />
            {/* Expected line reference */}
            <Bar dataKey="winRate" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {positionData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.winRate > expected + 5 ? '#ef4444' : entry.winRate < expected - 5 ? '#3b82f6' : '#10b981'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-500 mt-2">Förväntat: {expected.toFixed(1)}% per position (lika fördelning)</p>
      </div>

      {/* Win rate by strategy */}
      {strategyData.length > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Vinstfrekvens per strategi</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={strategyData} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 80 }}>
              <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                formatter={(v) => [`${v}%`, 'Vinstfrekvens']}
              />
              <Bar dataKey="winRate" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
