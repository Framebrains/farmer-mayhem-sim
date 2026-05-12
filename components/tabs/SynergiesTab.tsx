'use client';

import { useMemo, useState } from 'react';
import { SimulationStats, CardPairStat } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';

function cardName(id: string): string {
  return CARD_DATABASE[id]?.name ?? id;
}

// Severity colours
function synergyColor(synergy: number): string {
  if (synergy >= 1.30) return 'bg-red-600/40 text-red-100 border-red-600';
  if (synergy >= 1.15) return 'bg-orange-600/40 text-orange-100 border-orange-600';
  if (synergy >= 1.05) return 'bg-amber-600/30 text-amber-100 border-amber-600';
  if (synergy >= 0.95) return 'bg-zinc-700/40 text-zinc-300 border-zinc-600';
  if (synergy >= 0.85) return 'bg-indigo-700/30 text-indigo-200 border-indigo-700';
  return 'bg-indigo-900/40 text-indigo-300 border-indigo-800';
}

function synergyLabel(synergy: number): string {
  if (synergy >= 1.30) return 'KRAFTIG SYNERGI';
  if (synergy >= 1.15) return 'Stark synergi';
  if (synergy >= 1.05) return 'Lätt synergi';
  if (synergy >= 0.95) return 'Neutralt';
  if (synergy >= 0.85) return 'Lätt anti-synergi';
  return 'Anti-synergi';
}

export default function SynergiesTab({ stats }: { stats: SimulationStats }) {
  const [showAntiSynergy, setShowAntiSynergy] = useState(false);
  const expectedWinRate = 1 / stats.playerCount;

  // Filter: need enough samples and at least one card must be playable
  // Min instances scales with game count
  const minInstances = Math.max(20, Math.floor(stats.totalGames * 0.05));

  const allPairs: CardPairStat[] = useMemo(
    () => Object.values(stats.cardSynergies)
      .filter(p => p.instances >= minInstances)
      .sort((a, b) => b.synergy - a.synergy),
    [stats.cardSynergies, minInstances]
  );

  const topSynergies = allPairs.slice(0, 12);
  const antiSynergies = [...allPairs].reverse().slice(0, 12);

  const list = showAntiSynergy ? antiSynergies : topSynergies;

  // Stats summary
  const strongSynergies = allPairs.filter(p => p.synergy >= 1.15).length;
  const antiCount = allPairs.filter(p => p.synergy < 0.85).length;

  if (stats.totalGames < 500) {
    return (
      <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-amber-300 mb-2">⚠️ För få spel för synergianalys</h3>
        <p className="text-xs text-amber-100/80 leading-relaxed">
          Synergianalys behöver minst 500 spel för att vara tillförlitlig — du har {stats.totalGames}.
          Kör fler simuleringar för att se kortkombinationsanalysen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Intro */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-zinc-200">Vad är kortsynergier?</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Vi tittar på <strong className="text-zinc-200">par av kort som spelas tillsammans</strong> av samma spelare i samma spel,
          och jämför deras vinstfrekvens med vad varje kort skulle ge ensam.
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          <strong className="text-emerald-400">Synergi &gt; 1.0</strong> = paret vinner OFTARE än det starkaste kortet ensamt (äkta synergi).
          <strong className="text-indigo-400 ml-2">Synergi &lt; 1.0</strong> = paret presterar SÄMRE än de bästa kortet ensamt (kanske överflödigt eller motverkande).
        </p>
        <p className="text-xs text-zinc-500 italic">
          Alla siffror Bayesianskt utjämnade. Visar bara par med ≥ {minInstances} observationer.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-center">
          <p className="text-xs text-zinc-500">Analyserade par</p>
          <p className="text-2xl font-bold text-white mt-1">{allPairs.length}</p>
        </div>
        <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-3 text-center">
          <p className="text-xs text-emerald-400">Synergier ≥ 1.15</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{strongSynergies}</p>
        </div>
        <div className="bg-indigo-900/20 border border-indigo-700 rounded-lg p-3 text-center">
          <p className="text-xs text-indigo-400">Anti-synergier &lt; 0.85</p>
          <p className="text-2xl font-bold text-indigo-300 mt-1">{antiCount}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-center">
          <p className="text-xs text-zinc-500">Förväntat per kort</p>
          <p className="text-2xl font-bold text-zinc-300 mt-1">{(expectedWinRate * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAntiSynergy(false)}
          className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
            !showAntiSynergy
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          ⬆ Top synergier
        </button>
        <button
          onClick={() => setShowAntiSynergy(true)}
          className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
            showAntiSynergy
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          ⬇ Anti-synergier
        </button>
      </div>

      {/* List */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-700 bg-zinc-800/80">
          <h3 className="text-sm font-semibold text-zinc-200">
            {showAntiSynergy
              ? `${list.length} svagaste kombinationer`
              : `${list.length} starkaste kombinationer`}
          </h3>
        </div>

        {list.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-sm">
            Inga par hittades med tillräckligt med data.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-700/60">
            {list.map(pair => {
              const pairKey = `${pair.cardA}|${pair.cardB}`;
              const pairPct = (pair.smoothedWinRate * 100).toFixed(1);
              const soloAPct = (pair.soloA * 100).toFixed(1);
              const soloBPct = (pair.soloB * 100).toFixed(1);
              const synergyPct = ((pair.synergy - 1) * 100);
              const lift = synergyPct > 0 ? `+${synergyPct.toFixed(0)}%` : `${synergyPct.toFixed(0)}%`;

              return (
                <li key={pairKey} className="px-4 py-3 hover:bg-zinc-800/60 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">
                          {cardName(pair.cardA)}
                        </span>
                        <span className="text-zinc-500">+</span>
                        <span className="text-sm font-semibold text-white">
                          {cardName(pair.cardB)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${synergyColor(pair.synergy)}`}>
                          {synergyLabel(pair.synergy)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Tillsammans: <strong className="text-zinc-300">{pairPct}%</strong>
                        <span className="mx-1">·</span>
                        Solo: {soloAPct}% / {soloBPct}%
                        <span className="mx-1">·</span>
                        {pair.instances.toLocaleString()} obs
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-mono font-bold ${
                        pair.synergy >= 1.15 ? 'text-emerald-400' :
                        pair.synergy >= 1.05 ? 'text-amber-400' :
                        pair.synergy >= 0.95 ? 'text-zinc-400' :
                        'text-indigo-400'
                      }`}>
                        ×{pair.synergy.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {lift} vs solo
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Interpretation */}
      <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 space-y-2">
        <p className="text-xs text-zinc-300 font-medium">Hur tolkar man detta?</p>
        <ul className="text-xs text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
          <li>
            <strong className="text-emerald-400">×1.25 synergi</strong> = paret vinner 25% oftare än det starkaste kortet skulle göra ensamt. Stark kombination.
          </li>
          <li>
            <strong className="text-indigo-400">×0.80 anti-synergi</strong> = paret vinner 20% mindre än det starkaste ensamt. Kombinationen är överflödig eller konflikterande.
          </li>
          <li>
            Stark synergi i ett spel är inte alltid dåligt — men om EN kombination dominerar (t.ex. C4 + Oppenheimer ×1.50) kan det vara en balans-fråga.
          </li>
          <li>
            Anti-synergier kan indikera att korten konkurrerar om samma resurser (t.ex. båda försvarar) eller att en spelare som drar båda inte hinner använda dem.
          </li>
        </ul>
      </div>

    </div>
  );
}
