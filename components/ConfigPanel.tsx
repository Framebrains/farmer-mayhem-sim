'use client';

import { useState, useEffect } from 'react';
import { SimConfig, Strategy, CardDefinition, CardEffect, CardType } from '@/lib/types';
import {
  CARD_DATABASE, registerCustomCard, unregisterCustomCard,
  loadCustomCards, saveCustomCards,
  applyOverride, mergeCustomCards,
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
  // Editor state: either a card being edited or null (= adding new)
  const [editingCard, setEditingCard] = useState<CardDefinition | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Bumping this re-renders the panel after a custom card is added/removed
  // so the deck list reflects new entries from CARD_DATABASE.
  const [refreshKey, setRefreshKey] = useState(0);

  // Belt-and-suspenders: ensure custom cards & built-in overrides are loaded
  // from localStorage even if the page-level hydration somehow misses us.
  // mergeCustomCards() is idempotent so re-running is safe.
  useEffect(() => {
    mergeCustomCards();
    setRefreshKey(k => k + 1);
  }, []);

  const ALL_CARDS = Object.values(CARD_DATABASE);
  void refreshKey;

  function openNewCardEditor() {
    setEditingCard(null);
    setEditorOpen(true);
  }

  function openEditCardEditor(card: CardDefinition) {
    setEditingCard(card);
    setEditorOpen(true);
  }

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

  function saveCard(card: CardDefinition, isBuiltinEdit: boolean) {
    if (isBuiltinEdit) {
      // Only name + description editable for built-in cards (mechanics are locked).
      applyOverride(card.id, { name: card.name, description: card.description });
    } else {
      const all = loadCustomCards();
      all[card.id] = card;
      saveCustomCards(all);
      registerCustomCard(card);
    }
    setRefreshKey(k => k + 1);
  }

  function removeCustomCard(id: string) {
    const all = loadCustomCards();
    delete all[id];
    saveCustomCards(all);
    unregisterCustomCard(id);
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
                                <button
                                  onClick={() => openEditCardEditor(card)}
                                  className="ml-1 w-7 h-7 bg-indigo-900/40 hover:bg-indigo-800 rounded text-indigo-200 text-xs"
                                  title={card.isCustom ? 'Redigera kort + effekter' : 'Redigera namn + beskrivning'}
                                >✏️</button>
                                {card.isCustom && (
                                  <button
                                    onClick={() => { if (confirm(`Ta bort kortet "${card.name}" helt?`)) removeCustomCard(card.id); }}
                                    className="w-7 h-7 bg-red-900/40 hover:bg-red-800 rounded text-red-300 text-xs"
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
                onClick={openNewCardEditor}
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

      {/* ──────── CARD EDITOR MODAL (add OR edit) ──────── */}
      {editorOpen && (
        <CardEditorModal
          existing={editingCard}
          onClose={() => setEditorOpen(false)}
          onSave={(card, isBuiltin) => { saveCard(card, isBuiltin); setEditorOpen(false); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CARD EDITOR MODAL — add new cards OR edit existing ones.
// For BUILT-IN cards: only name + description can be edited (mechanics
// are locked since they're hardcoded). For CUSTOM cards: everything is
// editable including the effect list.
// ════════════════════════════════════════════════════════════════

const EFFECT_LABELS: Record<CardEffect['kind'], { icon: string; name: string; color: string }> = {
  damage:  { icon: '⚔️', name: 'Skada', color: 'border-red-700 bg-red-900/20' },
  heal:    { icon: '🩹', name: 'Helande', color: 'border-emerald-700 bg-emerald-900/20' },
  draw:    { icon: '🃏', name: 'Dra kort', color: 'border-teal-700 bg-teal-900/20' },
  discard: { icon: '🗑', name: 'Kasta kort', color: 'border-orange-700 bg-orange-900/20' },
  steal:   { icon: '🤚', name: 'Stjäl kort', color: 'border-purple-700 bg-purple-900/20' },
};

function defaultEffect(kind: CardEffect['kind']): CardEffect {
  switch (kind) {
    case 'damage':  return { kind: 'damage', target: 'chosen', amount: 1 };
    case 'heal':    return { kind: 'heal', target: 'self', amount: 'max' };
    case 'draw':    return { kind: 'draw', target: 'self', count: 2 };
    case 'discard': return { kind: 'discard', target: 'chosen', count: 1 };
    case 'steal':   return { kind: 'steal', target: 'chosen', count: 1 };
  }
}

function CardEditorModal({
  existing,
  onClose,
  onSave,
}: {
  existing: CardDefinition | null;
  onClose: () => void;
  onSave: (card: CardDefinition, isBuiltinEdit: boolean) => void;
}) {
  const isEdit = !!existing;
  const isBuiltin = isEdit && !existing!.isCustom;

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [type, setType] = useState<CardType>(existing?.type ?? 'specialty');
  const [count, setCount] = useState(existing?.count ?? 3);
  const [hitThreshold, setHitThreshold] = useState(existing?.hitThreshold ?? 4);
  const [effects, setEffects] = useState<CardEffect[]>(existing?.effects ?? []);

  function generateId(s: string): string {
    const slug = s.toLowerCase()
      .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `custom_${slug || Date.now()}`;
  }

  function addEffect(kind: CardEffect['kind']) {
    setEffects(prev => [...prev, defaultEffect(kind)]);
  }

  function removeEffect(index: number) {
    setEffects(prev => prev.filter((_, i) => i !== index));
  }

  function updateEffect(index: number, patch: Partial<CardEffect>) {
    setEffects(prev => prev.map((e, i) =>
      i === index ? ({ ...e, ...patch } as CardEffect) : e
    ));
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isBuiltin) {
      // Only allow name/description for built-ins
      const updated: CardDefinition = {
        ...existing!,
        name: trimmed,
        description: description.trim() || undefined,
      };
      onSave(updated, true);
      return;
    }

    const id = existing?.id ?? generateId(trimmed);
    if (!existing && CARD_DATABASE[id]) {
      alert(`Ett kort med ID "${id}" finns redan. Välj ett annat namn.`);
      return;
    }
    const card: CardDefinition = {
      id,
      name: trimmed,
      type,
      timing: 'own_turn',
      count: Math.max(1, Math.min(30, count)),
      canBeNopedByGodMode: type === 'attack',
      description: description.trim() || undefined,
      isCustom: true,
      effects,
    };
    if (type === 'attack') card.hitThreshold = Math.max(2, Math.min(6, hitThreshold));
    onSave(card, false);
  }

  const hitProb = ((7 - hitThreshold) / 6) * 100;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {isEdit ? (isBuiltin ? `Redigera ${existing!.name}` : `Redigera "${existing!.name}"`) : 'Lägg till eget kort'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isBuiltin
                ? 'Inbyggt kort — du kan ändra namn och beskrivning, men mekaniken är låst.'
                : 'Definiera kortets effekter — simulatorn kör dem i ordning när kortet spelas.'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none px-2">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

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
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Regeltext (för människor att läsa)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Beskriv kortet i klartext..."
              rows={3}
              maxLength={300}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-pink-500 resize-y"
            />
            <p className="text-[10px] text-zinc-600 mt-1">Visas som tooltip. Påverkar inte simulatorn — det är effekterna nedan som styr mekaniken.</p>
          </div>

          {isBuiltin && (
            <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-4 text-xs text-zinc-400">
              <p className="font-semibold text-zinc-300 mb-1">🔒 Mekanik låst</p>
              <p>Inbyggda kort har sin spelmekanik hårdkodad i simulatorn. Du kan ändra namn och regeltext här (för bättre tooltips), men inte vad kortet faktiskt gör.</p>
            </div>
          )}

          {!isBuiltin && (
            <>
              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">Korttyp</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setType('specialty')}
                    className={`p-3 rounded-lg text-left border transition-colors ${
                      type === 'specialty' ? 'border-pink-500 bg-pink-900/30' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'
                    }`}
                  >
                    <p className="text-sm font-bold text-white">🃏 Specialkort</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Spelas på egen tur. Alla effekter triggar direkt.</p>
                  </button>
                  <button
                    onClick={() => setType('attack')}
                    className={`p-3 rounded-lg text-left border transition-colors ${
                      type === 'attack' ? 'border-pink-500 bg-pink-900/30' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'
                    }`}
                  >
                    <p className="text-sm font-bold text-white">⚔️ Attackkort</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Tärningsslag, kan nopa:s av God Mode/Redirect.</p>
                  </button>
                </div>
              </div>

              {/* Hit threshold (attack only) */}
              {type === 'attack' && (
                <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3">
                  <label className="text-[11px] text-zinc-400 block mb-1">Träffar vid tärning ≥</label>
                  <input
                    type="number" min={2} max={6} value={hitThreshold}
                    onChange={e => setHitThreshold(parseInt(e.target.value) || 4)}
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white font-mono"
                  />
                  <p className="text-[11px] text-amber-400 mt-1">📊 {hitProb.toFixed(0)}% träffchans</p>
                </div>
              )}

              {/* Effects list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-300">Effekter (kör i ordning)</label>
                  <div className="flex gap-1 flex-wrap">
                    {(Object.keys(EFFECT_LABELS) as CardEffect['kind'][]).map(kind => (
                      <button
                        key={kind}
                        onClick={() => addEffect(kind)}
                        className="text-[10px] font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded"
                      >
                        ＋ {EFFECT_LABELS[kind].icon} {EFFECT_LABELS[kind].name}
                      </button>
                    ))}
                  </div>
                </div>

                {effects.length === 0 && (
                  <div className="bg-zinc-800/40 border border-dashed border-zinc-700 rounded-lg p-6 text-center">
                    <p className="text-xs text-zinc-500">Inga effekter än — klicka på en knapp ovan för att lägga till.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{type === 'attack' ? 'Ett attackkort utan effekter gör 0 skada vid träff.' : 'Ett specialkort utan effekter gör ingenting när det spelas.'}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {effects.map((effect, idx) => (
                    <EffectRow
                      key={idx}
                      effect={effect}
                      index={idx}
                      onChange={patch => updateEffect(idx, patch)}
                      onRemove={() => removeEffect(idx)}
                    />
                  ))}
                </div>
              </div>

              {/* Count in deck */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Antal kopior i leken</label>
                <input
                  type="number" min={1} max={30} value={count}
                  onChange={e => setCount(parseInt(e.target.value) || 3)}
                  className="w-32 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white font-mono"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Justera senare i kortlek-redigeraren.</p>
              </div>
            </>
          )}

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
          >
            {isEdit ? 'Spara ändringar' : 'Lägg till kort'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Effect row: one line per effect with type-specific controls ─────────

function EffectRow({
  effect,
  index,
  onChange,
  onRemove,
}: {
  effect: CardEffect;
  index: number;
  onChange: (patch: Partial<CardEffect>) => void;
  onRemove: () => void;
}) {
  const meta = EFFECT_LABELS[effect.kind];
  return (
    <div className={`border rounded-lg p-3 ${meta.color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white">
          #{index + 1} · {meta.icon} {meta.name}
        </span>
        <button
          onClick={onRemove}
          className="text-[10px] text-red-300 hover:text-red-200 bg-red-900/30 hover:bg-red-800/50 px-2 py-0.5 rounded"
        >Ta bort</button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {/* Target — all effects have a target */}
        <div>
          <label className="text-zinc-400 block mb-0.5">Mål</label>
          <select
            value={effect.target}
            onChange={e => onChange({ target: e.target.value as CardEffect['target'] })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
          >
            <option value="self">Sig själv</option>
            <option value="chosen">Vald motspelare</option>
            <option value="all_opponents">Alla motspelare</option>
            {effect.kind === 'damage' && <option value="next_player">Nästa spelare</option>}
          </select>
        </div>

        {/* Amount/count — kind-specific */}
        {effect.kind === 'damage' && (
          <div>
            <label className="text-zinc-400 block mb-0.5">HP skada</label>
            <input
              type="number" min={1} max={3}
              value={effect.amount}
              onChange={e => onChange({ amount: parseInt(e.target.value) || 1 })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white font-mono"
            />
          </div>
        )}
        {effect.kind === 'heal' && (
          <div>
            <label className="text-zinc-400 block mb-0.5">Belopp</label>
            <select
              value={String(effect.amount)}
              onChange={e => {
                const v = e.target.value;
                onChange({ amount: v === 'max' ? 'max' : (parseInt(v) || 1) });
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
            >
              <option value="max">Till max (2 HP)</option>
              <option value="1">+1 HP</option>
            </select>
          </div>
        )}
        {(effect.kind === 'draw' || effect.kind === 'discard' || effect.kind === 'steal') && (
          <div>
            <label className="text-zinc-400 block mb-0.5">Antal kort</label>
            <input
              type="number" min={1} max={10}
              value={effect.count}
              onChange={e => onChange({ count: parseInt(e.target.value) || 1 })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
}
