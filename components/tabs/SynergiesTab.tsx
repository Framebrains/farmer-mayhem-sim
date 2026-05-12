'use client';

import { useMemo, useState } from 'react';
import { SimulationStats, CardPairStat } from '@/lib/types';
import CardPill from '@/components/ui/CardPill';

function synergyBadge(synergy: number): { label: string; bg: string; text: string } {
  if (synergy >= 1.30) return { label: 'KRAFTIG SYNERGI', bg: 'bg-red-600/80', text: 'text-white' };
  if (synergy >= 1.15) return { label: 'Stark synergi',    bg: 'bg-orange-600/70', text: 'text-white' };
  if (synergy >= 1.05) return { label: 'Lätt synergi',     bg: 'bg-amber-600/60', text: 'text-amber-50' };
  if (synergy >= 0.95) return { label: 'Neutralt',         bg: 'bg-zinc-700', text: 'text-zinc-300' };
  if (synergy >= 0.85) return { label: 'Lätt anti',        bg: 'bg-indigo-700/60', text: 'text-indigo-100' };
  return { label: 'Anti-synergi', bg: 'bg-indigo-900', text: 'text-indigo-200' };
}

export default function SynergiesTab({ stats }: { stats: SimulationStats }) {
  const [showAnti, setShowAnti] = useState(false);
  const expected = 1 / stats.playerCount;
  const minInstances = Math.max(20, Math.floor(stats.totalGames * 0.05));

  const allPairs = useMemo(
    () => Object.values(stats.cardSynergies)
      .filter(p => p.instances >= minInstances)
      .sort((a, b) => b.synergy - a.synergy),
    [stats.cardSynergies, minInstances],
  );

  const top = allPairs.slice(0, 10);
  const bottom = [...allPairs].reverse().slice(0, 10);
  const list = showAnti ? bottom : top;

  const strongSyn = allPairs.filter(p => p.synergy >= 1.15).length;
  const antiSyn = allPairs.filter(p => p.synergy < 0.85).length;
  const topPair = top[0];

  // HEADLINE
  let headline = '';
  let headlineColor = 'border-zinc-700 bg-zinc-800/40';
  let headlineIcon = '🔗';

  if (stats.totalGames < 500) {
    headline = `För få spel för synergianalys — du har ${stats.totalGames}, behövs minst 500. Kör fler simuleringar.`;
    headlineColor = 'border-amber-700 bg-amber-900/20';
    headlineIcon = '⏳';
  } else if (allPairs.length === 0) {
    headline = `Inga kortpar med tillräcklig data (≥${minInstances} observationer) — kör fler spel.`;
  } else if (topPair && topPair.synergy >= 1.30) {
    headline = `${topPair.cardA.replace(/_/g, ' ')} + ${topPair.cardB.replace(/_/g, ' ')} är en KRAFTIG kombination — vinner ×${topPair.synergy.toFixed(2)} mer än det bästa kortet ensamt. Möjligt balansproblem.`;
    headlineColor = 'border-red-700 bg-red-900/30';
    headlineIcon = '🚨';
  } else if (topPair && topPair.synergy >= 1.15) {
    headline = `Bästa kombinationen ger ×${topPair.synergy.toFixed(2)} bättre resultat än solo. Hälsosam nivå — kombo belönas utan att förstöra balansen.`;
    headlineColor = 'border-emerald-700 bg-emerald-900/20';
    headlineIcon = '✓';
  } else {
    headline = `Ingen kortkombination är dramatiskt starkare än sina ingående kort. Kombinationer är balanserade.`;
    headlineColor = 'border-emerald-700 bg-emerald-900/20';
    headlineIcon = '✓';
  }

  if (stats.totalGames === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500 text-sm">Kör en simulering för att se analysen</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADLINE */}
      <div className={`border rounded-xl p-5 ${headlineColor}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{headlineIcon}</span>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-zinc-400 font-semibold mb-1">Slutsats</p>
            <p className="text-base text-zinc-100 leading-relaxed">{headline}</p>
            <p className="text-xs text-zinc-500 mt-2">
              Bayesianskt utjämnat · {allPairs.length} par analyserade · ≥{minInstances} observationer per par
            </p>
          </div>
        </div>
      </div>

      {/* WHAT IS SYNERGY */}
      <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4">
        <p className="text-xs font-semibold text-zinc-300 mb-2">📐 Hur räknar vi synergi?</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          För varje kortpar jämför vi hur ofta spelaren vinner när de använder
          <strong className="text-zinc-300"> båda</strong> korten i samma spel, mot hur ofta de
          vinner med bara det starkaste av de två. Förväntat värde per kort: <strong className="text-zinc-300">{(expected * 100).toFixed(0)}%</strong>.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-[11px]">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-600" /><span className="text-zinc-400">×1.30+ kraftig synergi</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-600" /><span className="text-zinc-400">×1.15+ stark synergi</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-600" /><span className="text-zinc-400">×1.05+ lätt synergi</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-600" /><span className="text-zinc-400">~×1.0 neutralt</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-700" /><span className="text-zinc-400">×0.85- anti-synergi</span></div>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Analyserade par</p>
          <p className="text-2xl font-bold text-white mt-1">{allPairs.length}</p>
        </div>
        <div className="bg-zinc-800 border border-emerald-800 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400">Synergier (×1.15+)</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{strongSyn}</p>
        </div>
        <div className="bg-zinc-800 border border-indigo-800 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-indigo-400">Anti-synergier (×0.85-)</p>
          <p className="text-2xl font-bold text-indigo-300 mt-1">{antiSyn}</p>
        </div>
      </div>

      {/* TOGGLE */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAnti(false)}
          className={`flex-1 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors ${
            !showAnti
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          ⬆ Top {top.length} synergier
        </button>
        <button
          onClick={() => setShowAnti(true)}
          className={`flex-1 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors ${
            showAnti
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          ⬇ Bottom {bottom.length} anti-synergier
        </button>
      </div>

      {/* PAIR LIST */}
      <div className="space-y-2">
        {list.length === 0 ? (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-8 text-center text-sm text-zinc-500">
            Inga par hittades med tillräcklig data.
          </div>
        ) : list.map((pair, i) => {
          const badge = synergyBadge(pair.synergy);
          const pairPct = pair.smoothedWinRate * 100;
          const soloMax = Math.max(pair.soloA, pair.soloB) * 100;
          const lift = ((pair.synergy - 1) * 100);
          return (
            <div
              key={`${pair.cardA}|${pair.cardB}`}
              className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                {/* Rank */}
                <span className="text-xs font-bold text-zinc-500 w-6 text-right">#{i + 1}</span>

                {/* Pair visualization */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <CardPill cardId={pair.cardA} size="md" />
                  <span className="text-zinc-600 font-bold">+</span>
                  <CardPill cardId={pair.cardB} size="md" />
                </div>

                {/* Synergy badge */}
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${badge.bg} ${badge.text} whitespace-nowrap`}>
                  {badge.label}
                </span>

                {/* Synergy number */}
                <div className="text-right flex-shrink-0 w-16">
                  <p className={`text-xl font-bold font-mono ${
                    pair.synergy >= 1.15 ? 'text-emerald-400' :
                    pair.synergy >= 1.05 ? 'text-amber-400' :
                    pair.synergy >= 0.95 ? 'text-zinc-400' :
                    'text-indigo-400'
                  }`}>
                    ×{pair.synergy.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">{lift > 0 ? '+' : ''}{lift.toFixed(0)}% lift</p>
                </div>
              </div>

              {/* Comparison bar: pair vs solo */}
              <div className="ml-9 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <div className="flex justify-between text-zinc-500 mb-0.5">
                    <span>Tillsammans</span>
                    <span className="font-mono text-zinc-300">{pairPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(pairPct * 2, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-zinc-500 mb-0.5">
                    <span>Bästa solo</span>
                    <span className="font-mono text-zinc-400">{soloMax.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-500" style={{ width: `${Math.min(soloMax * 2, 100)}%` }} />
                  </div>
                </div>
              </div>

              <p className="ml-9 text-[10px] text-zinc-600 mt-1.5 font-mono">
                {pair.instances.toLocaleString()} observationer · {pair.wins.toLocaleString()} vinster
              </p>
            </div>
          );
        })}
      </div>

    </div>
  );
}
