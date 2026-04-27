'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { SimulationStats } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';

// Colour per kill-blow source
function blowColor(cardId: string): string {
  if (cardId === 'c4_goat')       return '#ef4444'; // red — most lethal attack
  if (cardId === 'milking_cow')   return '#f97316'; // orange
  if (cardId === 'unicorn')       return '#a855f7'; // purple
  if (cardId === 'mad_cow')       return '#f59e0b'; // amber — bad luck
  if (cardId === 'haunted_barn')  return '#6366f1'; // indigo — trap
  if (cardId === 'the_sacrifice') return '#ec4899'; // pink — chaos
  return '#10b981';
}

function cardLabel(cardId: string): string {
  return CARD_DATABASE[cardId]?.name ?? cardId;
}

export default function DecisivePlaysTab({ stats }: { stats: SimulationStats }) {
  const totalGames = stats.totalGames;
  const decisiveGames = totalGames - stats.drawCount;

  // ── Kill-blow chart data ──────────────────────────────────
  const blowEntries = Object.entries(stats.killingBlowCounts)
    .map(([id, count]) => ({
      id,
      name: cardLabel(id),
      count,
      pct: decisiveGames > 0 ? parseFloat(((count / decisiveGames) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Draw cause pie data ───────────────────────────────────
  const pieData = [
    { name: 'Tidsgräns (timeout)', value: stats.drawCauses.timeout, fill: '#6366f1' },
    { name: 'Nuke (The Sacrifice)', value: stats.drawCauses.nuke, fill: '#ec4899' },
  ].filter(d => d.value > 0);

  // ── "Deadlock risk" indicator ─────────────────────────────
  const drawPct = (stats.drawRate * 100).toFixed(1);
  const timeoutPct = totalGames > 0
    ? ((stats.drawCauses.timeout / totalGames) * 100).toFixed(1)
    : '0';
  const nukePct = totalGames > 0
    ? ((stats.drawCauses.nuke / totalGames) * 100).toFixed(1)
    : '0';

  const deadlockRisk: 'low' | 'medium' | 'high' =
    stats.drawRate > 0.15 ? 'high' :
    stats.drawRate > 0.06 ? 'medium' : 'low';

  const riskLabel = { low: 'Låg', medium: 'Medel', high: 'Hög' }[deadlockRisk];
  const riskColor = { low: 'text-emerald-400', medium: 'text-yellow-400', high: 'text-red-400' }[deadlockRisk];
  const riskBg   = { low: 'bg-emerald-900/20 border-emerald-700', medium: 'bg-yellow-900/20 border-yellow-700', high: 'bg-red-900/20 border-red-700' }[deadlockRisk];

  if (totalGames === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500 text-sm">Kör en simulering för att se analysen</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Deadlock risk summary ── */}
      <div className={`border rounded-xl p-5 ${riskBg}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-200">Dödlägesrisk</h3>
          <span className={`text-sm font-bold ${riskColor}`}>{riskLabel}</span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">
          {stats.drawCount.toLocaleString()} av {totalGames.toLocaleString()} spel slutade oavgjort ({drawPct}%).
          {stats.drawCauses.timeout > 0 && (
            <> <strong className="text-indigo-400">{timeoutPct}%</strong> orsakades av att spelet nådde tidsgränsen (dödläge).</>
          )}
          {stats.drawCauses.nuke > 0 && (
            <> <strong className="text-pink-400">{nukePct}%</strong> var Nuke-explosioner från The Sacrifice.</>
          )}
        </p>
        {deadlockRisk === 'high' && (
          <p className="text-xs text-red-400 border-l-2 border-red-600 pl-2">
            ⚠️ Hög andel oavgjorda spel indikerar att ingen spelare kan bryta igenom försvararna.
            Överväg att stärka attackkort eller minska max HP.
          </p>
        )}
        {deadlockRisk === 'low' && stats.drawRate > 0 && (
          <p className="text-xs text-emerald-400 border-l-2 border-emerald-700 pl-2">
            ✓ Oavgjordandelen är inom normala gränser — spelet når nästan alltid ett avgörande.
          </p>
        )}
      </div>

      {/* ── Draw cause pie ── */}
      {pieData.length > 0 && stats.drawCount > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Varför slutar spel oavgjort?</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width={200} height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  formatter={(v) => [`${v} spel (${((Number(v) / stats.drawCount) * 100).toFixed(0)}%)`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: d.fill }} />
                  <div>
                    <p className="text-sm text-zinc-200">{d.name}</p>
                    <p className="text-xs text-zinc-500">
                      {d.value} spel · {((d.value / stats.drawCount) * 100).toFixed(0)}% av alla oavgjorda
                    </p>
                  </div>
                </div>
              ))}
              {stats.drawCauses.timeout > 0 && (
                <p className="text-xs text-zinc-500 border-t border-zinc-700 pt-2 mt-2">
                  Timeout = spelet nådde max antal rundor utan att någon vann.
                  Detta indikerar ett defensivt dödläge — ingen kan ta sig igenom.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Killing blow chart ── */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-1">Vilket kort avgör spelet?</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Andel av avgörande spel ({decisiveGames.toLocaleString()} st) där kortet levererade den sista träffen som eliminerade en spelare.
        </p>

        {blowEntries.length === 0 ? (
          <p className="text-xs text-zinc-500">Inga avgörande kort registrerades — kör fler simuleringar.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, blowEntries.length * 42)}>
            <BarChart data={blowEntries} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 130 }}>
              <XAxis
                type="number"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                unit="%"
                domain={[0, 100]}
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
                formatter={(v, _name, props) => [
                  `${v}% (${(props.payload as { count?: number })?.count ?? 0} spel)`,
                  'Andel av avgörande spel',
                ]}
                labelFormatter={(label) => `Kort: ${label}`}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {blowEntries.map((entry, i) => (
                  <Cell key={i} fill={blowColor(entry.id)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Interpretation ── */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-2">
        <p className="text-xs text-zinc-300 font-medium">Hur läser man detta?</p>
        <ul className="text-xs text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
          <li>
            <strong className="text-zinc-200">Killing blow</strong> = vilket kort som faktiskt levererade den sista skadan som eliminerade en spelare och avgjorde spelet.
            Högt värde = kortet är ofta det som <em>stänger</em> spelet.
          </li>
          <li>
            Ett kort kan ha hög <strong className="text-zinc-200">vinstkorrelation</strong> (vinnaren hade det) utan att vara avgörande —
            och ett kort kan vara avgörande utan att synas i vinstkorrelationen.
          </li>
          <li>
            Om ett enda kort dominerar (&gt;60% av spelen) kan det vara ett balanseproblem.
            Om andelen är spridd är spelmekaniken hälsosam.
          </li>
          <li>
            <strong className="text-zinc-200">Dödläge (timeout)</strong> uppstår när ingen kan bryta igenom — ofta för mycket healing eller för svaga attacker.
          </li>
        </ul>
      </div>

    </div>
  );
}
