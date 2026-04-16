'use client';

import { RedFlag } from '@/lib/types';

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-900/30', border: 'border-red-700', icon: '!!', iconBg: 'bg-red-600' },
  warning: { bg: 'bg-orange-900/30', border: 'border-orange-700', icon: '!', iconBg: 'bg-orange-600' },
  info: { bg: 'bg-blue-900/30', border: 'border-blue-700', icon: 'i', iconBg: 'bg-blue-600' },
};

export default function FlagItem({ flag }: { flag: RedFlag }) {
  const style = SEVERITY_STYLES[flag.severity];

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <span className={`${style.iconBg} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5`}>
          {style.icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-white">{flag.message}</p>
          <p className="text-sm text-zinc-300 mt-1">{flag.detail}</p>
          <p className="text-sm text-zinc-400 mt-2 italic">{flag.suggestion}</p>
        </div>
      </div>
    </div>
  );
}
