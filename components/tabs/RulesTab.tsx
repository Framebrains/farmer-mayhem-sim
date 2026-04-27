'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── TYPES ───────────────────────────────────────────────────

type Status = 'correct' | 'wrong' | 'unknown';

interface RuleEntry {
  id: string;
  title: string;
  simBehavior: string;
  assumption?: string;
  note?: string;
}

interface RuleSection {
  id: string;
  icon: string;
  heading: string;
  rules: RuleEntry[];
}

// ─── DATA ────────────────────────────────────────────────────

const SECTIONS: RuleSection[] = [
  {
    id: 'setup',
    icon: '🎴',
    heading: 'Spelupplägg',
    rules: [
      {
        id: 'setup_hp',
        title: 'Startliv (HP)',
        simBehavior: 'Varje spelare börjar med 2 HP.',
        assumption: 'Maximalt liv är 2 HP — kan inte läkas över 2.',
      },
      {
        id: 'setup_hand',
        title: 'Starthand',
        simBehavior: 'Varje spelare delar ut 7 kort från den blandade leken.',
        assumption: 'Om Mad Cow råkar delas ut under deal-fasen läggs kortet tillbaka och ett nytt dras.',
      },
      {
        id: 'setup_deck',
        title: 'Lekens sammansättning',
        simBehavior: 'Kortlek byggs med alla kort inklusive Insurance. Händerna delas ut (7 kort var). Sedan blandas Mad Cow (×3) in i resterande kortlek. Insurance är ett vanligt handkort — hamnar i handen om man drar det.',
        assumption: 'Bara Mad Cow blandas in efter utdelning. Insurance är alltid i leken från start och hamnar i spelarens hand.',
      },
      {
        id: 'setup_turnorder',
        title: 'Spelordning — tärningskast',
        simBehavior: 'Alla spelare kastar en tärning. Den med högst kast börjar. Vid lika kastas om tills en vinnare finns. Sedan fortsätter spelet medsols.',
        assumption: 'Simulerat med rollDice() per spelare, omgångarna upprepas vid oavgjort.',
      },
    ],
  },
  {
    id: 'turn',
    icon: '🔄',
    heading: 'Turstruktur',
    rules: [
      {
        id: 'turn_stopit',
        title: 'Fas 1 — Stop It-kontroll',
        simBehavior: 'Innan aktiv spelare agerar: kontrolleras om någon motspelare vill spela Stop It. Om ja → aktiv spelares tur hoppas över direkt till dragfasen.',
        assumption: 'Stop It avbryter HELA turens spelkortsfas. Motspelare kan bara spela det om deras strategi säger att det är värt det.',
      },
      {
        id: 'turn_specialty',
        title: 'Fas 2 — Spela specialkort (own_turn)',
        simBehavior: 'Aktiv spelare spelar alla "own_turn"-specialkort som strategin väljer ut. Varje sådant kort kan nopas av God Mode om kortet är nopbart.',
        assumption: 'Spelare kan spela flera specialkort per tur, i den ordning strategin väljer.',
      },
      {
        id: 'turn_attack',
        title: 'Fas 3 — Attack',
        simBehavior: 'Spelare väljer ett attackkort och ett mål. Motspelare kan reagera med God Mode / Redirect / Wrong Goat (se attackkedjan). Sedan slås tärningen.',
        assumption: 'Spelare spelar max ett attackkort per tur.',
      },
      {
        id: 'turn_draw',
        title: 'Fas 4 — Dra kort',
        simBehavior: 'Aktiv spelare drar ett kort. Om Mad Cow dras hanteras den direkt (tärningsslag) och läggs i kasthögen utan att hamna i handen.',
        assumption: 'Man drar alltid exakt 1 kort per tur, oavsett hur många kort man spelade.',
      },
      {
        id: 'turn_haunted',
        title: 'Fas 5 — Haunted Barn-kontroll',
        simBehavior: 'I slutet av aktiv spelares tur: om Haunted Barn är placerat på deras gård OCH de har < 2 kort på hand → tar 1 HP skada och Haunted Barn tas bort.',
        assumption: 'Kontroll sker i slutet av TUR, inte runda.',
      },
      {
        id: 'turn_maxturns',
        title: 'Max antal turer',
        simBehavior: 'Om spelet når 200 individuella turer avslutas det som oavgjort.',
        assumption: 'Skydd mot oändliga spel — motsvarar ca 66 rundor i ett 3-spelarspel.',
      },
    ],
  },
  {
    id: 'attacks',
    icon: '⚔️',
    heading: 'Attackkort',
    rules: [
      {
        id: 'atk_c4',
        title: 'C4-Goat (×18)',
        simBehavior: 'Spelas mot valfri spelare. Tärning slås — träff om ≥ 3 (4 av 6 sidor). Träff = 1 HP skada.',
        assumption: 'Träffchans: 4/6 = 66,7 %',
      },
      {
        id: 'atk_milking',
        title: 'Milking Cow (×12)',
        simBehavior: 'Träff om ≥ 4 (3 av 6 sidor). Träff = 1 HP skada.',
        assumption: 'Träffchans: 3/6 = 50 %',
      },
      {
        id: 'atk_unicorn',
        title: 'Unicorn (×7)',
        simBehavior: 'Träff om ≥ 5 (2 av 6 sidor). Träff = 1 HP skada.',
        assumption: 'Träffchans: 2/6 = 33,3 %',
      },
    ],
  },
  {
    id: 'reactive',
    icon: '🛡️',
    heading: 'Reaktiva kort (any_time)',
    rules: [
      {
        id: 'react_godmode',
        title: 'God Mode (×6)',
        simBehavior: 'Spelas REAKTIVT av vem som helst när en attack är aktiv — aldrig som ett inledande/proaktivt kort. Noppar attacken helt. Angriparen kan counter-nopa med ett eget God Mode → attacken återupptas. Reaktionskedjan har ingen fast gräns (bara ett säkerhetsstopp vid 100 iterationer).',
        assumption: 'God Mode används enbart under pågående attackkedja. Kan inte spelas som "öppningsdrag" utan attack.',
      },
      {
        id: 'react_stopit',
        title: 'Stop It (×3)',
        simBehavior: 'Kan spelas när som helst INNAN en tärning har kastats — antingen i början av turen eller precis innan ett angrepp slås. Avbryter hela turens attackfas. Aktiv spelare drar fortfarande ett kort efteråt.',
        assumption: 'Simulering kontrollerar Stop It vid två tillfällen: i turens start, och precis innan attacken slås.',
        note: 'Kan INTE nopas av God Mode.',
      },
      {
        id: 'react_wronggoat',
        title: 'Wrong Goat (×3)',
        simBehavior: 'Kan bara spelas av den som attackeras. Omdirigerar attacken till spelaren med flest kort på hand (exkl. angriparen och nuvarande mål).',
        assumption: 'Vid lika väljs spelaren med lägst ID. Wrong Goat räknas som en redirect-händelse i kedjan.',
      },
      {
        id: 'react_redirect',
        title: 'Re-direct (×3)',
        simBehavior: 'Kan bara spelas av den som attackeras. Omdirigerar attacken till valfri annan spelare (vald av strategi).',
        assumption: 'Aggressiv/defensiv strategi väljer ny måltavla baserat på HP/hand. Max 6 omdirigeringar per attack.',
      },
      {
        id: 'react_adrenaline',
        title: 'Adrenaline (×3)',
        simBehavior: 'Spelas efter tärningsslaget men innan skada appliceras. Rullar om tärningen en gång. Angriparen kan använda det vid miss; målet kan använda det vid träff.',
        assumption: 'Bara EN adrenaline-reaktion per attack. Strategin väljer om det är värt att spela baserat på kastresultatet.',
      },
    ],
  },
  {
    id: 'specialty',
    icon: '🃏',
    heading: 'Specialkort (own_turn)',
    rules: [
      {
        id: 'spec_polacken',
        title: 'Polacken (×3)',
        simBehavior: 'Drar 3 kort från leken.',
        assumption: 'Ingen annan effekt. Kortet läggs i kasthögen.',
      },
      {
        id: 'spec_begger',
        title: 'Begger (×3)',
        simBehavior: 'Varje motspelare ger bort ett valfritt kort till dig. I simuleringen väljs kortet slumpmässigt (representerar motståndarens fria val).',
        assumption: 'I verkligheten väljer varje motspelare VILKET kort de ger. Simulering approximerar detta med slumpmässigt val.',
      },
      {
        id: 'spec_steal',
        title: 'Steal (×4)',
        simBehavior: 'Du väljer vilken motspelare du stjäl från och pekar på 2 kort (men ser bara baksidan). I simuleringen är kortvalet slumpmässigt.',
        assumption: 'Målval är strategiskt, kortvalet är slumpmässigt eftersom du inte ser vad korten är.',
      },
      {
        id: 'spec_oppenheimer',
        title: 'Oppenheimer (×1)',
        simBehavior: 'Stjäl ALLA C4-Goat-kort från alla motspelares händer.',
        assumption: 'Tar enbart C4-Goat, inga andra attackkort.',
      },
      {
        id: 'spec_blottaren',
        title: 'Blottaren (×3)',
        simBehavior: 'Exponerar en vald spelares hand (loggad i händelseloggen). Ingen annan spelmekanisk effekt.',
        assumption: 'I verkligheten ger info-fördelen strategiska möjligheter. Simuleringen loggar händelsen men AI ändrar inte strategi baserat på det.',
        note: '⚠️ Potentiell diskrepans — Blottaren bör ge strategisk information men det är svårt att simulera.',
      },
      {
        id: 'spec_skinny',
        title: 'Skinny Dipping (×3)',
        simBehavior: 'Tärningsduel mot vald motspelare — varje spelare slår tärning tills de får olika värden. Vinnaren drar 2 kort.',
        assumption: 'Oavgjort är omöjligt (tärningarna kastas om tills skillnad finns).',
      },
      {
        id: 'spec_sacrifice',
        title: 'The Sacrifice (×3)',
        simBehavior: 'Snurrar Dirty Devil-hjulet. Se hjulsektion nedan för alla segment och deras sannolikheter.',
        assumption: 'Hjulet är viktbaserat — alla 8 vanliga segment har lika stor chans (~11,5%), Nuke har 1% chans.',
      },
      {
        id: 'spec_identity',
        title: 'Identity Theft (×3)',
        simBehavior: 'Byter HP och stationära kort (Senile Grandma, Haunted Barn) med en vald motspelare.',
        assumption: 'Handkorten berörs INTE — bara HP och stationary-slots byter ägare.',
      },
      {
        id: 'spec_moonshine',
        title: 'Moonshine Night (×1)',
        simBehavior: 'Byter hela din hand med en vald motspelares hand. Moonshine Night-kortet kastas (läggs ej med i den bytta handen).',
        assumption: 'Du väljer vem du byter med. Motspelaren kan inte neka.',
      },
      {
        id: 'spec_loot',
        title: 'Loot the Corpse (×1)',
        simBehavior: 'Tar alla kort från en eliminerad spelares hand.',
        assumption: 'Kan bara spelas om det finns en eliminerad spelare med kort kvar.',
      },
      {
        id: 'spec_silvertejp',
        title: 'Silvertejp (×3)',
        simBehavior: 'Läker dig till 2 HP. Spelar bara om du har 1 HP (annars ingen effekt).',
        assumption: 'Max HP är 2 — kan inte läka om du redan har 2 HP.',
      },
    ],
  },
  {
    id: 'stationary',
    icon: '🏚️',
    heading: 'Stationära kort',
    rules: [
      {
        id: 'stat_grandma',
        title: 'Senile Grandma (×5)',
        simBehavior: 'Placeras på din egna gård. Absorberar nästa attack mot dig — du tar ingen skada. Grandma tas sedan bort.',
        assumption: 'Absorberar EXAKT EN attack, sedan försvinner den. Gäller inte Nuke (The Sacrifice). Kan ha max 1 Grandma åt gången.',
        note: 'Kan inte nopas av God Mode.',
      },
      {
        id: 'stat_haunted',
        title: 'Haunted Barn (×3)',
        simBehavior: 'Placeras på en motspelares gård. I slutet av deras tur: om de har < 2 kort på hand → 1 HP skada och Haunted Barn tas bort.',
        assumption: 'Tröskeln är UNDER 2 kort (0 eller 1 kort = aktiveras). Med exakt 2 kort aktiveras den INTE.',
        note: '⚠️ Bör bekräftas — är tröskeln < 2 eller ≤ 2?',
      },
    ],
  },
  {
    id: 'traps',
    icon: '🪤',
    heading: 'Trappkort (automatic)',
    rules: [
      {
        id: 'trap_madcow',
        title: 'Mad Cow (×3)',
        simBehavior: 'Blandas in i leken EFTER att händerna är delade. När du drar Mad Cow: slå tärning. Ojämnt (1, 3, 5) = 1 HP skada. Jämnt (2, 4, 6) = ingen skada. Kortet läggs alltid i kasthögen.',
        assumption: 'Hamnar aldrig i handen. Aktiveras direkt vid dragning. Chans att ta skada: 50 %.',
      },
      {
        id: 'trap_insurance',
        title: 'Insurance (×2)',
        simBehavior: 'Vanligt handkort — finns i leken från start och hamnar i handen när det dras. Om du tar dödlig skada (HP → 0): spelaren visar Insurance, kortet aktiveras och HP återställs till 2. Kan bara användas EN GÅNG per spel.',
        assumption: 'Auto-triggar vid dödlig skada om kortet finns i handen. Fungerar INTE mot Nuke.',
      },
    ],
  },
  {
    id: 'wheel',
    icon: '🎡',
    heading: 'The Sacrifice — Dirty Devil-hjulet',
    rules: [
      {
        id: 'wheel_draw3',
        title: 'Dra 3 kort (~11,5%)',
        simBehavior: 'Du drar 3 kort från leken.',
        assumption: '',
      },
      {
        id: 'wheel_rightdiscard',
        title: 'Höger kastar 2 (~11,5%)',
        simBehavior: 'Spelaren till din höger (medsols) kastar de 2 första korten i sin hand.',
        assumption: 'Simuleringen kastar de första 2 korten i ordning — i verkligheten kan spelaren välja.',
        note: '⚠️ Bör motspelaren välja vilka 2 kort de kastar?',
      },
      {
        id: 'wheel_leftdiscard',
        title: 'Vänster kastar 2 (~11,5%)',
        simBehavior: 'Spelaren till din vänster (motsols) kastar de 2 första korten i sin hand.',
        assumption: 'Samma antagande som höger-varianten ovan.',
        note: '⚠️ Bör motspelaren välja vilka 2 kort de kastar?',
      },
      {
        id: 'wheel_steal2',
        title: 'Stjäl 2 (~11,5%)',
        simBehavior: 'Stjäl 2 slumpmässiga kort från en slumpmässig motspelares hand.',
        assumption: 'Valet av vilken spelare och vilka kort är slumpmässigt i simuleringen.',
      },
      {
        id: 'wheel_discard2self',
        title: 'Du kastar 2 (~11,5%)',
        simBehavior: 'Du kastar de 2 första korten i din hand.',
        assumption: 'I verkligheten väljer troligen spelaren vilka 2 kort som kastas.',
        note: '⚠️ Bör du kunna välja vilka 2 kort du kastar?',
      },
      {
        id: 'wheel_swap',
        title: 'Byt hand (~11,5%)',
        simBehavior: 'Byter hela din hand med en slumpmässig motspelares hand.',
        assumption: 'Valet av vem du byter med är slumpmässigt.',
      },
      {
        id: 'wheel_youdie',
        title: 'Du dör (~11,5%)',
        simBehavior: 'Du tar 1 HP skada (kan trigga Insurance).',
        assumption: 'Insurance skyddar mot detta.',
      },
      {
        id: 'wheel_givetake',
        title: 'Ge 1, ta 1 (~11,5%)',
        simBehavior: 'Ge ditt första handkort till en slumpmässig motspelare, ta sedan ett slumpmässigt kort från dem.',
        assumption: 'Valet av kort och spelare är slumpmässigt.',
        note: '⚠️ I verkligheten — väljer man fritt vem man ger/tar ifrån, och väljer man vilket kort?',
      },
      {
        id: 'wheel_nuke',
        title: 'Nuke (~1%)',
        simBehavior: 'ALLA spelare dör — inklusive den som spelade The Sacrifice. Insurance fungerar INTE. Spelet slutar alltid som oavgjort vid nuke.',
        assumption: 'Ingen överlever nuke. Alltid oavgjort.',
        note: '~1% sannolikhet baserat på hjulsegmentets relativa storlek.',
      },
    ],
  },
  {
    id: 'wincon',
    icon: '🏆',
    heading: 'Vinstvillkor',
    rules: [
      {
        id: 'win_last',
        title: 'Sista spelaren kvar vinner',
        simBehavior: 'Spelet avslutas direkt när bara 1 spelare är vid liv. De vinner.',
        assumption: '',
      },
      {
        id: 'win_draw',
        title: 'Oavgjort',
        simBehavior: 'Om alla spelare elimineras samtidigt (t.ex. Nuke) eller max antal turer nås → oavgjort, ingen vinnare.',
        assumption: '',
      },
      {
        id: 'win_eliminate',
        title: 'Eliminering',
        simBehavior: 'En spelare elimineras när HP når 0 OCH de inte har Insurance. Eliminerade spelare behåller sina kort i handen men hoppar över sina turer.',
        assumption: '⚠️ Ska eliminerade spelare behålla korten? I simuleringen gör de det (Loot the Corpse kan ta dem). Stationära kort tas bort vid eliminering.',
      },
    ],
  },
  {
    id: 'ai',
    icon: '🤖',
    heading: 'AI-beteende (Simulerings­förenklingar)',
    rules: [
      {
        id: 'ai_attack_always',
        title: 'AI attackerar alltid om möjligt',
        simBehavior: 'Om en spelare har ett attackkort och strategin säger "spela det" → de spelar det varje tur.',
        assumption: '⚠️ I verkligheten väljer spelare ofta att INTE attackera för att spara kort eller undvika att bli måltavla. Simuleringen är mer aggressiv än verkliga spel.',
      },
      {
        id: 'ai_specialty_all',
        title: 'AI spelar alla specialty-kort direkt',
        simBehavior: 'Om spelare har Polacken, Steal, Begger etc. och strategin tillåter det → spelas de omedelbart på första möjliga tur.',
        assumption: '⚠️ Verkliga spelare håller kort för rätt tillfälle. Simuleringen saknar "vänta-och-se"-beteende.',
      },
      {
        id: 'ai_nohandlimit',
        title: 'Ingen handgräns',
        simBehavior: 'Spelare kan hålla hur många kort som helst på hand. Ingen tvingad kastning.',
        assumption: '⚠️ Om det finns en handgräns i det riktiga spelet — det är INTE implementerat.',
        note: 'Bekräfta: finns det en max-handgräns i Farmer Mayhem?',
      },
      {
        id: 'ai_info',
        title: 'AI har full information',
        simBehavior: 'Alla AI-strategier "vet" hur många HP varje spelare har och hur många kort de har på hand.',
        assumption: '⚠️ I verkligheten vet man inte vad motspelarna har på hand (förutom om Blottaren spelats). Simuleringen spelar med "öppna kort" vilket gör att God Mode och Redirect används mer optimalt än i verkliga spel.',
      },
      {
        id: 'ai_noinsurance_choice',
        title: 'Insurance är alltid auto-triggar',
        simBehavior: 'Om Insurance finns i handen och spelare tar dödlig skada → aktiveras automatiskt utan val.',
        assumption: '⚠️ Om Insurance ska spelas aktivt (ett aktivt val av spelaren) kan det ändra när och om den används.',
      },
    ],
  },
  {
    id: 'deckcounts',
    icon: '📊',
    heading: 'Kortlekens sammansättning (totalt)',
    rules: [
      {
        id: 'deck_attack',
        title: 'Attackkort',
        simBehavior: 'C4-Goat ×18, Milking Cow ×12, Unicorn ×7 = 37 attackkort',
        assumption: '',
      },
      {
        id: 'deck_reactive',
        title: 'Reaktiva kort (any_time)',
        simBehavior: 'God Mode ×6, Stop It ×3, Wrong Goat ×3, Re-direct ×3, Adrenaline ×3 = 18 reaktiva kort',
        assumption: '',
      },
      {
        id: 'deck_specialty',
        title: 'Specialkort (own_turn)',
        simBehavior: 'Identity Theft ×3, Blottaren ×3, Skinny Dipping ×3, The Sacrifice ×3, Oppenheimer ×1, Begger ×3, Steal ×4, Silvertejp ×3, Moonshine Night ×1, Loot the Corpse ×1, Polacken ×3 = 28 specialkort',
        assumption: '',
      },
      {
        id: 'deck_stationary',
        title: 'Stationära kort',
        simBehavior: 'Senile Grandma ×5, Haunted Barn ×3 = 8 stationära kort',
        assumption: '',
      },
      {
        id: 'deck_trap',
        title: 'Trappkort (blandas in efter deal)',
        simBehavior: 'Mad Cow ×3, Insurance ×5 = 8 trappkort',
        assumption: '',
      },
      {
        id: 'deck_total',
        title: 'Totalt',
        simBehavior: '37 + 18 + 28 + 8 + 8 = 99 kort',
        assumption: 'Bekräfta mot fysisk kortlek.',
      },
    ],
  },
];

// ─── STATUS PILL ─────────────────────────────────────────────

function StatusPill({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  const styles: Record<Status, string> = {
    unknown: 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600',
    correct: 'bg-emerald-700 text-emerald-100 hover:bg-emerald-600',
    wrong: 'bg-red-700 text-red-100 hover:bg-red-600',
  };
  const labels: Record<Status, string> = {
    unknown: '? Ej verifierat',
    correct: '✓ Stämmer',
    wrong: '✗ FEL',
  };
  const next: Record<Status, Status> = { unknown: 'correct', correct: 'wrong', wrong: 'unknown' };

  return (
    <button
      onClick={() => onChange(next[status])}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${styles[status]}`}
      title="Klicka för att markera status"
    >
      {labels[status]}
    </button>
  );
}

// ─── RULE CARD ───────────────────────────────────────────────

function RuleCard({
  rule,
  status,
  correction,
  onStatusChange,
  onCorrectionChange,
}: {
  rule: RuleEntry;
  status: Status;
  correction: string;
  onStatusChange: (id: string, s: Status) => void;
  onCorrectionChange: (id: string, text: string) => void;
}) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      status === 'wrong'
        ? 'border-red-700 bg-red-950/30'
        : status === 'correct'
        ? 'border-emerald-800 bg-emerald-950/20'
        : 'border-zinc-700 bg-zinc-800/50'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-sm font-semibold text-white leading-tight">{rule.title}</h4>
        <StatusPill status={status} onChange={(s) => onStatusChange(rule.id, s)} />
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed mb-2">
        <span className="text-zinc-500 text-xs font-medium uppercase tracking-wide mr-1">Simulering:</span>
        {rule.simBehavior}
      </p>

      {rule.assumption && (
        <p className="text-xs text-amber-300/80 leading-relaxed mt-2 border-l-2 border-amber-600 pl-2">
          <span className="font-semibold text-amber-400">Antagande: </span>
          {rule.assumption}
        </p>
      )}

      {rule.note && (
        <p className="text-xs text-orange-300/80 leading-relaxed mt-2 border-l-2 border-orange-500 pl-2">
          {rule.note}
        </p>
      )}

      {/* Correction field — only shown when marked as wrong */}
      {status === 'wrong' && (
        <div className="mt-3">
          <label className="text-xs font-semibold text-red-300 block mb-1">
            ✏️ Korrekt beteende (skriv hur det faktiskt fungerar):
          </label>
          <textarea
            value={correction}
            onChange={(e) => onCorrectionChange(rule.id, e.target.value)}
            placeholder="Beskriv det korrekta beteendet..."
            rows={3}
            className="w-full bg-zinc-900 border border-red-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500 resize-y"
          />
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

const LS_STATUSES = 'farmer_rules_statuses';
const LS_CORRECTIONS = 'farmer_rules_corrections';

export default function RulesTab() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedStatuses = localStorage.getItem(LS_STATUSES);
      const savedCorrections = localStorage.getItem(LS_CORRECTIONS);
      if (savedStatuses) setStatuses(JSON.parse(savedStatuses));
      if (savedCorrections) setCorrections(JSON.parse(savedCorrections));
    } catch {
      // ignore
    }
  }, []);

  // Auto-save whenever statuses or corrections change
  useEffect(() => {
    try {
      localStorage.setItem(LS_STATUSES, JSON.stringify(statuses));
    } catch { /* ignore */ }
  }, [statuses]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CORRECTIONS, JSON.stringify(corrections));
    } catch { /* ignore */ }
  }, [corrections]);

  function handleStatusChange(id: string, status: Status) {
    setStatuses(prev => ({ ...prev, [id]: status }));
  }

  function handleCorrectionChange(id: string, text: string) {
    setCorrections(prev => ({ ...prev, [id]: text }));
  }

  const handleExport = useCallback(() => {
    const allRulesFlat = SECTIONS.flatMap(s => s.rules.map(r => ({ ...r, sectionHeading: s.heading, sectionIcon: s.icon })));
    const wrongRules = allRulesFlat.filter(r => statuses[r.id] === 'wrong');
    if (wrongRules.length === 0) return;

    const lines = [
      '=== FARMER MAYHEM — REGELKORRIGERINGAR ===',
      '',
      ...wrongRules.map(r => [
        `[${r.sectionIcon} ${r.sectionHeading}] ${r.title}`,
        `  Simulering: ${r.simBehavior}`,
        corrections[r.id]?.trim()
          ? `  KORREKT:    ${corrections[r.id].trim()}`
          : `  KORREKT:    (inte specificerat ännu)`,
        '',
      ].join('\n')),
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [statuses, corrections]);

  const allRules = SECTIONS.flatMap(s => s.rules);
  const totalCount = allRules.length;
  const correctCount = allRules.filter(r => statuses[r.id] === 'correct').length;
  const wrongCount = allRules.filter(r => statuses[r.id] === 'wrong').length;
  const unknownCount = totalCount - correctCount - wrongCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1 gap-3">
          <h2 className="text-sm font-semibold text-white">Regelverifiering</h2>
          <div className="flex gap-2">
            {wrongCount > 0 && (
              <button
                onClick={handleExport}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 border border-red-700 text-red-300 hover:bg-red-800/60 transition-colors font-medium"
              >
                {copied ? '✓ Kopierat!' : `📋 Kopiera ${wrongCount} korrigering${wrongCount !== 1 ? 'ar' : ''}`}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Klicka på statusknappen för att markera om regeln{' '}
          <span className="text-emerald-400 font-semibold">stämmer</span> eller är{' '}
          <span className="text-red-400 font-semibold">FEL</span>.
          När en regel är markerad som FEL — skriv det korrekta beteendet i textrutan som dyker upp.
          Allt sparas automatiskt i webbläsaren.
        </p>
        {/* Progress bar */}
        <div className="mt-3 flex gap-3 items-center">
          <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(correctCount / totalCount) * 100}%` }} />
            <div className="h-full bg-red-500 transition-all" style={{ width: `${(wrongCount / totalCount) * 100}%` }} />
          </div>
          <span className="text-xs text-zinc-400 whitespace-nowrap">
            <span className="text-emerald-400 font-bold">{correctCount}</span> ✓ &nbsp;
            <span className="text-red-400 font-bold">{wrongCount}</span> ✗ &nbsp;
            <span className="text-zinc-500">{unknownCount}</span> ?
          </span>
        </div>
        <p className="text-xs text-zinc-600 mt-2">💾 Auto-sparas i webbläsarens localStorage</p>
      </div>

      {/* Warning flags summary */}
      {wrongCount > 0 && (
        <div className="bg-red-950/40 border border-red-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-300 mb-2">⚠️ {wrongCount} regler markerade som FEL</h3>
          <ul className="space-y-2">
            {allRules.filter(r => statuses[r.id] === 'wrong').map(r => {
              const section = SECTIONS.find(s => s.rules.some(rr => rr.id === r.id));
              const corr = corrections[r.id]?.trim();
              return (
                <li key={r.id} className="text-xs">
                  <div className="text-red-200">
                    <span className="text-red-500 mr-1">{section?.icon}</span>
                    <span className="font-medium">{section?.heading}:</span> {r.title}
                  </div>
                  {corr && (
                    <div className="mt-0.5 ml-4 text-emerald-400 italic">→ {corr}</div>
                  )}
                  {!corr && (
                    <div className="mt-0.5 ml-4 text-zinc-600 italic">→ (korrekt beteende ej specificerat)</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Section nav */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => {
          const sectionWrong = s.rules.filter(r => statuses[r.id] === 'wrong').length;
          const sectionCorrect = s.rules.filter(r => statuses[r.id] === 'correct').length;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                activeSection === s.id
                  ? 'border-white bg-zinc-700 text-white'
                  : sectionWrong > 0
                  ? 'border-red-700 bg-red-950/30 text-red-300'
                  : sectionCorrect === s.rules.length
                  ? 'border-emerald-700 bg-emerald-950/20 text-emerald-300'
                  : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-zinc-400'
              }`}
            >
              {s.icon} {s.heading}
              {sectionWrong > 0 && <span className="ml-1.5 bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">{sectionWrong}</span>}
            </button>
          );
        })}
      </div>

      {/* Sections */}
      {SECTIONS
        .filter(s => !activeSection || s.id === activeSection)
        .map(section => (
          <div key={section.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{section.icon}</span>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">{section.heading}</h3>
              <div className="flex-1 h-px bg-zinc-700" />
              <span className="text-xs text-zinc-500">
                {section.rules.filter(r => statuses[r.id] === 'correct').length}/{section.rules.length} verifierade
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.rules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  status={statuses[rule.id] ?? 'unknown'}
                  correction={corrections[rule.id] ?? ''}
                  onStatusChange={handleStatusChange}
                  onCorrectionChange={handleCorrectionChange}
                />
              ))}
            </div>
          </div>
        ))}

      {/* Footer note */}
      <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 text-xs text-zinc-500 leading-relaxed">
        <strong className="text-zinc-400">Tips:</strong> Poster markerade med ⚠️ är kända antaganden i simuleringen som kan skilja sig från verkligheten.
        Markera dem som "FEL" och berätta för oss hur det faktiskt fungerar — vi fixar koden direkt.
      </div>
    </div>
  );
}
