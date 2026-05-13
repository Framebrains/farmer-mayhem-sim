'use client';

import { SimulationStats, Strategy } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';
import { wilsonInterval } from '@/lib/confidence';

// ─────────────────────────────────────────────────────────────────
// ANALYZER — produces a structured "AI report" from a simulation.
// Goal: contextual narrative, not naive stat-regurgitation.
//
// Key design decisions:
//   • Findings are PARAGRAPHS (not bullets) — they read like an analyst's
//     summary, not a dashboard ticker.
//   • EVERY card mentioned in a "high win rate" context gets a structural
//     bias check (Loot the Corpse, Insurance, etc.) so we don't repeat
//     the "Loot är starkaste kortet" howler.
//   • Recommendations are CONCRETE — "halvera Senile Grandma och kör om",
//     not "konsider en buff".
// ─────────────────────────────────────────────────────────────────

type Severity = 'concern' | 'question' | 'positive' | 'recommendation';

interface Finding {
  severity: Severity;
  title: string;
  body: string;
}

/** Cards whose high "win correlation" is structurally biased — they
 *  can ONLY be played in winning trajectories so their stats lie. */
const SELECTION_BIAS_CARDS: Record<string, string> = {
  loot_the_corpse:
    'Loot the Corpse kan bara spelas EFTER att någon redan eliminerats — alltså sent i spel där den som plundrar oftast redan är på väg att vinna. Hög "vinstkorrelation" här är en vinnar-spårsmarkör, inte ett mått på kortets styrka. Räkna det som ett bonuskort, inte ett OP-kort.',
  insurance:
    'Insurance "räknas som använt" först när någon tar dödlig skada. Spelare som vinner utan att hamna i dödsläge räknas alltså aldrig — datapunkten är biased mot överlevare. Att Insurance ser starkt ut är förväntat, inte alarmerande.',
};

/** Cards whose play pattern is defensive/reactive — high win rate may
 *  just reflect that careful players survive longer. */
const REACTIVE_CARDS: Record<string, string> = {
  silvertejp: 'Silvertejp spelas i panik vid 1 HP. Om en spelare hinner använda Silvertejp har de redan överlevt en attack — det säger mer om att de hade tur att överleva än om kortets styrka.',
  senile_grandma: 'Senile Grandma är defensiv — den absorberar en attack. Vinst-korrelation reflekterar troligen en försiktig spelstil, inte kortets råa kraft.',
};

const CARD_NAME = (id: string) => CARD_DATABASE[id]?.name ?? id;

function pct(x: number, decimals = 0): string {
  return `${(x * 100).toFixed(decimals)}%`;
}

function analyze(stats: SimulationStats): { summary: string; findings: Finding[] } {
  const findings: Finding[] = [];
  const expected = 1 / stats.playerCount;
  const decisiveGames = stats.totalGames - stats.drawCount;

  // ── 1. GAME LENGTH ──
  const avgTurns = stats.avgTurns;
  const avgMin = stats.avgMinutes;

  if (avgTurns > 25) {
    findings.push({
      severity: 'concern',
      title: 'Spelen drar ut på tiden',
      body: `Snitt-spelet är ${avgTurns.toFixed(0)} rundor (ca ${avgMin.toFixed(0)} minuter) — det är längre än vad jag skulle kalla bekvämt för ett kortspel av den här typen. ${stats.maxTurns >= 50 ? `Värstafallet kröp upp till ${stats.maxTurns} rundor, vilket är riktigt segt. ` : ''}Den vanligaste orsaken till att spel drar ut är att försvarskorten är för effektiva — God Mode, Redirect, Senile Grandma och Silvertejp i kombination kan göra det nästan omöjligt att leverera en avgörande träff. ${stats.drawCauses.timeout > stats.totalGames * 0.05 ? `Att ${pct(stats.drawCauses.timeout / stats.totalGames)} av spelen når tidsgränsen utan vinnare bekräftar att det finns ett dödlägesproblem.` : ''}`,
    });
  } else if (avgTurns < 8) {
    findings.push({
      severity: 'concern',
      title: 'Spelen är väldigt korta',
      body: `Snitt-spelet är bara ${avgTurns.toFixed(0)} rundor (${avgMin.toFixed(0)} min). I så korta spel hinner spelare knappt hitta sin strategi innan någon dör — tärningens slump avgör mer än taktiken. C4-Goat med 66% träffchans innebär att två snabba träffar i rad kan eliminera en spelare innan denna ens spelat två turer. Det riskerar att kännas orättvist.`,
    });
  } else if (avgTurns >= 12 && avgTurns <= 20) {
    findings.push({
      severity: 'positive',
      title: 'Spellängden är i sweet spot',
      body: `Snitt ${avgTurns.toFixed(0)} rundor (${avgMin.toFixed(0)} min) — det är ett bra fönster. Tillräckligt långt för att strategi ska få betyda något, tillräckligt kort för att hålla intresset uppe. Standardavvikelsen på ${stats.turnsStdDev.toFixed(1)} rundor visar att variationen är ${stats.turnsStdDev < 5 ? 'förutsägbar' : stats.turnsStdDev < 10 ? 'rimlig' : 'ganska stor — vissa spel är dubbelt så långa som andra'}.`,
    });
  }

  // ── 2. DRAW / DEADLOCK ANALYSIS ──
  const drawRate = stats.drawRate;
  if (drawRate > 0.15) {
    findings.push({
      severity: 'concern',
      title: 'Hög andel oavgjorda spel',
      body: `${pct(drawRate, 1)} av spelen slutar oavgjort. Av dessa beror ${pct(stats.drawCauses.timeout / Math.max(1, stats.drawCount))} på att spelet når max-rundor utan vinnare (dödläge) och ${pct(stats.drawCauses.nuke / Math.max(1, stats.drawCount))} på Nuke från The Sacrifice. Hög timeout-andel betyder att spelet kan fastna — spelare slår på varandra utan att någon faktiskt dör. Den vanliga roten är: för mycket healing, för många reaktiva försvar, eller för svaga attacker.`,
    });
  } else if (drawRate > 0.05) {
    findings.push({
      severity: 'question',
      title: `${pct(drawRate, 1)} oavgjorda — gränsfall`,
      body: `Inte alarmerande, men inte ideal heller. ${stats.drawCauses.nuke > 0 ? `${stats.drawCauses.nuke} av dem är Nuke-explosioner (1%-utfallet från The Sacrifice), vilket är ett medvetet "vild kort"-utfall. ` : ''}${stats.drawCauses.timeout > 0 ? `${stats.drawCauses.timeout} är genuint dödläge — något att hålla koll på.` : ''}`,
    });
  } else {
    findings.push({
      severity: 'positive',
      title: 'Nästan inga oavgjorda spel',
      body: `Bara ${pct(drawRate, 1)} av spelen slutar oavgjort. Spelet når nästan alltid ett tydligt avgörande, vilket är vad du vill ha.`,
    });
  }

  // ── 3. FIRST-MOVER ADVANTAGE (with Wilson CI for statistical rigor) ──
  if (stats.winRateByPosition.length > 1 && stats.totalGames >= 200) {
    const firstWins = stats.winsByPosition[0];
    const ci = wilsonInterval(firstWins, stats.totalGames);
    const firstRate = stats.winRateByPosition[0];
    // Significantly more than expected = lower CI bound exceeds expected
    if (ci.low > expected + 0.02) {
      findings.push({
        severity: 'concern',
        title: 'Statistiskt signifikant förstaspelar-fördel',
        body: `Förstaspelaren vinner ${pct(firstRate, 1)} av spelen (95% CI: ${pct(ci.low, 1)}–${pct(ci.high, 1)}), mot förväntat ${pct(expected, 1)} vid perfekt balans. Eftersom hela konfidensintervallet ligger över förväntat-värdet är detta inte slumpvariation — det finns en strukturell fördel med att börja. I verkliga spel kan ni rotera startspelare mellan rundor för att jämna ut, men för matchmaking eller turneringar är detta värt att fixa.`,
      });
    } else if (ci.high < expected - 0.02) {
      findings.push({
        severity: 'question',
        title: 'Förstaspelaren är NACKDELAD',
        body: `Ovanligt: förstaspelaren vinner bara ${pct(firstRate, 1)} (förväntat ${pct(expected, 1)}). Det kan bero på att andra spelare hinner samla in fler kort/försvar innan de attackeras. Värt att undersöka.`,
      });
    } else {
      findings.push({
        severity: 'positive',
        title: 'Startordningen är rättvis',
        body: `Förstaspelaren vinner ${pct(firstRate, 1)} (95% CI: ${pct(ci.low, 1)}–${pct(ci.high, 1)}). Konfidensintervallet överlappar förväntat ${pct(expected, 1)} — alltså ingen statistiskt signifikant fördel åt något håll.`,
      });
    }
  }

  // ── 4. KILL-BLOW DOMINANCE ──
  const blows = Object.entries(stats.killingBlowCounts)
    .sort(([, a], [, b]) => b - a);
  if (blows.length > 0 && decisiveGames >= 100) {
    const [topId, topCount] = blows[0];
    const topPct = topCount / decisiveGames;
    const topName = CARD_NAME(topId);

    if (topPct > 0.7) {
      findings.push({
        severity: 'concern',
        title: `${topName} avgör nästan allt`,
        body: `${pct(topPct)} av alla avgörande spel slutar med att ${topName} levererar dödsstöten. Det är överdrivet centralt — spelets slutskede är förutsägbart. Andra avslutsmekanismer (Mad Cow, Haunted Barn, The Sacrifice's Nuke) bidrar bara marginellt. Det betyder också att om en spelare INTE har ${topName} i sin hand så har de svårt att stänga spel.`,
      });
    } else if (topPct > 0.5) {
      findings.push({
        severity: 'question',
        title: `${topName} är spelets dominanta avslutskort`,
        body: `${pct(topPct)} av avgöranden går via ${topName}. Det är centralt men inte överdrivet — ${blows.slice(1, 3).map(([id, c]) => `${CARD_NAME(id)} (${pct(c / decisiveGames)})`).join(' och ')} bidrar också. Värt att fundera på: är detta för förutsägbart, eller är det önskvärt att en attack-typ är "huvudvägen"?`,
      });
    } else {
      findings.push({
        severity: 'positive',
        title: 'Avgöranden är spridda',
        body: `Inget enskilt kort dominerar avsluten — ${topName} står för ${pct(topPct)}, följt av ${blows.slice(1, 3).map(([id, c]) => `${CARD_NAME(id)} (${pct(c / decisiveGames)})`).join(' och ')}. Det betyder att olika spelhänder leder till olika typer av avslut, vilket är hälsosamt för replay-värde.`,
      });
    }
  }

  // ── 5. SELECTION-BIAS WARNINGS ──
  // Look for cards in the high-win-rate list that have structural bias
  // and surface them as QUESTIONS so the user doesn't misinterpret.
  const highWinrateCards = Object.values(stats.cardStats)
    .filter(c => {
      const def = CARD_DATABASE[c.cardId];
      return def && def.type !== 'trap' && def.timing !== 'automatic'
        && c.instanceCount >= Math.max(20, stats.totalGames * 0.05)
        && c.winCorrelation > 0.6;
    })
    .sort((a, b) => b.winCorrelation - a.winCorrelation);

  const biasedHits = highWinrateCards.filter(c => SELECTION_BIAS_CARDS[c.cardId]);
  if (biasedHits.length > 0) {
    const lines = biasedHits.map(c => {
      const wr = (c.winCorrelation * 2 * expected * 100).toFixed(0);
      return `${CARD_NAME(c.cardId)} (${wr}% vinstfrekvens när spelat): ${SELECTION_BIAS_CARDS[c.cardId]}`;
    });
    findings.push({
      severity: 'question',
      title: 'Statistiska fällor — dessa kort SER starka ut men är det inte',
      body: `Några av siffrorna i kortstatistiken är vilseledande på grund av selektionsbias. ${lines.join(' ')} Lita inte på vinst­korrelationen för dessa kort — titta istället på "Avgörande drag" för att se vilka kort som faktiskt levererar killing blows.`,
    });
  }

  // ── 6. REACTIVE CARDS CONTEXT ──
  const reactiveHits = highWinrateCards.filter(c => REACTIVE_CARDS[c.cardId]);
  if (reactiveHits.length > 0) {
    const lines = reactiveHits.map(c => REACTIVE_CARDS[c.cardId]);
    if (lines.length > 0) {
      findings.push({
        severity: 'question',
        title: 'Defensiva kort ser starka ut — det är vinnar-effekten',
        body: `${reactiveHits.map(c => CARD_NAME(c.cardId)).join(', ')} har hög vinst-korrelation, men dessa är reaktiva kort. ${lines.join(' ')} Vinst-procent reflekterar HUR spelet utvecklade sig, inte hur starkt kortet är i ett vakuum.`,
      });
    }
  }

  // ── 7. UNUSED CARDS — but with smarter context ──
  if (stats.totalGames >= 500) {
    const unused = Object.values(stats.cardStats).filter(c => {
      const def = CARD_DATABASE[c.cardId];
      return def && def.type !== 'trap' && def.timing !== 'automatic'
        && c.timesPlayed === 0 && c.timesDrawn > stats.totalGames * 0.05;
    });

    if (unused.length > 0) {
      const names = unused.map(c => CARD_NAME(c.cardId));
      findings.push({
        severity: 'question',
        title: `AI:n spelade aldrig ${names.length === 1 ? 'detta kort' : 'dessa kort'}`,
        body: `${names.join(', ')} drogs men spelades aldrig av någon smart-strategi. Två tolkningar: (1) korten är situationsspecifika och AI:n hittar aldrig den exakta situationen, eller (2) korten är för svaga / saknar mekanisk poäng. Granska reglerna — om ett kort som ${names[0]} verkligen ska användas men aldrig blir det, är något galet. ${names.includes('The Sacrifice') ? 'The Sacrifice är dock medvetet riskabelt — den smarta AI:n undviker den om den inte är desperat eller har en uppblåst hand, vilket är rimligt.' : ''}`,
      });
    }
  }

  // ── 8. STRATEGY VARIANCE ──
  const allStrategies = ['expert', 'aggressive', 'defensive', 'random'] as Strategy[];
  const active = allStrategies.filter(s => stats.winsByStrategy[s] > 0);
  if (active.length >= 2 && stats.totalGames >= 300) {
    const rates = active.map(s => ({ s, rate: stats.winRateByStrategy[s] }));
    rates.sort((a, b) => b.rate - a.rate);
    const spread = rates[0].rate - rates[rates.length - 1].rate;
    const stratLabel: Record<string, string> = {
      expert: 'Smart', aggressive: 'Smart-Aggressiv',
      defensive: 'Smart-Defensiv', random: 'Naiv',
    };
    if (spread > 0.15) {
      findings.push({
        severity: 'question',
        title: `${stratLabel[rates[0].s]} verkar starkast — men kolla att blandningen är jämn`,
        body: `${stratLabel[rates[0].s]} vinner ${pct(rates[0].rate)} och ${stratLabel[rates[rates.length - 1].s]} bara ${pct(rates[rates.length - 1].rate)} (spridning ${(spread * 100).toFixed(0)}pp). Om alla spelare har samma strategi-typ är detta inte meningsfullt. Om ni KÖR med blandade strategier så betyder spridningen att en spelstil är bättre — antingen är spelet partiskt mot den stilen, eller så är AI:n i den stilen helt enkelt smartare.`,
      });
    } else if (spread <= 0.05 && rates.filter(r => r.s !== 'random').length >= 2) {
      findings.push({
        severity: 'positive',
        title: 'Spelstilarna konkurrerar jämnt',
        body: `Skillnaden mellan starkaste och svagaste smarta strategin är bara ${(spread * 100).toFixed(0)} procentenheter. Det betyder att spelet inte gynnar en specifik stil överdrivet — bra för replay och olika spelartyper.`,
      });
    }
  }

  // ── 9. CONCRETE RECOMMENDATIONS based on identified concerns ──
  const hasLengthConcern = findings.some(f => f.title.includes('drar ut') || f.title.includes('för korta'));
  const hasDrawConcern = findings.some(f => f.title.includes('oavgjorda'));
  const hasFirstMoverConcern = findings.some(f => f.title.includes('förstaspelar'));
  const hasKillDominance = findings.some(f => f.title.includes('avgör nästan allt'));

  if (hasLengthConcern || hasDrawConcern) {
    findings.push({
      severity: 'recommendation',
      title: 'Testa: minska försvarskorten',
      body: `Om spelen drar ut beror det oftast på att försvar slår offensiv. Konkret A/B-test: gå till Kortlek-redigeraren, minska Senile Grandma från 5 till 2 och God Mode från 6 till 4. Kör 1 000 spel. Om snitt-rundor sjunker mot 12–18 och oavgjort-andelen minskar har du hittat din spak. Du kan alltid backa.`,
    });
  }
  if (hasFirstMoverConcern) {
    findings.push({
      severity: 'recommendation',
      title: 'Testa: kompensera senare spelare',
      body: `Vanliga kompensationer för förstaspelar-fördel: (a) senare spelare börjar med +1 kort i starthanden, (b) sista spelaren får dra ett extra kort på första turen, eller (c) startspelaren får INTE attackera på sin första tur. Om du vill prototypa i den här simulatorn så finns det inget direkt verktyg för (a/b/c), men du kan effektivt testa (c) genom att ge första spelaren fler defensiva kort istället.`,
    });
  }
  if (hasKillDominance) {
    findings.push({
      severity: 'recommendation',
      title: 'Testa: balansera den dominerande attacken',
      body: `När en enda attack dominerar avsluten betyder det ofta att den är för stark relativt alternativen. Testa: minska antalet av det dominerande kortet med ~30%, eller höj dess hit-tröskel med 1 (t.ex. C4 från 3+ till 4+). Kör om — om avgörandena sprids bredare, har du jämnat ut spelet.`,
    });
  }

  // ── 10. SUMMARY paragraph (synthesize everything) ──
  const concernCount = findings.filter(f => f.severity === 'concern').length;
  const positiveCount = findings.filter(f => f.severity === 'positive').length;

  let summary: string;
  if (concernCount === 0 && positiveCount >= 2) {
    summary = `Efter ${stats.totalGames.toLocaleString()} simuleringar med ${stats.playerCount} spelare ser balansen bra ut. Spelen tar i snitt ${avgTurns.toFixed(0)} rundor (${avgMin.toFixed(0)} min), startordningen är rättvis, och avgörandena är spridda mellan olika kort. Inga akuta varningssignaler.`;
  } else if (concernCount >= 2) {
    summary = `Efter ${stats.totalGames.toLocaleString()} simuleringar med ${stats.playerCount} spelare har jag hittat ${concernCount} potentiella problem som är värda att titta på. Snittspelet tar ${avgTurns.toFixed(0)} rundor (${avgMin.toFixed(0)} min)${drawRate > 0.05 ? ` och ${pct(drawRate, 1)} slutar oavgjort` : ''}. ${decisiveGames > 0 && blows.length > 0 ? `${CARD_NAME(blows[0][0])} dominerar avsluten med ${pct(blows[0][1] / decisiveGames)} av killing blows. ` : ''}Detaljerna nedan + förslag på vad du kan testa.`;
  } else {
    summary = `Efter ${stats.totalGames.toLocaleString()} simuleringar med ${stats.playerCount} spelare ser det mestadels okej ut, med några frågetecken. Snittspelet är ${avgTurns.toFixed(0)} rundor (${avgMin.toFixed(0)} min). ${decisiveGames > 0 && blows.length > 0 ? `${CARD_NAME(blows[0][0])} står för ${pct(blows[0][1] / decisiveGames)} av avgörandena. ` : ''}Inga akuta krislägen men några saker värda att undersöka.`;
  }

  if (stats.totalGames < 500) {
    summary += ` Notera att datan är preliminär — kör fler simuleringar (5 000+) för säkrare slutsatser.`;
  }

  return { summary, findings };
}

// ─── UI ──────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<Severity, { bg: string; icon: string; label: string }> = {
  concern:        { bg: 'border-red-700 bg-red-950/30',         icon: '🚨', label: 'Bekymmer' },
  question:       { bg: 'border-amber-700 bg-amber-950/20',     icon: '❓', label: 'Att undersöka' },
  positive:       { bg: 'border-emerald-700 bg-emerald-950/20', icon: '✓',  label: 'Fungerar bra' },
  recommendation: { bg: 'border-indigo-700 bg-indigo-950/20',   icon: '💡', label: 'Förslag att testa' },
};

const SECTION_ORDER: Severity[] = ['concern', 'question', 'positive', 'recommendation'];
const SECTION_HEADINGS: Record<Severity, string> = {
  concern: '🚨 Bekymmer',
  question: '❓ Frågor att undersöka',
  positive: '✓ Det som fungerar bra',
  recommendation: '💡 Förslag att testa',
};

export default function InsightsTab({ stats }: { stats: SimulationStats }) {
  if (stats.totalGames === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500 text-sm">Kör en simulering för att se insikter</p>
      </div>
    );
  }

  const { summary, findings } = analyze(stats);

  // Group by severity
  const grouped: Record<Severity, Finding[]> = {
    concern: [], question: [], positive: [], recommendation: [],
  };
  findings.forEach(f => grouped[f.severity].push(f));

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY — the AI's overall verdict in plain Swedish */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">AI-analys</p>
            <p className="text-sm text-zinc-100 leading-relaxed">{summary}</p>
          </div>
        </div>
      </div>

      {/* SECTIONS */}
      {SECTION_ORDER.map(severity => {
        const items = grouped[severity];
        if (items.length === 0) return null;
        return (
          <div key={severity} className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">
              {SECTION_HEADINGS[severity]} <span className="text-zinc-500 font-mono text-xs">({items.length})</span>
            </h3>
            {items.map((f, i) => {
              const s = SEVERITY_STYLE[f.severity];
              return (
                <div key={i} className={`border rounded-xl p-5 ${s.bg}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{s.icon}</span>
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-white mb-2">{f.title}</h4>
                      <p className="text-sm text-zinc-200 leading-relaxed">{f.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Footer */}
      <div className="text-[11px] text-zinc-600 italic text-center pt-2">
        Analysen genereras automatiskt från {stats.totalGames.toLocaleString()} simulerade spel.
        Selektionsbias och statistiska konfidensintervall tas hänsyn till.
      </div>

    </div>
  );
}
