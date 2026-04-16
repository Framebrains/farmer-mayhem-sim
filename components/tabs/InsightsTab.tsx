'use client';

import { SimulationStats } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';

interface Insight {
  icon: string;
  title: string;
  body: string;
  color: string;
}

function generateInsights(stats: SimulationStats): Insight[] {
  const insights: Insight[] = [];
  const expected = 1 / stats.playerCount;

  // ── Spellängd ────────────────────────────────────────────
  if (stats.avgTurns < 8) {
    insights.push({
      icon: '⚡',
      title: 'Spelen är väldigt korta',
      body: `Snitt ${stats.avgTurns.toFixed(1)} rundor (ca ${stats.avgMinutes.toFixed(0)} min). Det är bra för att hålla energin uppe, men riskerar att slumpen avgör för mycket — enskilda träffar tidigt i spelet kan avgöra hela matchen.`,
      color: 'border-yellow-700 bg-yellow-900/20',
    });
  } else if (stats.avgTurns <= 15) {
    insights.push({
      icon: '✅',
      title: 'Spellängden känns bra',
      body: `Snitt ${stats.avgTurns.toFixed(1)} rundor ≈ ${stats.avgMinutes.toFixed(0)} minuter. Det är ett bra fönster för ett kortspel — tillräckligt långt för strategi, tillräckligt kort för att hålla intresset.`,
      color: 'border-emerald-700 bg-emerald-900/20',
    });
  } else if (stats.avgTurns <= 25) {
    insights.push({
      icon: '⏱️',
      title: 'Spelen är lite långa',
      body: `Snitt ${stats.avgTurns.toFixed(1)} rundor ≈ ${stats.avgMinutes.toFixed(0)} minuter. Det kan fungera men kan bli utdraget om defensiva spelare inte attackeras. Överväg om healing-korten är lite för effektiva.`,
      color: 'border-orange-700 bg-orange-900/20',
    });
  } else {
    insights.push({
      icon: '🐢',
      title: 'Spelen är för långa',
      body: `Snitt ${stats.avgTurns.toFixed(1)} rundor ≈ ${stats.avgMinutes.toFixed(0)} minuter. Det är troligen för länge för ett kortspel. Attackkorten träffar för sällan eller healing sker för ofta.`,
      color: 'border-red-700 bg-red-900/20',
    });
  }

  // ── Starkaste kortet ─────────────────────────────────────
  const playedCards = Object.values(stats.cardStats)
    .filter(c => {
      const def = CARD_DATABASE[c.cardId];
      return def && def.type !== 'trap' && def.timing !== 'automatic' && c.timesPlayed >= stats.totalGames * 0.05;
    });

  if (playedCards.length > 0) {
    const strongest = [...playedCards].sort((a, b) => b.winCorrelation - a.winCorrelation)[0];
    const rawRate = (strongest.winCorrelation * 2 * expected * 100).toFixed(0);
    const name = CARD_DATABASE[strongest.cardId]?.name ?? strongest.cardId;
    if (strongest.winCorrelation > 0.65) {
      insights.push({
        icon: '💪',
        title: `${name} är det starkaste kortet`,
        body: `Spelare som använde ${name} vann i ${rawRate}% av fallen (förväntat: ${(expected * 100).toFixed(0)}%). Det är ${(strongest.winCorrelation / 0.5 * 100 - 100).toFixed(0)}% starkare än förväntat. Kortet är troligtvis bra situationsmässigt — håll koll på om det fortsätter dominera med fler simuleringar.`,
        color: strongest.winCorrelation > 0.9 ? 'border-red-700 bg-red-900/20' : 'border-orange-700 bg-orange-900/20',
      });
    } else {
      insights.push({
        icon: '⚖️',
        title: `${name} är starkast — men rimligt`,
        body: `Spelare som använde ${name} vann i ${rawRate}% av fallen (förväntat: ${(expected * 100).toFixed(0)}%). Inget kort dominerar orimligt — det tyder på bra balans.`,
        color: 'border-emerald-700 bg-emerald-900/20',
      });
    }
  }

  // ── Svagaste kortet ──────────────────────────────────────
  const weakestCandidates = playedCards.filter(c => c.timesPlayed >= stats.totalGames * 0.1);
  if (weakestCandidates.length > 0) {
    const weakest = [...weakestCandidates].sort((a, b) => a.winCorrelation - b.winCorrelation)[0];
    const rawRate = (weakest.winCorrelation * 2 * expected * 100).toFixed(0);
    const name = CARD_DATABASE[weakest.cardId]?.name ?? weakest.cardId;
    if (weakest.winCorrelation < 0.35) {
      insights.push({
        icon: '📉',
        title: `${name} bidrar sällan till vinst`,
        body: `Spelare som använde ${name} vann bara i ${rawRate}% av fallen. Det kan bero på att kortet är reaktivt (spelar försvar, inte offensivt) eller att det spelas i desperation när man redan ligger under. Det behöver inte vara ett problem — vissa kort är stöd-kort.`,
        color: 'border-zinc-600 bg-zinc-800/50',
      });
    }
  }

  // ── Mest spelade kortet ──────────────────────────────────
  const mostPlayed = [...playedCards].sort((a, b) => b.avgTimesPerGame - a.avgTimesPerGame)[0];
  if (mostPlayed && mostPlayed.avgTimesPerGame > 1) {
    const name = CARD_DATABASE[mostPlayed.cardId]?.name ?? mostPlayed.cardId;
    insights.push({
      icon: '🃏',
      title: `${name} är det mest spelade kortet`,
      body: `${name} spelas i snitt ${mostPlayed.avgTimesPerGame.toFixed(1)} gånger per spel. Det är ett centralt kort i spelet — det formar hur partier utspelas.`,
      color: 'border-blue-700 bg-blue-900/20',
    });
  }

  // ── Kort som inte spelas ─────────────────────────────────
  if (stats.totalGames >= 500) {
    const neverPlayed = Object.values(stats.cardStats).filter(c => {
      const def = CARD_DATABASE[c.cardId];
      return def && def.type !== 'trap' && def.timing !== 'automatic'
        && c.timesPlayed === 0 && c.timesDrawn > stats.totalGames * 0.05;
    });
    if (neverPlayed.length > 0) {
      const names = neverPlayed.map(c => CARD_DATABASE[c.cardId]?.name ?? c.cardId).join(', ');
      insights.push({
        icon: '🚫',
        title: 'Dessa kort spelas nästan aldrig',
        body: `${names} drogs men spelades aldrig. Det kan bero på att AI-strategierna inte vet hur de ska användas optimalt, eller att korten är för situationsberoende. Värt att undersöka om reglerna är tillräckligt tydliga.`,
        color: 'border-zinc-600 bg-zinc-800/50',
      });
    }
  }

  // ── Första-spelarfördel ──────────────────────────────────
  if (stats.winRateByPosition.length > 1) {
    const firstRate = stats.winRateByPosition[0];
    const lastRate = stats.winRateByPosition[stats.winRateByPosition.length - 1];
    const spread = firstRate - lastRate;
    if (spread > 0.1) {
      insights.push({
        icon: '🥇',
        title: 'Startspelaren har en fördel',
        body: `Spelare 1 vinner i ${(firstRate * 100).toFixed(1)}% av fallen mot ${(lastRate * 100).toFixed(1)}% för sista spelaren. Det är en skillnad på ${(spread * 100).toFixed(0)} procentenheter. I verkliga spel kan man kompensera med att rotera vem som börjar.`,
        color: 'border-yellow-700 bg-yellow-900/20',
      });
    } else {
      insights.push({
        icon: '⚖️',
        title: 'Startordningen är rättvis',
        body: `Skillnaden mellan bästa och sämsta startposition är bara ${(spread * 100).toFixed(0)} procentenheter. Det tyder på att spelet är väl balanserat oavsett vem som börjar.`,
        color: 'border-emerald-700 bg-emerald-900/20',
      });
    }
  }

  // ── Strategibalans ───────────────────────────────────────
  const strategies = ['aggressive', 'defensive', 'balanced', 'random'] as const;
  const activeStrategies = strategies.filter(s => stats.winsByStrategy[s] > 0);
  if (activeStrategies.length > 1) {
    const rates = activeStrategies.map(s => stats.winRateByStrategy[s]);
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);
    const spread = maxRate - minRate;
    const dominantStrategy = activeStrategies[rates.indexOf(maxRate)];
    const stratLabels: Record<string, string> = { aggressive: 'Aggressiv', defensive: 'Defensiv', balanced: 'Balanserad', random: 'Slumpmässig' };
    if (spread > 0.2) {
      insights.push({
        icon: '🎯',
        title: `${stratLabels[dominantStrategy]} strategi dominerar`,
        body: `${stratLabels[dominantStrategy]} vinner ${(maxRate * 100).toFixed(0)}% av fallen mot ${(minRate * 100).toFixed(0)}% för svagaste strategin — en skillnad på ${(spread * 100).toFixed(0)}pp. Det kan vara normalt om strategierna är valda ojämlikt, men om alla spelar samma strategi bör spridningen vara liten.`,
        color: 'border-orange-700 bg-orange-900/20',
      });
    } else {
      insights.push({
        icon: '🎯',
        title: 'Alla strategier konkurrerar jämnt',
        body: `Skillnaden mellan starkaste och svagaste strategi är bara ${(spread * 100).toFixed(0)}pp. Det tyder på att spelet inte gynnar en specifik spelstil överdrivet.`,
        color: 'border-emerald-700 bg-emerald-900/20',
      });
    }
  }

  // ── Oavgjorda ────────────────────────────────────────────
  if (stats.drawRate > 0.05) {
    insights.push({
      icon: '🤝',
      title: `${(stats.drawRate * 100).toFixed(0)}% av spelen slutar oavgjort`,
      body: `Det är ovanligt högt. Oavgjorda spel uppstår när alla elimineras samtidigt (t.ex. nuke) eller när maxrundor nås. Om det sker ofta p.g.a. maxrundor kan spelet vara för defensivt.`,
      color: 'border-orange-700 bg-orange-900/20',
    });
  }

  return insights;
}

export default function InsightsTab({ stats }: { stats: SimulationStats }) {
  const insights = generateInsights(stats);

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <p className="text-xs text-zinc-400">
          Insikterna är genererade automatiskt från {stats.totalGames.toLocaleString()} simulerade spel med {stats.playerCount} spelare.
          {stats.totalGames < 500 && (
            <span className="text-yellow-400 ml-1">Kör 1 000+ simuleringar för mer tillförlitliga insikter.</span>
          )}
        </p>
      </div>

      {insights.map((insight, i) => (
        <div key={i} className={`border rounded-xl p-5 ${insight.color}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">{insight.icon}</span>
            <div>
              <h3 className="font-semibold text-white mb-1">{insight.title}</h3>
              <p className="text-sm text-zinc-300 leading-relaxed">{insight.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
