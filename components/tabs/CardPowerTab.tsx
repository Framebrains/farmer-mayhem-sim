'use client';

import { useState } from 'react';
import { SimulationStats, CardStat } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

// winCorrelation is Bayesian-smoothed and normalised: 0.5 = balanced
function cardColor(winCorr: number): string {
  if (winCorr >= 0.92) return '#ef4444';  // critical: reliably > 1.85× expected
  if (winCorr >= 0.72) return '#f97316';  // warning: 1.44× expected
  if (winCorr >= 0.35) return '#10b981';  // balanced zone
  return '#6366f1';                        // below expected (weak/defensive)
}

// How reliable is the data for this card?
function confidenceLabel(instanceCount: number, totalGames: number): { label: string; color: string } {
  const pct = instanceCount / totalGames;
  if (pct >= 0.5)  return { label: 'Hög', color: 'text-emerald-400' };
  if (pct >= 0.2)  return { label: 'Medel', color: 'text-yellow-400' };
  if (pct >= 0.05) return { label: 'Låg', color: 'text-orange-400' };
  return { label: 'Mycket låg', color: 'text-red-400' };
}

const EMPTY_STAT: CardStat = {
  cardId: '', timesDrawn: 0, timesPlayed: 0, playRate: 0,
  winnerHadCard: 0, winCorrelation: 0, rawWinRate: 0,
  instanceCount: 0, avgTimesPerGame: 0,
};

export default function CardPowerTab({ stats }: { stats: SimulationStats }) {
  const [selected, setSelected] = useState<string | null>(null);

  const expectedWinRate = 1 / stats.playerCount;

  // Include ALL non-trap cards that have a definition, even if never played
  const allCards = Object.values(CARD_DATABASE).filter(def => def.type !== 'trap');
  const sorted = allCards
    .map(def => stats.cardStats[def.id] ?? { ...EMPTY_STAT, cardId: def.id })
    .sort((a, b) => b.winCorrelation - a.winCorrelation);

  // Display the Bayesian-smoothed win rate as a percentage
  const chartData = sorted.map(c => ({
    name: CARD_DATABASE[c.cardId]?.name || c.cardId,
    id: c.cardId,
    displayRate: parseFloat((c.winCorrelation * 2 * expectedWinRate * 100).toFixed(1)),
    winCorr: c.winCorrelation,
    instanceCount: c.instanceCount ?? 0,
  }));

  const selectedStat = selected ? stats.cardStats[selected] : null;
  const selectedDef = selected ? CARD_DATABASE[selected] : null;

  // Reference lines
  const expectedPct = parseFloat((expectedWinRate * 100).toFixed(1));
  const criticalPct = parseFloat((expectedWinRate * 1.8 * 100).toFixed(1));

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-2">
        <p className="text-xs text-zinc-300 font-medium">Hur läser man grafen?</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Stapeln visar <strong className="text-zinc-200">justerad vinstfrekvens</strong> bland spelare som spelade kortet.
          Förväntat värde = <strong className="text-emerald-400">{expectedPct}%</strong> (1/{stats.playerCount} spelare).
          Värden nära den gröna linjen är balanserade. Kort långt till höger om den orangea linjen ({criticalPct}%) kan vara för kraftiga.
        </p>
        <p className="text-xs text-amber-400/80 leading-relaxed border-l-2 border-amber-600 pl-2">
          <strong>OBS:</strong> Statistiken använder Bayesiansk utjämning — sällsynta kort (t.ex. Unicorn ×7) dras automatiskt mot förväntat värde för att undvika falska alarm.
          Röda flaggor kräver minst 1 000 spel och att kortet spelats i ≥25% av spelen.
          {stats.totalGames < 1000 && (
            <span className="text-orange-400"> Du har {stats.totalGames} spel — kör 1 000+ för tillförlitlig kortanalys.</span>
          )}
        </p>
      </div>

      <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Konsekvent starkt (&gt;{criticalPct}%)</span>
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
              <p className="text-xs text-zinc-500 mt-0.5">{selectedDef.type} · {selectedDef.timing} · {selectedDef.count} st i leken</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-sm px-2 py-1">✕</button>
          </div>

          {/* Confidence indicator */}
          {(() => {
            const conf = confidenceLabel(selectedStat.instanceCount ?? 0, stats.totalGames);
            return (
              <div className="bg-zinc-900 rounded-lg p-3 mb-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-zinc-400">Datakonfidens</p>
                  <p className={`text-sm font-semibold mt-0.5 ${conf.color}`}>{conf.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Spelat av unika spelare</p>
                  <p className="text-sm font-bold text-zinc-300">{selectedStat.instanceCount ?? 0} st ({((selectedStat.instanceCount ?? 0) / stats.totalGames * 100).toFixed(0)}% av spelen)</p>
                </div>
                {(selectedStat.instanceCount ?? 0) < stats.totalGames * 0.2 && (
                  <p className="text-xs text-orange-400 ml-2">⚠️ För lite data — lita inte på vinstfrekvensen</p>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: 'Justerad vinstfrekvens',
                value: `${(selectedStat.winCorrelation * 2 * expectedWinRate * 100).toFixed(1)}%`,
                sub: `förväntat ${(expectedWinRate * 100).toFixed(0)}% · Bayesiansk utjämning`
              },
              {
                label: 'Rå vinstfrekvens',
                value: `${((selectedStat.rawWinRate ?? 0) * 100).toFixed(1)}%`,
                sub: `okorrigerad (kan vara missvisande)`
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
