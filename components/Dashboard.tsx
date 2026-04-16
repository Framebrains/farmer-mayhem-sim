'use client';

import { useState } from 'react';
import { SimulationStats } from '@/lib/types';
import OverviewTab from '@/components/tabs/OverviewTab';
import CardPowerTab from '@/components/tabs/CardPowerTab';
import StrategyTab from '@/components/tabs/StrategyTab';
import PlayerCountTab from '@/components/tabs/PlayerCountTab';
import RedFlagsTab from '@/components/tabs/RedFlagsTab';
import GameLogTab from '@/components/tabs/GameLogTab';

type TabId = 'overview' | 'cards' | 'strategy' | 'playercount' | 'redflags' | 'gamelog';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Översikt' },
  { id: 'cards', label: 'Kortstyrka' },
  { id: 'strategy', label: 'Strategianalys' },
  { id: 'playercount', label: 'Spelarantal' },
  { id: 'redflags', label: 'Röda flaggor' },
  { id: 'gamelog', label: 'Spellog' },
];

interface DashboardProps {
  stats: SimulationStats;
}

export default function Dashboard({ stats }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [savedRuns, setSavedRuns] = useState<SimulationStats[]>([]);

  const criticalCount = stats.redFlags.filter(f => f.severity === 'critical').length;
  const warningCount = stats.redFlags.filter(f => f.severity === 'warning').length;

  function saveRun() {
    if (savedRuns.length < 3 && !savedRuns.includes(stats)) {
      setSavedRuns(prev => [...prev, stats]);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-zinc-700 bg-zinc-900">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-emerald-500'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
            {tab.id === 'redflags' && (criticalCount > 0 || warningCount > 0) && (
              <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                criticalCount > 0 ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'
              }`}>
                {criticalCount + warningCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 md:p-6">
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'cards' && <CardPowerTab stats={stats} />}
        {activeTab === 'strategy' && <StrategyTab stats={stats} />}
        {activeTab === 'playercount' && (
          <PlayerCountTab
            currentStats={stats}
            savedRuns={savedRuns}
            onSave={saveRun}
            onClear={() => setSavedRuns([])}
          />
        )}
        {activeTab === 'redflags' && <RedFlagsTab stats={stats} />}
        {activeTab === 'gamelog' && <GameLogTab stats={stats} />}
      </div>
    </div>
  );
}
