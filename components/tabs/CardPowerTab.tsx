'use client';

import { useState } from 'react';
import { SimulationStats } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

// winCorrelation is normalised: 0.5 = balanced, 0.9+ = critical, 0 = never wins
function cardColor(winCorr: number): string {
  if (winCorr >= 0.9) return '#ef4444';   // critical: 1.8× expected
  if (winCorr >= 0.7) return '#f97316';   // warning: 1.4× expected
  if (winCorr >= 0.35) return '#10b981';  // balanced zone
  return '#6366f1';                        // below expected (weak/defensive)
}

export default function CardPowerTab({ stats }: { stats: SimulationStats }) {
  const [selected, setSelected] = useState<string | null>(null);

  const expectedWinRate = 1 / stats.playerCount;

  // Include ALL non-trap cards that have a definition, even if never played
  const allCards = Object.values(CARD_DATABASE).filter(def => def.type !== 'trap');
  const sorted = allCards
    .map(def => stats.cardStats[def.id] ?? {
      cardId: def.id, timesDrawn: 0, timesPlayed: 0, playRate: 0,
      winnerHadCard: 0, winCorrelation: 0, avgTimesPerGame: 0,
    })
    .sort((a, b) => b.winCorrelation - a.winCorrelation);

  // winCorrelation 0.5 = expectedWinRate, displayed as percentage of that scale
  const chartData = sorted.map(c => ({
    name: CARD_DATABASE[c.cardId]?.name || c.cardId,
    id: c.cardId,
    // Display as actual win rate % (0.5 normalised → expectedWinRate * 100)
    displayRate: parseFloat((c.winCorrelation * 2 * expectedWinRate * 100).toFixed(1)),
    winCorr: c.winCorrelation,
  }));

  const selectedStat = selected ? stats.cardStats[selected] : null;
  const selectedDef = selected ? CARD_DATABASE[selected] : null;

  // Reference lines
  const expectedPct = parseFloat((expectedWinRate * 100).toFixed(1));
  const criticalPct = parseFloat((expectedWinRate * 1.8 * 100).toFixed(1));

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <p className="text-xs text-zinc-300 font-medium mb-2">Hur läser man grafen?</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Stapeln visar <strong className="text-zinc-200">vinstfrekvens bland spelare som spelade kortet</strong>.
          Förväntat värde = <strong className="text-emerald-400">{expectedPct}%</strong> (1/{stats.playerCount} spelare).
          Ett balanserat kort hamnar nära den gröna linjen. Kort långt till höger om den orangea linjen ({criticalPct}%) kan vara för kraftiga.
        </p>
      </div>

      <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Potentiellt OP (&gt;{criticalPct}%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />Starkare än förväntat</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Balanserat (~{expectedPct}%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />Svagare/reaktivt</span>
      </div>

      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Vinstfrekvens per kort (klicka för detaljer)</h3>
        <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 23)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 130 }}>
            <XAxis
              type="number"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              unit="%"
              domain={[0, Math.max(criticalPct * 1.2, 60)]}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              formatter={(v) => [`${v}%`, 'Vinstfrekvens när spelat']}
              labelFormatter={(label) => `Kort: ${label}`}
            />
            {/* Expected win rate line */}
            <ReferenceLine
              x={expectedPct}
              stroke="#10b981"
              strokeDasharray="4 3"
              label={{ value: `Förväntat ${expectedPct}%`, fill: '#10b981', fontSize: 10, position: 'top' }}
            />
            {/* Critical threshold line */}
            <ReferenceLine
              x={criticalPct}
              stroke="#f97316"
              strokeDasharray="4 3"
              label={{ value: `Kritisk ${criticalPct}%`, fill: '#f97316', fontSize: 10, position: 'top' }}
            />
            <Bar dataKey="displayRate" radius={[0, 4, 4, 0]} maxBarSize={18}
              onClick={(d) => setSelected(d.id ?? null)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={cardColor(entry.winCorr)}
                  opacity={selected && selected !== entry.id ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail panel */}
      {selectedStat && selectedDef && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-white text-lg">{selectedDef.name}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{selectedDef.type} · {selectedDef.timing}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-sm px-2 py-1">✕</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: 'Estimerat draget',
                value: selectedStat.timesDrawn.toLocaleString(),
                sub: 'gånger totalt'
              },
              {
                label: 'Totalt spelat',
                value: selectedStat.timesPlayed.toLocaleString(),
                sub: 'spelhändelser'
              },
              {
                label: 'Play rate',
                value: `${(selectedStat.playRate * 100).toFixed(1)}%`,
                sub: 'spelas när det dras'
              },
              {
                label: 'Vinstfrekvens när spelat',
                value: `${(selectedStat.winCorrelation * 2 * expectedWinRate * 100).toFixed(1)}%`,
                sub: `förväntat ${(expectedWinRate * 100).toFixed(0)}%`
              },
              {
                label: 'Vinster med kortet',
                value: selectedStat.winnerHadCard.toLocaleString(),
                sub: 'spelarsegrar'
              },
              {
                label: 'Snitt per spel',
                value: selectedStat.avgTimesPerGame.toFixed(2),
                sub: 'gånger spelat'
              },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-zinc-900 rounded-lg p-3">
                <p className="text-xs text-zinc-400">{label}</p>
                <p className="text-xl font-bold text-white mt-1">{value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
