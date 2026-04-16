'use client';

import { SimConfig, Strategy, DeckConfig } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';

interface ConfigPanelProps {
  config: SimConfig;
  onChange: (config: SimConfig) => void;
  onRun: () => void;
  isRunning: boolean;
  progress: number;
}

const STRATEGY_OPTIONS: Strategy[] = ['aggressive', 'defensive', 'balanced', 'random'];
const STRATEGY_LABELS: Record<Strategy, string> = {
  aggressive: 'Aggressiv',
  defensive: 'Defensiv',
  balanced: 'Balanserad',
  random: 'Slumpmässig',
};

const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const SIM_COUNTS = [100, 1000, 5000, 10000];

const NON_TRAP_CARDS = Object.values(CARD_DATABASE).filter(c => c.type !== 'trap');

export default function ConfigPanel({ config, onChange, onRun, isRunning, progress }: ConfigPanelProps) {
  function setPlayerCount(n: number) {
    const strategies = Array.from({ length: n }, (_, i) => config.strategies[i] || 'balanced');
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
        <div className="space-y-2">
          {Array.from({ length: config.playerCount }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-zinc-400 text-sm w-20">Spelare {i + 1}</span>
              <div className="flex gap-2 flex-wrap">
                {STRATEGY_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setStrategy(i, s)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      config.strategies[i] === s
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    {STRATEGY_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
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

      {/* Deck configuration */}
      <details className="group">
        <summary className="text-sm font-medium text-zinc-400 cursor-pointer select-none hover:text-zinc-200 transition-colors flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          Kortlekkonfiguration
          {Object.keys(config.deckConfig.overrides).length > 0 && (
            <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded-full ml-1">
              {Object.keys(config.deckConfig.overrides).length} ändrade
            </span>
          )}
        </summary>
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-2">
          {NON_TRAP_CARDS.map(card => {
            const count = getCardCount(card.id);
            const isModified = card.id in config.deckConfig.overrides;
            return (
              <div key={card.id} className="flex items-center gap-3">
                <span className={`text-sm flex-1 ${isModified ? 'text-orange-400' : 'text-zinc-300'}`}>
                  {card.name}
                </span>
                <span className="text-xs text-zinc-500 w-16 text-right">
                  standard: {card.count}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCardCount(card.id, Math.max(0, count - 1))}
                    className="w-6 h-6 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 text-sm font-bold"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-white text-sm font-mono">{count}</span>
                  <button
                    onClick={() => setCardCount(card.id, count + 1)}
                    className="w-6 h-6 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={resetDeck}
          className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Återställ standardlek
        </button>
      </details>

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
    </div>
  );
}
