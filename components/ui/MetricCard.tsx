'use client';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  /** Optional small "± X" line below the value (95% confidence interval) */
  ci?: string;
}

export default function MetricCard({ label, value, subtitle, ci }: MetricCardProps) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5">
      <p className="text-zinc-400 text-sm font-medium">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {ci && (
        <p className="text-zinc-400 text-[11px] font-mono mt-0.5" title="95% konfidensintervall">
          {ci}
        </p>
      )}
      {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}
