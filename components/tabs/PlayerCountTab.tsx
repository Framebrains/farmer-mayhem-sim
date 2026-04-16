'use client';

import { SimulationStats } from '@/lib/types';
import MetricCard from '@/components/ui/MetricCard';

interface PlayerCountTabProps {
  currentStats: SimulationStats;
  savedRuns: SimulationStats[];
  onSave: () => void;
  onClear: () => void;
}

export default function PlayerCountTab({ currentStats, savedRuns, onSave, onClear }: PlayerCountTabProps) {
  const allRuns = savedRuns.includes(currentStats)
    ? savedRuns
    : [currentStats, ...savedRuns];
  const displayed = allRuns.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={savedRuns.includes(currentStats) || savedRuns.length >= 3}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Spara denna körning
        </button>
        {savedRuns.length > 0 && (
          <button
            onClick={onClear}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
          >
            Rensa sparade
          </button>
        )}
        <span className="text-xs text-zinc-500">{savedRuns.length}/3 sparade</span>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {displayed.map((run, i) => (
          <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">{run.playerCount} spelare</h3>
              {i === 0 && !savedRuns.includes(currentStats) && (
                <span className="text-xs bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded-full">Aktuell</span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-300">
                <span className="text-zinc-400">Snitt-rundor</span>
                <span>{run.avgTurns.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span className="text-zinc-400">Snitt-tid</span>
                <span>{run.avgMinutes.toFixed(1)} min</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span className="text-zinc-400">Oavgjorda</span>
                <span>{(run.drawRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span className="text-zinc-400">Simuleringar</span>
                <span>{run.totalGames.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span className="text-zinc-400">Röda flaggor</span>
                <span className={run.redFlags.filter(f => f.severity === 'critical').length > 0 ? 'text-red-400' : 'text-zinc-300'}>
                  {run.redFlags.filter(f => f.severity === 'critical').length} kritiska
                </span>
              </div>
            </div>
            {/* Win by position */}
            <div className="pt-2 border-t border-zinc-700">
              <p className="text-xs text-zinc-500 mb-2">Vinster per position</p>
              <div className="flex gap-1">
                {run.winRateByPosition.map((rate, pos) => (
                  <div key={pos} className="flex-1 text-center">
                    <div
                      className="bg-indigo-600 rounded-sm mx-auto mb-1"
                      style={{ height: `${Math.max(4, rate * 80)}px`, minWidth: '8px' }}
                    />
                    <span className="text-xs text-zinc-500">{pos + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
