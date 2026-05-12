'use client';

import { SimulationStats, Strategy } from '@/lib/types';
import { wilsonInterval } from '@/lib/confidence';

const STRATEGY_LABELS: Record<Strategy, string> = {
  expert: 'Smart',
  aggressive: 'Smart – Aggressiv',
  defensive: 'Smart – Defensiv',
  random: 'Naiv',
};

const STRATEGY_DESCRIPTIONS: Record<Strategy, string> = {
  expert: 'Den realistiska standardspelaren — väger risk/belöning, sparar resurser',
  aggressive: 'Smart hjärna + offensiv stil — attackerar oftare, jagar killshots',
  defensive: 'Smart hjärna + defensiv stil — attackerar bara från säker position',
  random: 'Slumpmässiga val (baseline-kontroll)',
};

const STRATEGY_ICONS: Record<Strategy, string> = {
  expert: '🧠',
  aggressive: '⚔️',
  defensive: '🛡️',
  random: '🎲',
};

export default function StrategyTab({ stats }: { stats: SimulationStats }) {
  const strategies = ['expert', 'aggressive', 'defensive', 'random'] as Strategy[];
  const expected = 1 / stats.playerCount;

  // Compute per-strategy CIs and rank
  const enriched = strategies.map(s => {
    const wins = stats.winsByStrategy[s];
    const rate = stats.winRateByStrategy[s];
    // Reconstruct sample size from rate (best-effort; matches dataAggregator math)
    const samples = rate > 0 ? Math.round(wins / rate) : 0;
    const ci = samples > 0 ? wilsonInterval(wins, samples) : { centre: 0, margin: 0, low: 0, high: 0 };
    return {
      key: s,
      label: STRATEGY_LABELS[s],
      icon: STRATEGY_ICONS[s],
      desc: STRATEGY_DESCRIPTIONS[s],
      wins,
      rate,
      samples,
      ci,
      active: wins > 0 || rate > 0,
    };
  });

  const active = enriched.filter(e => e.active).sort((a, b) => b.rate - a.rate);
  const ranked = active.map((e, i) => ({ ...e, rank: i + 1 }));

  // Build headline insight
  let headline = '';
  let headlineColor = 'border-zinc-700 bg-zinc-800/40';
  let headlineIcon = '📊';

  if (ranked.length === 0) {
    headline = 'Inga strategier har kört spel ännu — kör en simulering.';
  } else if (ranked.length === 1) {
    headline = `Bara ${ranked[0].label} användes i denna simulering.`;
  } else {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const spread = best.rate - worst.rate;
    if (spread < 0.05) {
      headline = `Alla strategier presterar jämnt (max-min skillnad: ${(spread * 100).toFixed(1)}pp). Spelet är balanserat oavsett spelstil.`;
      headlineColor = 'border-emerald-700 bg-emerald-900/20';
      headlineIcon = '✓';
    } else if (spread < 0.15) {
      headline = `${best.label} är något starkast (${(best.rate * 100).toFixed(0)}%) men skillnaden mot ${worst.label} (${(worst.rate * 100).toFixed(0)}%) är inte dramatisk.`;
      headlineColor = 'border-amber-700 bg-amber-900/20';
      headlineIcon = '⚠️';
    } else {
      headline = `${best.label} dominerar med ${(best.rate * 100).toFixed(0)}% vinstfrekvens — ${((best.rate / worst.rate) || 0).toFixed(1)}× starkare än ${worst.label} (${(worst.rate * 100).toFixed(0)}%). Stor obalans.`;
      headlineColor = 'border-red-700 bg-red-900/30';
      headlineIcon = '🚨';
    }
  }

  if (stats.totalGames === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500 text-sm">Kör en simulering för att se strategianalysen</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADLINE INSIGHT */}
      <div className={`border rounded-xl p-5 ${headlineColor}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{headlineIcon}</span>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-zinc-400 font-semibold mb-1">Slutsats</p>
            <p className="text-base text-zinc-100 leading-relaxed">{headline}</p>
            <p className="text-xs text-zinc-500 mt-2">
              Förväntat per strategi: <strong className="text-zinc-300">{(expected * 100).toFixed(1)}%</strong> ·
              Baserat på {stats.totalGames.toLocaleString()} simulerade spel
            </p>
          </div>
        </div>
      </div>

      {/* RANKED STRATEGY CARDS */}
      <div className="space-y-3">
        {ranked.map(s => {
          const ratePct = s.rate * 100;
          const expectedPct = expected * 100;
          const diff = ratePct - expectedPct;
          const isWinning = diff > 5;
          const isLosing = diff < -5;
          const barColor = isWinning ? 'bg-red-500' : isLosing ? 'bg-blue-500' : 'bg-emerald-500';
          const rankBg =
            s.rank === 1 ? 'bg-yellow-500 text-yellow-950' :
            s.rank === 2 ? 'bg-zinc-400 text-zinc-900' :
            s.rank === 3 ? 'bg-amber-700 text-amber-100' :
            'bg-zinc-700 text-zinc-300';

          return (
            <div
              key={s.key}
              className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Rank badge */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${rankBg}`}>
                  #{s.rank}
                </div>

                {/* Strategy identity */}
                <div className="flex-shrink-0 w-44">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-base font-semibold text-white">{s.label}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">{s.desc}</p>
                </div>

                {/* Bar visualization */}
                <div className="flex-1 min-w-0">
                  <div className="relative h-6 bg-zinc-900 rounded-md overflow-hidden">
                    {/* Expected reference line */}
                    <div
                      className="absolute top-0 bottom-0 border-l-2 border-dashed border-zinc-500"
                      style={{ left: `${expectedPct}%` }}
                    />
                    {/* Win-rate bar */}
                    <div
                      className={`h-full ${barColor} transition-all`}
                      style={{ width: `${Math.min(ratePct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Förväntat {expectedPct.toFixed(0)}% (streckad linje)
                  </p>
                </div>

                {/* Numbers */}
                <div className="flex-shrink-0 text-right">
                  <p className={`text-2xl font-bold font-mono ${
                    isWinning ? 'text-red-400' : isLosing ? 'text-blue-400' : 'text-emerald-400'
                  }`}>
                    {ratePct.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    ± {(s.ci.margin * 100).toFixed(1)}% · {s.wins.toLocaleString()} vinster
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* GLOSSARY */}
      <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4">
        <p className="text-xs font-semibold text-zinc-300 mb-2">Färgkodning</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-zinc-400">Vinner mer än förväntat (&gt;+5pp)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-zinc-400">Balanserat (±5pp av förväntat)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-zinc-400">Vinner mindre än förväntat (&lt;-5pp)</span>
          </div>
        </div>
      </div>

    </div>
  );
}
