'use client';

import { SimulationStats, SingleGameResult, GameEvent } from '@/lib/types';
import { CARD_DATABASE } from '@/lib/cardDatabase';

const STRATEGY_LABELS: Record<string, string> = {
  aggressive: 'Aggressiv',
  defensive: 'Defensiv',
  balanced: 'Balanserad',
  random: 'Slumpmässig',
};

function cardName(cardId: string): string {
  return CARD_DATABASE[cardId]?.name ?? cardId;
}

function playerLabel(game: SingleGameResult, playerId: number): string {
  const result = game.playerResults.find(p => p.id === playerId);
  if (!result) return `Spelare ${playerId + 1}`;
  const stratLabel = STRATEGY_LABELS[result.strategy] ?? result.strategy;
  return `Spelare ${playerId + 1} (${stratLabel})`;
}

function formatEvent(event: GameEvent, game: SingleGameResult): string | null {
  const actor = playerLabel(game, event.actorId);
  const target = event.targetId !== undefined ? playerLabel(game, event.targetId) : '';

  switch (event.type) {
    case 'attack_declared':
      return `⚔️ ${actor} spelade **${cardName(event.cardId ?? '')}** mot ${target}`;
    case 'attack_hit':
      return `🎲 [${event.diceRoll ?? '?'}] — TRÄFF! ${target} tar 1 HP i skada`;
    case 'attack_missed':
      return `🎲 [${event.diceRoll ?? '?'}] — Miss!`;
    case 'attack_noped':
      return `🛡️ ${actor} spelade **God Mode** — blockerar!`;
    case 'attack_redirected':
      return `↩️ ${actor} omdirigerade attacken`;
    case 'player_damaged':
      return null; // skip, shown via attack_hit
    case 'player_eliminated':
      return `☠️ ${actor} eliminerad!`;
    case 'insurance_triggered':
      return `🏥 ${actor}s **Insurance** aktiverades — HP tillbaka till 2!`;
    case 'mad_cow_triggered':
      return `🐄 ${actor} drog **Mad Cow**! Tärning: [${event.diceRoll ?? '?'}]`;
    case 'card_played':
      if (!event.cardId) return null;
      return `🃏 ${actor} spelade **${cardName(event.cardId)}**`;
    case 'sacrifice_wheel_spun':
      return `🎡 Hjulet stannade på: ${event.detail ?? '?'}`;
    case 'haunted_barn_triggered':
      return `👻 **Haunted Barn** aktiveras — ${actor} tar skada`;
    case 'game_over':
      return null; // shown at top summary
    case 'draw':
      return null;
    default:
      return null;
  }
}

function renderEventText(text: string): React.ReactNode {
  // Bold text between **...**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

interface TurnGroup {
  turn: number;
  actorId: number;
  events: GameEvent[];
}

function groupByTurn(events: GameEvent[], game: SingleGameResult): TurnGroup[] {
  const map = new Map<number, TurnGroup>();
  for (const event of events) {
    if (!map.has(event.turn)) {
      map.set(event.turn, { turn: event.turn, actorId: event.actorId, events: [] });
    }
    map.get(event.turn)!.events.push(event);
  }
  return Array.from(map.values()).sort((a, b) => a.turn - b.turn);
}

function GameLog({ game }: { game: SingleGameResult }) {
  const winnerText = game.isDraw
    ? 'Oavgjort'
    : game.winnerId !== null
    ? playerLabel(game, game.winnerId)
    : 'Okänd vinnare';

  const turns = groupByTurn(game.events, game);

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-zinc-200">
          Spel slutade på runda{' '}
          <span className="text-emerald-400">{game.turnsPlayed}</span> —{' '}
          <span className={game.isDraw ? 'text-yellow-400' : 'text-emerald-400'}>{winnerText}</span>
        </p>
      </div>

      {/* Turn-by-turn log */}
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-y-auto"
        style={{ maxHeight: '520px' }}
      >
        {turns.map(group => {
          const actorLabel = playerLabel(game, group.actorId);
          const renderedEvents = group.events
            .map(e => formatEvent(e, game))
            .filter((t): t is string => t !== null);

          if (renderedEvents.length === 0) return null;

          return (
            <div key={group.turn} className="border-b border-zinc-800 last:border-b-0">
              {/* Turn header */}
              <div className="px-4 py-2 bg-zinc-800/60 sticky top-0">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                  Runda {group.turn} — {actorLabel}s tur
                </span>
              </div>
              {/* Events */}
              <ul className="px-4 py-2 space-y-1">
                {renderedEvents.map((text, i) => {
                  const isEliminated = text.startsWith('☠️');
                  const isHit = text.startsWith('🎲') && text.includes('TRÄFF');
                  const isInsurance = text.startsWith('🏥');
                  return (
                    <li
                      key={i}
                      className={`text-sm leading-snug ${
                        isEliminated
                          ? 'text-red-400'
                          : isHit
                          ? 'text-orange-400'
                          : isInsurance
                          ? 'text-green-400'
                          : 'text-zinc-300'
                      }`}
                    >
                      {renderEventText(text)}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Final HP summary */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Slutresultat</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {game.playerResults.map(p => (
            <div
              key={p.id}
              className={`rounded-lg p-3 text-center ${
                p.id === game.winnerId
                  ? 'bg-emerald-900/40 border border-emerald-700'
                  : 'bg-zinc-700/40 border border-zinc-600'
              }`}
            >
              <p className="text-xs text-zinc-400 mb-1">{playerLabel(game, p.id)}</p>
              <p className={`text-lg font-bold ${p.id === game.winnerId ? 'text-emerald-400' : p.finalHp <= 0 ? 'text-red-400' : 'text-white'}`}>
                {p.finalHp} HP
              </p>
              <p className="text-xs text-zinc-500 mt-1">{p.cardsPlayed} kort spelade</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GameLogTab({ stats }: { stats: SimulationStats }) {
  if (!stats.sampleGame) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-zinc-500 text-sm">Kör en simulering för att se spelloggen</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">
          Spellog — Spel #1 av {stats.totalGames.toLocaleString()}
        </h2>
        <span className="text-xs text-zinc-500">Visar det första simulerade spelet</span>
      </div>
      <GameLog game={stats.sampleGame} />
    </div>
  );
}
