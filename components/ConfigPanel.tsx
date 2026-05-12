'use client';

import { useState } from 'react';
import { SimConfig, Strategy } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';

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

// ALL cards — including traps (Mad Cow). Traps don't go to hands, but they
// ARE shuffled into the deck and we should let the user configure them.
const ALL_CARDS = Object.values(CARD_DATABASE);

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
                          <div key={card.id} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${isModified ? 'text-orange-400' : 'text-zinc-200'}`}>
                                {card.name}
                                {isTrap && <span className="ml-1.5 text-[9px] bg-purple-900/60 text-purple-300 px-1 py-0.5 rounded">HUSKORT</span>}
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
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-zinc-700 flex items-center justify-end gap-2 bg-zinc-900/50">
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
    </div>
  );
}
