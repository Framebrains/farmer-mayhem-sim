'use client';

import { CARD_DATABASE } from '@/lib/cardDatabase';

/** Compact color-coded card pill. Same-coloured by card type so hands are scannable. */
function pillStyle(cardId: string): string {
  const def = CARD_DATABASE[cardId];
  if (!def) return 'bg-zinc-700 text-zinc-200 border-zinc-600';

  // Specific overrides for important cards
  if (cardId === 'insurance') return 'bg-emerald-900/60 text-emerald-200 border-emerald-700';
  if (cardId === 'god_mode')  return 'bg-blue-900/70 text-blue-200 border-blue-700';

  switch (def.type) {
    case 'attack':
      return 'bg-red-900/50 text-red-200 border-red-800';
    case 'specialty':
      if (def.timing === 'any_time')
        return 'bg-blue-900/40 text-blue-200 border-blue-800';
      return 'bg-teal-900/50 text-teal-200 border-teal-800';
    case 'stationary':
      return 'bg-amber-900/50 text-amber-200 border-amber-800';
    default:
      return 'bg-zinc-700 text-zinc-200 border-zinc-600';
  }
}

interface CardPillProps {
  cardId: string;
  count?: number;
  size?: 'sm' | 'md';
}

export default function CardPill({ cardId, count, size = 'sm' }: CardPillProps) {
  const name = CARD_DATABASE[cardId]?.name ?? cardId;
  const sizeClass = size === 'md'
    ? 'text-xs px-2.5 py-1'
    : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClass} ${pillStyle(cardId)}`}>
      {name}
      {count && count > 1 && (
        <span className="opacity-70 font-bold">×{count}</span>
      )}
    </span>
  );
}

/** Render a list of cards with duplicates collapsed (e.g. "C4-Goat ×3, Insurance"). */
export function CardPillList({ cards, size = 'sm' }: { cards: string[]; size?: 'sm' | 'md' }) {
  if (!cards || cards.length === 0) {
    return <span className="text-xs text-zinc-600 italic">(tom hand)</span>;
  }
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
  // Stable order: by card type then name
  const entries = Array.from(counts.entries()).sort((a, b) => {
    const ta = CARD_DATABASE[a[0]]?.type ?? 'z';
    const tb = CARD_DATABASE[b[0]]?.type ?? 'z';
    if (ta !== tb) return ta.localeCompare(tb);
    const na = CARD_DATABASE[a[0]]?.name ?? a[0];
    const nb = CARD_DATABASE[b[0]]?.name ?? b[0];
    return na.localeCompare(nb);
  });
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([cardId, count]) => (
        <CardPill key={cardId} cardId={cardId} count={count} size={size} />
      ))}
    </div>
  );
}
