'use client';

import { SimulationStats } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';
import CardPill from '@/components/ui/CardPill';

function cardLabel(id: string): string {
  return CARD_DATABASE[id]?.name ?? id;
}

export default function DecisivePlaysTab({ stats }: { stats: SimulationStats }) {
  const totalGames = stats.totalGames;
  const decisiveGames = totalGames - stats.drawCount;

  if (totalGames === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500 text-sm">Kör en simulering för att se analysen</p>
      </div>
    );
  }

  // Sorted kill-blow data
  const blows = Object.entries(stats.killingBlowCounts)
    .map(([id, count]) => ({
      id,
      name: cardLabel(id),
      count,
      pct: decisiveGames > 0 ? (count / decisiveGames) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topBlow = blows[0];
  const totalBlows = blows.reduce((s, b) => s + b.count, 0);
  const drawPct = stats.drawRate * 100;
  const timeoutPct = totalGames > 0 ? (stats.drawCauses.timeout / totalGames) * 100 : 0;
  const nukePct = totalGames > 0 ? (stats.drawCauses.nuke / totalGames) * 100 : 0;

  // Deadlock risk classification
  const deadlockRisk: 'low' | 'medium' | 'high' =
    stats.drawRate > 0.15 ? 'high' :
    stats.drawRate > 0.06 ? 'medium' : 'low';

  // HEADLINE
  let headline = '';
  let headlineColor = 'border-zinc-700 bg-zinc-800/40';
  let headlineIcon = '📊';

  if (decisiveGames < 100) {
    headline = `För få avgörande spel (${decisiveGames}) för en pålitlig analys. Kör fler simuleringar.`;
  } else if (topBlow && topBlow.pct > 70) {
    headline = `${topBlow.name} avgör ${topBlow.pct.toFixed(0)}% av alla spel. Detta är extremt dominant — andra avslut sker nästan aldrig.`;
    headlineColor = 'border-red-700 bg-red-900/30';
    headlineIcon = '🚨';
  } else if (topBlow && topBlow.pct > 50) {
    headline = `${topBlow.name} avgör mer än hälften (${topBlow.pct.toFixed(0)}%) av alla spel. Spelets slutskede är förutsägbart.`;
    headlineColor = 'border-orange-700 bg-orange-900/20';
    headlineIcon = '⚠️';
  } else if (deadlockRisk === 'high') {
    headline = `${drawPct.toFixed(0)}% av spelen slutar oavgjort — hög risk för dödläge. ${timeoutPct.toFixed(0)}% beror på att max-rundor nås.`;
    headlineColor = 'border-red-700 bg-red-900/30';
    headlineIcon = '🚨';
  } else if (topBlow) {
    headline = `Spelets avslut är hälsosamt spritt — ${topBlow.name} är vanligast (${topBlow.pct.toFixed(0)}%) men flera kort avgör spel regelbundet.`;
    headlineColor = 'border-emerald-700 bg-emerald-900/20';
    headlineIcon = '✓';
  } else {
    headline = 'Inga avgörande slag registrerades — kör fler spel.';
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
          </div>
        </div>
      </div>

      {/* KEY METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Avgörande spel</p>
          <p className="text-3xl font-bold text-white mt-1">{decisiveGames.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500 mt-1">{((decisiveGames / totalGames) * 100).toFixed(0)}% av alla spel</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Oavgjorda</p>
          <p className={`text-3xl font-bold mt-1 ${
            deadlockRisk === 'high' ? 'text-red-400' : deadlockRisk === 'medium' ? 'text-yellow-400' : 'text-emerald-400'
          }`}>{drawPct.toFixed(1)}%</p>
          <p className="text-[10px] text-zinc-500 mt-1">{stats.drawCount.toLocaleString()} spel</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Dödläge (timeout)</p>
          <p className="text-3xl font-bold text-indigo-300 mt-1">{timeoutPct.toFixed(1)}%</p>
          <p className="text-[10px] text-zinc-500 mt-1">{stats.drawCauses.timeout.toLocaleString()} spel</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Nuke-explosioner</p>
          <p className="text-3xl font-bold text-pink-300 mt-1">{nukePct.toFixed(1)}%</p>
          <p className="text-[10px] text-zinc-500 mt-1">{stats.drawCauses.nuke.toLocaleString()} spel</p>
        </div>
      </div>

      {/* KILLING BLOW RANKING */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Vad avgör spelen?</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Kortet som levererade den sista skadan som eliminerade en spelare.
            </p>
          </div>
          <span className="text-xs text-zinc-500">{totalBlows.toLocaleString()} avslut analyserade</span>
        </div>

        {blows.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">Inga avgörande slag registrerades.</p>
        ) : (
          <div className="space-y-2">
            {blows.map(blow => {
              const isDominant = blow.pct > 50;
              const isSignificant = blow.pct > 20;
              const barColor = isDominant ? 'bg-red-500' : isSignificant ? 'bg-orange-500' : 'bg-emerald-500';
              return (
                <div key={blow.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-40">
                    <CardPill cardId={blow.id} size="md" />
                  </div>
                  <div className="flex-1 relative h-6 bg-zinc-900 rounded-md overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all`}
                      style={{ width: `${blow.pct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-xs font-mono font-bold text-white">
                      {blow.pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-20 text-right">
                    <p className="text-sm text-zinc-300 font-mono">{blow.count.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-500">avslut</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DRAW BREAKDOWN — only show if draws happened */}
      {stats.drawCount > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-1">Varför slutar spel oavgjort?</h3>
          <p className="text-xs text-zinc-500 mb-4">
            Två orsaker till oavgjort: spelet når max antal rundor (dödläge) eller Nuke från The Sacrifice (alla dör).
          </p>
          <div className="space-y-3">
            {stats.drawCauses.timeout > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-semibold text-indigo-300">⏱️ Tidsgräns (dödläge)</span>
                  <span className="text-sm text-zinc-400 font-mono">
                    {stats.drawCauses.timeout.toLocaleString()} ({((stats.drawCauses.timeout / stats.drawCount) * 100).toFixed(0)}% av alla oavgjorda)
                  </span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-md overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${(stats.drawCauses.timeout / stats.drawCount) * 100}%` }} />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Spelet nådde max-rundor utan att någon vann — ofta för mycket healing eller för svaga attacker.
                </p>
              </div>
            )}
            {stats.drawCauses.nuke > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-semibold text-pink-300">💥 Nuke (The Sacrifice)</span>
                  <span className="text-sm text-zinc-400 font-mono">
                    {stats.drawCauses.nuke.toLocaleString()} ({((stats.drawCauses.nuke / stats.drawCount) * 100).toFixed(0)}% av alla oavgjorda)
                  </span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-md overflow-hidden">
                  <div className="h-full bg-pink-500" style={{ width: `${(stats.drawCauses.nuke / stats.drawCount) * 100}%` }} />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  En spelare snurrade hjulet och fick Nuke (~1% chans). Alla dog.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
