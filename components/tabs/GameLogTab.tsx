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

/**
 * Display number for a player: the one who won the opening dice roll is always
 * "Spelare 1", the next clockwise is "Spelare 2", etc.
 */
function displayNum(game: SingleGameResult, playerId: number): number {
  const n = game.playerCount;
  return ((playerId - game.startingPlayerId + n) % n) + 1;
}

function playerLabel(game: SingleGameResult, playerId: number): string {
  const result = game.playerResults.find(p => p.id === playerId);
  const strat = result ? STRATEGY_LABELS[result.strategy] ?? result.strategy : '?';
  return `Spelare ${displayNum(game, playerId)} (${strat})`;
}

// Short name for inline use in sentences
function pName(game: SingleGameResult, playerId: number): string {
  return `Sp.${displayNum(game, playerId)}`;
}

/** Format a card list as "Card A, Card B, Card C" */
function cardList(cards: string[] | undefined): string {
  if (!cards || cards.length === 0) return '?';
  return cards.map(cardName).join(', ');
}

/** Format a single event as a Swedish sentence. Returns null to skip. */
function formatEvent(event: GameEvent, game: SingleGameResult): { text: string; color: string } | null {
  const actor = playerLabel(game, event.actorId);
  const actorShort = pName(game, event.actorId);
  const target = event.targetId !== undefined ? playerLabel(game, event.targetId) : '';

  switch (event.type) {

    case 'attack_declared':
      return {
        text: `⚔️  ${actor} spelade **${cardName(event.cardId ?? '')}** mot ${target}`,
        color: 'text-yellow-300',
      };

    case 'attack_hit':
      return {
        text: `🎲  Tärning: ${event.diceRoll} — TRÄFF! ${target} tar 1 HP i skada`,
        color: 'text-red-400',
      };

    case 'attack_missed':
      return {
        text: `🎲  Tärning: ${event.diceRoll} — Miss, ingen skada`,
        color: 'text-zinc-400',
      };

    case 'attack_noped':
      return {
        text: `🛡️  ${actor} spelade **God Mode** och blockerar attacken!`,
        color: 'text-blue-400',
      };

    case 'attack_redirected': {
      const newTarget = event.targetId !== undefined ? playerLabel(game, event.targetId) : '?';
      const cardUsed = event.cardId ? ` (**${cardName(event.cardId)}**)` : '';
      return {
        text: `↩️  ${actor} omdirigerar attacken → ${newTarget}${cardUsed}`,
        color: 'text-purple-400',
      };
    }

    case 'player_damaged':
      return null; // already shown via attack_hit

    case 'player_eliminated':
      return {
        text: `☠️  ${actor} är eliminerad!`,
        color: 'text-red-500',
      };

    case 'insurance_triggered':
      return {
        text: `🏥  ${actor}s **Insurance** aktiveras automatiskt — HP återställt till 2!`,
        color: 'text-emerald-400',
      };

    case 'mad_cow_triggered':
      return {
        text: `🐄  ${actor} drog **Mad Cow**! Tärning: ${event.diceRoll}${event.diceRoll && event.diceRoll % 2 !== 0 ? ' — ojämnt, tar 1 HP skada' : ' — jämnt, säker!'}`,
        color: 'text-orange-400',
      };

    case 'haunted_barn_triggered':
      return {
        text: `👻  **Haunted Barn** aktiveras på ${actor}s gård (< 2 kort på hand) — tar 1 HP skada`,
        color: 'text-red-400',
      };

    case 'sacrifice_wheel_spun':
      return {
        text: `🎡  ${actor} spelade **The Sacrifice** — hjulet stannade på: **${event.detail ?? '?'}**`,
        color: 'text-pink-400',
      };

    case 'card_played': {
      if (!event.cardId) return null;
      const cid = event.cardId;

      switch (cid) {
        case 'haunted_barn':
          return {
            text: `👻  ${actor} placerar **Haunted Barn** på ${target}s gård`,
            color: 'text-purple-300',
          };
        case 'senile_grandma':
          return {
            text: `👵  ${actor} placerar **Senile Grandma** på sin egen gård (absorberar nästa attack)`,
            color: 'text-green-400',
          };
        case 'steal':
          return {
            text: `🤚  ${actor} stjäl **${cardList(event.cards)}** från ${target}`,
            color: 'text-orange-300',
          };
        case 'identity_theft':
          return {
            text: `🔄  ${actor} byter HP och stationary-kort med ${target} (**Identity Theft**)`,
            color: 'text-indigo-400',
          };
        case 'moonshine_night':
          return {
            text: `🌙  ${actor} byter hela handen med ${target} (**Moonshine Night**)`,
            color: 'text-indigo-300',
          };
        case 'skinny_dipping':
          return {
            text: `🎲  ${actor} utmanar ${target} i tärningsduel (**Skinny Dipping**) — vinnaren drar 2 kort`,
            color: 'text-cyan-400',
          };
        case 'polacken':
          return {
            text: event.cards && event.cards.length > 0
              ? `🃏  ${actor} spelar **Polacken** och drar: **${cardList(event.cards)}**`
              : `🃏  ${actor} spelar **Polacken** och drar 3 kort`,
            color: 'text-teal-400',
          };
        case 'begger':
          return {
            text: event.cards && event.cards.length > 0
              ? `🙏  ${actor} spelar **Begger** — fick: **${cardList(event.cards)}**`
              : `🙏  ${actor} spelar **Begger** — ingen gav något`,
            color: 'text-teal-300',
          };
        case 'silvertejp':
          return {
            text: `🩹  ${actor} spelar **Silvertejp** och läker till 2 HP`,
            color: 'text-green-400',
          };
        case 'loot_the_corpse':
          return {
            text: `💀  ${actor} plundrar ${target}s hand med **Loot the Corpse**`,
            color: 'text-orange-400',
          };
        case 'oppenheimer':
          return {
            text: `☢️  ${actor} spelar **Oppenheimer** — stjäl alla C4-Goat från motståndarna`,
            color: 'text-red-300',
          };
        case 'blottaren':
          return {
            text: `👁️  ${actor} spelar **Blottaren** — ${target}s hand exponeras`,
            color: 'text-zinc-300',
          };
        case 'stop_it':
          return {
            text: `✋  ${actor} spelar **Stop It** — ${target}s tur avbryts!`,
            color: 'text-yellow-400',
          };
        case 'god_mode':
          return null; // shown via attack_noped
        default:
          return {
            text: `🃏  ${actor} spelar **${cardName(cid)}**`,
            color: 'text-zinc-300',
          };
      }
    }

    case 'draw':
      if (!event.cardId) return null;
      return {
        text: `📥  ${actorShort} drar: **${cardName(event.cardId)}**`,
        color: 'text-zinc-500',
      };

    case 'turn_start':
    case 'game_over':
      return null;

    default:
      return null;
  }
}

function bold(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

interface PlayerTurnGroup {
  turnNumber: number;
  actorId: number;
  events: GameEvent[];
}

interface RoundGroup {
  round: number;
  turns: PlayerTurnGroup[];
}

function buildRounds(game: SingleGameResult): RoundGroup[] {
  // Group events by turn number.
  // The section header (actorId) is always taken from the 'turn_start' event so it
  // correctly reflects WHOSE TURN it is — not who reacted first.
  const turnMap = new Map<number, PlayerTurnGroup>();
  for (const event of game.events) {
    if (!turnMap.has(event.turn)) {
      turnMap.set(event.turn, { turnNumber: event.turn, actorId: event.actorId, events: [] });
    }
    // Override actorId with the turn_start event's actorId (= current turn player)
    if (event.type === 'turn_start') {
      turnMap.get(event.turn)!.actorId = event.actorId;
    }
    // Don't add turn_start itself to the events list (no visible log entry needed)
    if (event.type !== 'turn_start') {
      turnMap.get(event.turn)!.events.push(event);
    }
  }

  const turns = Array.from(turnMap.values()).sort((a, b) => a.turnNumber - b.turnNumber);

  // Group turns into rounds: round N = ceil(turnNumber / playerCount)
  const roundMap = new Map<number, RoundGroup>();
  for (const turn of turns) {
    const round = Math.ceil(turn.turnNumber / game.playerCount);
    if (!roundMap.has(round)) {
      roundMap.set(round, { round, turns: [] });
    }
    roundMap.get(round)!.turns.push(turn);
  }

  return Array.from(roundMap.values()).sort((a, b) => a.round - b.round);
}

function PlayerTurn({ turn, game }: { turn: PlayerTurnGroup; game: SingleGameResult }) {
  const label = playerLabel(game, turn.actorId);
  const formatted = turn.events
    .map(e => formatEvent(e, game))
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (formatted.length === 0) return null;

  return (
    <div className="pl-4 border-l-2 border-zinc-700 space-y-1.5 py-2">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">{label}s tur</p>
      {formatted.map((item, i) => (
        <p key={i} className={`text-sm leading-snug ${item.color}`}>
          {bold(item.text)}
        </p>
      ))}
    </div>
  );
}

function GameLog({ game }: { game: SingleGameResult }) {
  const rounds = buildRounds(game);
  const winnerText = game.isDraw
    ? 'Oavgjort'
    : game.winnerId !== null
    ? playerLabel(game, game.winnerId)
    : 'Okänd vinnare';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-zinc-400">Vinnare: </span>
          <span className={game.isDraw ? 'text-yellow-400 font-semibold' : 'text-emerald-400 font-semibold'}>{winnerText}</span>
        </div>
        <div>
          <span className="text-zinc-400">Rundor: </span>
          <span className="text-white font-semibold">{rounds.length}</span>
          <span className="text-zinc-500 text-xs ml-1">({game.playerCount} spelare)</span>
        </div>
        <div>
          <span className="text-zinc-400">Startar: </span>
          <span className="text-zinc-200 font-semibold">{playerLabel(game, game.startingPlayerId)}</span>
          <span className="text-zinc-500 text-xs ml-1">(vann tärningsslaget)</span>
        </div>
      </div>
      {/* Player renumbering note */}
      <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg px-3 py-2 text-xs text-zinc-500">
        🎲 Spelarna är namngivna i turordning — den som vann tärningsslaget är <strong className="text-zinc-400">Spelare 1</strong>, nästa medsols är Spelare 2, osv.
      </div>

      {/* Round-by-round log */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-y-auto" style={{ maxHeight: '580px' }}>
        {rounds.map(round => (
          <div key={round.round} className="border-b border-zinc-800 last:border-b-0">
            {/* Round header */}
            <div className="px-4 py-2.5 bg-zinc-800/80 sticky top-0 z-10">
              <span className="text-sm font-bold text-zinc-200">Runda {round.round}</span>
            </div>
            {/* Player turns within round */}
            <div className="px-4 py-2 space-y-3">
              {round.turns.map(turn => (
                <PlayerTurn key={turn.turnNumber} turn={turn} game={game} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Final HP */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Slutresultat</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {game.playerResults.map(p => (
            <div
              key={p.id}
              className={`rounded-lg p-3 text-center border ${
                p.id === game.winnerId
                  ? 'bg-emerald-900/40 border-emerald-700'
                  : 'bg-zinc-700/30 border-zinc-600'
              }`}
            >
              <p className="text-xs text-zinc-400 mb-1">{playerLabel(game, p.id)}</p>
              <p className={`text-xl font-bold ${
                p.id === game.winnerId ? 'text-emerald-400' : p.finalHp <= 0 ? 'text-red-400' : 'text-white'
              }`}>
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
        <h2 className="text-sm font-semibold text-zinc-300">Spellog — Exempelspel</h2>
        <span className="text-xs text-zinc-500">Visar ett slumpmässigt valt spel ur simuleringen</span>
      </div>
      <GameLog game={stats.sampleGame} />
    </div>
  );
}
