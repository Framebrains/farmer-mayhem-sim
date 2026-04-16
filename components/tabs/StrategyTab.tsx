'use client';

import { SimulationStats, Strategy } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const STRATEGY_LABELS: Record<Strategy, string> = {
  aggressive: 'Aggressiv',
  defensive: 'Defensiv',
  balanced: 'Balanserad',
  random: 'Slumpmässig',
};

export default function StrategyTab({ stats }: { stats: SimulationStats }) {
  const strategies = ['aggressive', 'defensive', 'balanced', 'random'] as Strategy[];

  const chartData = strategies.map(s => ({
    name: STRATEGY_LABELS[s],
    wins: stats.winsByStrategy[s],
    winRate: parseFloat((stats.winRateByStrategy[s] * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      {/* Bar chart: wins per strategy */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Vinster per strategi</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              labelStyle={{ color: '#e4e4e7' }}
              formatter={(v, name) => [v, name === 'wins' ? 'Vinster' : 'Vinstfrekvens %']}
            />
            <Bar dataKey="wins" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy table */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="text-left text-zinc-400 font-medium px-4 py-3">Strategi</th>
              <th className="text-right text-zinc-400 font-medium px-4 py-3">Vinster</th>
              <th className="text-right text-zinc-400 font-medium px-4 py-3">Vinstfrekvens</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s, i) => (
              <tr key={s} className={i % 2 === 0 ? 'bg-zinc-800' : 'bg-zinc-850'}>
                <td className="px-4 py-3 font-medium text-white">{STRATEGY_LABELS[s]}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{stats.winsByStrategy[s].toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono ${
                    stats.winRateByStrategy[s] > (1 / stats.playerCount) + 0.05
                      ? 'text-red-400'
                      : stats.winRateByStrategy[s] < (1 / stats.playerCount) - 0.05
                        ? 'text-blue-400'
                        : 'text-emerald-400'
                  }`}>
                    {(stats.winRateByStrategy[s] * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-500 px-4 py-2 border-t border-zinc-700">
          Förväntat per strategi: {(100 / stats.playerCount).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
