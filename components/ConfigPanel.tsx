'use client';

import { useState } from 'react';
import { SimConfig, Strategy, CardDefinition, CardTemplate } from '@/lib/types';
import {
  CARD_DATABASE, registerCustomCard, unregisterCustomCard,
  loadCustomCards, saveCustomCards,
} from '@/lib/cardDatabase';

interface ConfigPanelProps {
  config: SimConfig;
  onChange: (config: SimConfig) => void;
  onRun: () => void;
  isRunning: boolean;
  progress: number;
}

const STRATEGY_OPTIONS: Strategy[] = ['expert', 'aggressive', 'defensive', 'random'];
const STRATEGY_LABELS: Record<Strategy, string> = {
  expert: '🧠 Smart',
  aggressive: '⚔️ Aggressiv',
  defensive: '🛡️ Defensiv',
  random: '🎲 Naiv',
};

/** Short description of each strategy — shown below the player's selected style. */
const STRATEGY_DESCRIPTIONS: Record<Strategy, string> = {
  expert: 'Realistisk standardspelare. Sparar God Mode för riktiga hot, attackerar ledaren, väger risk/belöning på The Sacrifice och spelar resurser i tempo (max 2 specialkort/tur).',
  aggressive: 'Samma smarta hjärna men attackerar OFTARE (även vid 1 HP), jagar lågHP-mål för kill shots, använder defensiva kort mer frikostigt, spelar The Sacrifice mer gärna. Upp till 3 specialkort/tur.',
  defensive: 'Samma smarta hjärna men attackerar BARA vid full HP, sparar God Mode mycket längre, placerar Senile Grandma proaktivt, undviker mål med Grandma och spelar aldrig The Sacrifice utom i panik.',
  random: 'Slumpmässiga val utan strategi. Baseline-kontroll för att jämföra hur smart spel skiljer sig från slumpmässigt.',
};

const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const SIM_COUNTS = [100, 1000, 5000, 10000];

// (ALL_CARDS computed lazily inside the component so custom cards added at
// runtime show up immediately without a full reload.)

// Group cards by their role so the expanded view can show columns
const CARD_GROUPS = [
  { id: 'attack', label: 'Attackkort', color: 'text-red-300' },
  { id: 'reactive', label: 'Reaktiva (any-time)', color: 'text-blue-300' },
  { id: 'specialty', label: 'Specialkort (egen tur)', color: 'text-teal-300' },
  { id: 'stationary', label: 'Stationära (gård)', color: 'text-amber-300' },
  { id: 'auto', label: 'Auto / Insurance', color: 'text-emerald-300' },
  { id: 'trap', label: 'Trapp / Husekort', color: 'text-purple-300' },
];

function cardGroup(cardId: string): string {
  const def = CARD_DATABASE[cardId];
  if (!def) return 'specialty';
  if (def.type === 'attack') return 'attack';
  if (def.type === 'trap') return 'trap';
  if (def.type === 'stationary') return 'stationary';
  if (def.timing === 'any_time') return 'reactive';
  if (def.timing === 'automatic') return 'auto';
  return 'specialty';
}

export default function ConfigPanel({ config, onChange, onRun, isRunning, progress }: ConfigPanelProps) {
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  // Bumping this re-renders the panel after a custom card is added/removed
  // so the deck list reflects new entries from CARD_DATABASE.
  const [refreshKey, setRefreshKey] = useState(0);
  const ALL_CARDS = Object.values(CARD_DATABASE);
  void refreshKey;

  function setPlayerCount(n: number) {
    // New players default to the smart 'expert' brain
    const strategies = Array.from({ length: n }, (_, i) => config.strategies[i] || 'expert');
    onChange({ ...config, playerCount: n, strategies });
  }

  function setStrategy(idx: number, s: Strategy) {
    const strategies = [...config.strategies];
    strategies[idx] = s;
    onChange({ ...config, strategies });
  }

  function setCardCount(cardId: string, count: number) {
    const overrides = { ...config.deckConfig.overrides };
    const defaultCount = CARD_DATABASE[cardId]?.count ?? 0;
    if (count === defaultCount) {
      delete overrides[cardId];
    } else {
      overrides[cardId] = count;
    }
    onChange({ ...config, deckConfig: { overrides } });
  }

  function resetDeck() {
    onChange({ ...config, deckConfig: { overrides: {} } });
  }

  function addCustomCard(card: CardDefinition) {
    // Persist + register so it's immediately usable in the simulator
    const all = loadCustomCards();
    all[card.id] = card;
    saveCustomCards(all);
    registerCustomCard(card);
    setRefreshKey(k => k + 1);
  }

  function removeCustomCard(id: string) {
    const all = loadCustomCards();
    delete all[id];
    saveCustomCards(all);
    unregisterCustomCard(id);
    // Also drop any deck override for it
    const overrides = { ...config.deckConfig.overrides };
    delete overrides[id];
    onChange({ ...config, deckConfig: { overrides } });
    setRefreshKey(k => k + 1);
  }

  const getCardCount = (cardId: string) =>
    config.deckConfig.overrides[cardId] ?? CARD_DATABASE[cardId]?.count ?? 0;

  // Total deck size (sum of all card counts, including traps)
  const totalCards = ALL_CARDS.reduce((sum, c) => sum + getCardCount(c.id), 0);
  const defaultTotal = ALL_CARDS.reduce((sum, c) => sum + c.count, 0);
  const totalDiff = totalCards - defaultTotal;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-6">
      <h2 className="text-lg font-bold text-white">Konfiguration</h2>

      {/* Player count */}
      <div>
        <p className="text-sm font-medium text-zinc-400 mb-2">Antal spelare</p>
        <div className="flex gap-2 flex-wrap">
          {PLAYER_COUNTS.map(n => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                config.playerCount === n
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Strategies per player */}
      <div>
        <p className="text-sm font-medium text-zinc-400 mb-2">Strategi per spelare</p>
        <div className="space-y-3">
          {Array.from({ length: config.playerCount }, (_, i) => {
            const selected = config.strategies[i] ?? 'expert';
            return (
              <div key={i} className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-zinc-300 text-sm font-semibold w-20">Spelare {i + 1}</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {STRATEGY_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setStrategy(i, s)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                          selected === s
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        }`}
                      >
                        {STRATEGY_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed pl-1 border-l-2 border-indigo-700/60 ml-1 pl-2">
                  {STRATEGY_DESCRIPTIONS[selected]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simulation count */}
      <div>
        <p className="text-sm font-medium text-zinc-400 mb-2">Antal simuleringar</p>
        <div className="flex gap-2 flex-wrap">
          {SIM_COUNTS.map(n => (
            <button
              key={n}
              onClick={() => onChange({ ...config, numSimulations: n })}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                config.numSimulations === n
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Deck configuration — compact summary + open fullscreen button */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-zinc-400">Kortlekkonfiguration</p>
          {Object.keys(config.deckConfig.overrides).length > 0 && (
            <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {Object.keys(config.deckConfig.overrides).length} ändrade
            </span>
          )}
        </div>
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-zinc-500">Totalt antal kort i leken</span>
            <span className="font-mono font-bold text-white">
              {totalCards}
              {totalDiff !== 0 && (
                <span className={`text-xs ml-1 ${totalDiff > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                  ({totalDiff > 0 ? '+' : ''}{totalDiff} mot standard {defaultTotal})
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setShowDeckModal(true)}
            className="w-full text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-100 py-2 rounded-md transition-colors"
          >
            🔍 Öppna full kortlekredigerare
          </button>
        </div>
      </div>

      {/* Run button + progress */}
      <div className="space-y-3">
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`w-full py-3 rounded-xl font-bold text-base transition-all ${
            isRunning
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
          }`}
        >
          {isRunning ? 'Simulerar...' : 'Kör simulering'}
        </button>

        {isRunning && (
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Framsteg</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ──────── DECK CONFIG MODAL ──────── */}
      {showDeckModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDeckModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Kortlekredigerare</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Justera antalet av varje kort. <strong className="text-zinc-300">Trappkort</strong> (Mad Cow) ligger i leken men kommer aldrig in i en spelarhand.
                </p>
              </div>
              <button
                onClick={() => setShowDeckModal(false)}
                className="text-zinc-400 hover:text-white text-2xl leading-none px-2"
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>

            {/* Total count banner */}
            <div className="px-6 py-3 bg-zinc-800/60 border-b border-zinc-700 flex items-baseline justify-between">
              <span className="text-sm text-zinc-300">Totalt antal kort i leken:</span>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-mono font-bold text-white">{totalCards}</span>
                {totalDiff !== 0 ? (
                  <span className={`text-xs font-medium ${totalDiff > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                    {totalDiff > 0 ? '+' : ''}{totalDiff} mot standard ({defaultTotal})
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">standardlek</span>
                )}
                <button
                  onClick={resetDeck}
                  className="text-xs text-zinc-400 hover:text-white underline ml-3"
                >
                  Återställ
                </button>
              </div>
            </div>

            {/* Card grid by group */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                {CARD_GROUPS.map(group => {
                  const cardsInGroup = ALL_CARDS.filter(c => cardGroup(c.id) === group.id);
                  if (cardsInGroup.length === 0) return null;
                  const groupTotal = cardsInGroup.reduce((sum, c) => sum + getCardCount(c.id), 0);
                  return (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-baseline justify-between border-b border-zinc-700 pb-1.5">
                        <h3 className={`text-xs font-bold uppercase tracking-wide ${group.color}`}>
                          {group.label}
                        </h3>
                        <span className="text-xs font-mono text-zinc-500">{groupTotal} kort</span>
                      </div>
                      {cardsInGroup.map(card => {
                        const count = getCardCount(card.id);
                        const isModified = card.id in config.deckConfig.overrides;
                        const isTrap = card.type === 'trap';
                        return (
                          <div key={card.id} className="group relative">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${isModified ? 'text-orange-400' : 'text-zinc-200'}`}>
                                  {card.name}
                                  {card.description && (
                                    <span className="text-zinc-500 hover:text-zinc-300 text-[10px] cursor-help" title={card.description}>ⓘ</span>
                                  )}
                                  {isTrap && <span className="text-[9px] bg-purple-900/60 text-purple-300 px-1 py-0.5 rounded">HUSKORT</span>}
                                  {card.isCustom && <span className="text-[9px] bg-pink-900/60 text-pink-300 px-1 py-0.5 rounded">EGET</span>}
                                </p>
                                <p className="text-[10px] text-zinc-500">standard: {card.count}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setCardCount(card.id, Math.max(0, count - 1))}
                                  className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200 text-sm font-bold"
                                >−</button>
                                <span className="w-7 text-center text-white text-sm font-mono font-bold">{count}</span>
                                <button
                                  onClick={() => setCardCount(card.id, count + 1)}
                                  className="w-7 h-7 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200 text-sm font-bold"
                                >+</button>
                                {card.isCustom && (
                                  <button
                                    onClick={() => { if (confirm(`Ta bort kortet "${card.name}" helt?`)) removeCustomCard(card.id); }}
                                    className="ml-1 w-7 h-7 bg-red-900/40 hover:bg-red-800 rounded text-red-300 text-xs"
                                    title="Ta bort detta egna kort"
                                  >🗑</button>
                                )}
                              </div>
                            </div>
                            {/* Pretty tooltip on hover (desktop) */}
                            {card.description && (
                              <div className="invisible group-hover:visible absolute z-50 left-0 top-full mt-1 w-72 bg-zinc-950 border border-zinc-600 rounded-lg p-3 text-xs text-zinc-200 shadow-2xl leading-relaxed pointer-events-none">
                                <p className="font-semibold text-white mb-1">{card.name}</p>
                                <p className="text-zinc-300">{card.description}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-zinc-700 flex items-center justify-between gap-2 bg-zinc-900/50">
              <button
                onClick={() => setShowAddCard(true)}
                className="text-sm font-medium bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-md transition-colors"
              >
                ＋ Lägg till eget kort
              </button>
              <button
                onClick={() => setShowDeckModal(false)}
                className="text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md transition-colors"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────── ADD CUSTOM CARD MODAL ──────── */}
      {showAddCard && (
        <AddCardModal
          onClose={() => setShowAddCard(false)}
          onAdd={card => { addCustomCard(card); setShowAddCard(false); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ADD CARD MODAL — define new custom cards with name, description,
// and a behaviour template that the simulator can actually execute.
// ════════════════════════════════════════════════════════════════

function AddCardModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (card: CardDefinition) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<CardTemplate>('attack');
  const [count, setCount] = useState(3);
  const [hitThreshold, setHitThreshold] = useState(4);
  const [damage, setDamage] = useState(1);
  const [drawCount, setDrawCount] = useState(2);

  function generateId(s: string): string {
    const slug = s.toLowerCase()
      .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `custom_${slug || Date.now()}`;
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = generateId(trimmed);
    if (CARD_DATABASE[id]) {
      alert(`Ett kort med ID "${id}" finns redan. Välj ett annat namn.`);
      return;
    }

    const base: CardDefinition = {
      id,
      name: trimmed,
      type: template === 'attack' ? 'attack' : 'specialty',
      timing: 'own_turn',
      count: Math.max(1, Math.min(30, count)),
      canBeNopedByGodMode: template === 'attack',
      description: description.trim() || undefined,
      isCustom: true,
      template,
    };
    if (template === 'attack') {
      base.hitThreshold = Math.max(2, Math.min(6, hitThreshold));
      base.damage = Math.max(1, Math.min(2, damage));
    }
    if (template === 'draw') {
      base.drawCount = Math.max(1, Math.min(5, drawCount));
    }
    onAdd(base);
  }

  const previewProbability = template === 'attack'
    ? `${(((7 - hitThreshold) / 6) * 100).toFixed(0)}% träffchans (tärning ≥ ${hitThreshold})`
    : '';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Lägg till eget kort</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Skapa ett nytt kort. Simulatorn använder det direkt baserat på vald mall.</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none px-2">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Kortnamn *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="t.ex. Super Goat"
              maxLength={30}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Regeltext (förklaring för spelare)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="t.ex. En super-getbomb. Slå tärningen — träff på 2+ ger 2 HP skada."
              rows={2}
              maxLength={200}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-pink-500 resize-y"
            />
            <p className="text-[10px] text-zinc-600 mt-1">Visas som tooltip i kortlek-redigeraren.</p>
          </div>

          {/* Template */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Vad gör kortet? (mall)</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'attack' as CardTemplate, icon: '⚔️', label: 'Attack', desc: 'Slå tärning + skada' },
                { id: 'heal'   as CardTemplate, icon: '🩹', label: 'Helande', desc: 'Återställ till 2 HP' },
                { id: 'draw'   as CardTemplate, icon: '🃏', label: 'Dra kort', desc: 'Dra N kort' },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`p-3 rounded-lg text-left border transition-colors ${
                    template === t.id
                      ? 'border-pink-500 bg-pink-900/30'
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'
                  }`}
                >
                  <div className="text-2xl">{t.icon}</div>
                  <div className="text-xs font-bold text-white mt-1">{t.label}</div>
                  <div className="text-[10px] text-zinc-400">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Template-specific parameters */}
          {template === 'attack' && (
            <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-red-300">Attack-parametrar</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Träffar vid tärning ≥</label>
                  <input
                    type="number" min={2} max={6} value={hitThreshold}
                    onChange={e => setHitThreshold(parseInt(e.target.value) || 4)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-0.5">2 = nästan alltid · 6 = nästan aldrig</p>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">HP skada vid träff</label>
                  <input
                    type="number" min={1} max={2} value={damage}
                    onChange={e => setDamage(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-0.5">1 = vanligt · 2 = boss-kort</p>
                </div>
              </div>
              <p className="text-[11px] text-amber-400">📊 {previewProbability}</p>
            </div>
          )}

          {template === 'draw' && (
            <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-teal-300 mb-2">Dra-parametrar</p>
              <label className="text-[11px] text-zinc-400 block mb-1">Antal kort att dra</label>
              <input
                type="number" min={1} max={5} value={drawCount}
                onChange={e => setDrawCount(parseInt(e.target.value) || 2)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-0.5">Mad Cow triggas inline om den dras (precis som Polacken).</p>
            </div>
          )}

          {template === 'heal' && (
            <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-emerald-300 mb-1">Helande-parametrar</p>
              <p className="text-[11px] text-zinc-400">Återställer alltid spelaren till 2 HP (max). Spelas bara om spelaren är på 1 HP.</p>
            </div>
          )}

          {/* Count in deck */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Antal i leken</label>
            <input
              type="number" min={1} max={30} value={count}
              onChange={e => setCount(parseInt(e.target.value) || 3)}
              className="w-32 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white font-mono"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Kan justeras senare i kortlek-redigeraren.</p>
          </div>

        </div>

        <div className="px-6 py-3 border-t border-zinc-700 flex items-center justify-end gap-2 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-4 py-2 rounded-md"
          >Avbryt</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={`text-sm font-medium px-4 py-2 rounded-md transition-colors ${
              name.trim()
                ? 'bg-pink-600 hover:bg-pink-500 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            }`}
          >Lägg till kort</button>
        </div>
      </div>
    </div>
  );
}
