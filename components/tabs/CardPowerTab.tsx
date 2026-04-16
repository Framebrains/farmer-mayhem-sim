'use client';

import { useState } from 'react';
import { SimulationStats, CardStat } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

function cardColor(winCorr: number): string {
  if (winCorr > 0.75) return '#ef4444';
  if (winCorr > 0.5) return '#f97316';
  return '#3b82f6';
}

export default function CardPowerTab({ stats }: { stats: SimulationStats }) {
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = Object.values(stats.cardStats)
    .filter(c => {
      const def = CARD_DATABASE[c.cardId];
      return def && def.type !== 'trap';
    })
    .sort((a, b) => b.winCorrelation - a.winCorrelation);

  const chartData = sorted.map(c => ({
    name: CARD_DATABASE[c.cardId]?.name || c.cardId,
    id: c.cardId,
    winCorr: parseFloat((c.winCorrelation * 100).toFixed(1)),
  }));

  const selectedStat = selected ? stats.cardStats[selected] : null;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Kritisk (&gt;75%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
          Varning (50–75%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
          Normal (&lt;50%)
        </span>
      </div>

      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">Win-korrelation per kort (klicka för detaljer)</h3>
          <span className="text-xs text-zinc-500">Förväntat: {(100 / stats.playerCount).toFixed(0)}% per kort</span>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 22)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 120 }}>
            <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} allowDataOverflow={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              formatter={(v) => [`${v}%`, 'Win-korrelation']}
            />
            <Bar dataKey="winCorr" radius={[0, 4, 4, 0]} maxBarSize={18}
              onClick={(d) => setSelected(d.id ?? null)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={cardColor(entry.winCorr / 100)}
                  opacity={selected && selected !== entry.id ? 0.5 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail card */}
      {selectedStat && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-white">
              {CARD_DATABASE[selectedStat.cardId]?.name || selectedStat.cardId}
            </h3>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-sm">✕</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {[
              { label: 'Draget', value: selectedStat.timesDrawn.toLocaleString() },
              { label: 'Spelat', value: selectedStat.timesPlayed.toLocaleString() },
              { label: 'Play rate', value: `${(selectedStat.playRate * 100).toFixed(1)}%` },
              { label: 'Vinnaren hade kortet', value: selectedStat.winnerHadCard.toLocaleString() },
              { label: 'Win-korrelation', value: `${(selectedStat.winCorrelation * 100).toFixed(1)}%` },
              { label: 'Snitt per spel', value: selectedStat.avgTimesPerGame.toFixed(2) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-zinc-900 rounded-lg p-3">
                <p className="text-xs text-zinc-400">{label}</p>
                <p className="text-lg font-bold text-white mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
