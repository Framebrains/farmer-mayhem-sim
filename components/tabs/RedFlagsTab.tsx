'use client';

import { SimulationStats } from '@/lib/types';
import FlagItem from '@/components/ui/FlagItem';

export default function RedFlagsTab({ stats }: { stats: SimulationStats }) {
  const criticals = stats.redFlags.filter(f => f.severity === 'critical');
  const warnings = stats.redFlags.filter(f => f.severity === 'warning');
  const infos = stats.redFlags.filter(f => f.severity === 'info');

  if (stats.redFlags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h3 className="text-lg font-semibold text-emerald-400">Inga balansbrister detekterade</h3>
        <p className="text-zinc-400 text-sm mt-2">Spelet ser balanserat ut baserat på simuleringen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        {criticals.length > 0 && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-red-400 font-bold text-lg">{criticals.length}</span>
            <span className="text-red-300 text-sm">Kritiska</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-orange-400 font-bold text-lg">{warnings.length}</span>
            <span className="text-orange-300 text-sm">Varningar</span>
          </div>
        )}
        {infos.length > 0 && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-blue-400 font-bold text-lg">{infos.length}</span>
            <span className="text-blue-300 text-sm">Info</span>
          </div>
        )}
      </div>

      {/* Flag lists */}
      {criticals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Kritiska</h3>
          {criticals.map((flag, i) => <FlagItem key={i} flag={flag} />)}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Varningar</h3>
          {warnings.map((flag, i) => <FlagItem key={i} flag={flag} />)}
        </div>
      )}
      {infos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Info</h3>
          {infos.map((flag, i) => <FlagItem key={i} flag={flag} />)}
        </div>
      )}
    </div>
  );
}
