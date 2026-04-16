'use client';

import { useState, useCallback } from 'react';
import { SimConfig, SimulationStats } from '@/lib/types';
import { runSimulations } from '@/lib/simulationRunner';
import ConfigPanel from '@/components/ConfigPanel';
import Dashboard from '@/components/Dashboard';

const DEFAULT_CONFIG: SimConfig = {
  playerCount: 3,
  numSimulations: 1000,
  strategies: ['aggressive', 'defensive', 'balanced'],
  deckConfig: { overrides: {} },
};

export default function Home() {
  const [config, setConfig] = useState<SimConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<SimulationStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);
    setStats(null);

    try {
      const result = await runSimulations(config, (completed, total) => {
        setProgress(completed / total);
      });
      setStats(result);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsRunning(false);
      setProgress(1);
    }
  }, [config, isRunning]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Farmer Mayhem
            <span className="text-emerald-500 ml-2">Simulator</span>
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Simulera tusentals spel för att identifiera balansbrister och overpowered kort
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
          {/* Left: config */}
          <div className="lg:sticky lg:top-6">
            <ConfigPanel
              config={config}
              onChange={setConfig}
              onRun={handleRun}
              isRunning={isRunning}
              progress={progress}
            />
          </div>

          {/* Right: dashboard */}
          <div>
            {stats ? (
              <Dashboard stats={stats} />
            ) : (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl flex flex-col items-center justify-center py-24 text-center px-6">
                {isRunning ? (
                  <>
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-zinc-300 font-medium">Simulerar spel...</p>
                    <p className="text-zinc-500 text-sm mt-1">{Math.round(progress * 100)}% klart</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">🐄</div>
                    <h2 className="text-xl font-bold text-white">Redo att simulera</h2>
                    <p className="text-zinc-400 text-sm mt-2 max-w-md">
                      Konfigurera spelet till vänster och tryck på &quot;Kör simulering&quot; för att analysera balansen i Farmer Mayhem.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
