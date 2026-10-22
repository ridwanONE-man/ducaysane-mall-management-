import React from 'react';

export interface CurrencyCardBox {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CurrencyCardProps {
  currency: 'USD' | 'SSP';
  subtitle: string;
  boxes: CurrencyCardBox[];
}

// Money summary for one currency: dark card for dollars, orange card for SSP.
export const CurrencyCard: React.FC<CurrencyCardProps> = ({ currency, subtitle, boxes }) => {
  const usd = currency === 'USD';
  return (
    <div className={`relative overflow-hidden rounded-3xl p-5 text-white ${usd ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-orange-500 to-amber-500'}`}>
      <div className="absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-3">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${usd ? 'bg-orange-500' : 'bg-white/20'}`}>
          {usd ? <span className="text-lg">$</span> : <span className="text-[11px]">SSP</span>}
        </span>
        <div>
          <p className="text-sm font-extrabold">{usd ? 'Dollar ($)' : 'South Sudanese Pound'}</p>
          <p className="text-[11px] opacity-70">{subtitle}</p>
        </div>
      </div>
      <div className="relative grid grid-cols-2 gap-2 mt-4">
        {boxes.map(b => (
          <div key={b.label} className="rounded-2xl bg-white/10 px-3 py-2 min-w-0">
            <span className="flex items-center gap-1 text-[10px] font-bold opacity-80"><b.icon className="w-3 h-3" /> {b.label}</span>
            <span className="block text-base font-black truncate" title={b.value}>{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  progress?: number; // 0-100, draws a bar under the value
  chips: { label: string; value: string | number; tone: string }[];
}

// Dark headline card shown before the currency cards.
export const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon: Icon, progress, chips }) => (
  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
    <div className="absolute -right-8 -bottom-10 w-32 h-32 rounded-full bg-orange-500/20" />
    <div className="relative flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{label}</span>
      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
    </div>
    <p className="relative text-4xl font-black mt-1">{value}</p>
    {progress !== undefined && (
      <div className="relative mt-2 h-2 rounded-full bg-white/15 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
    )}
    <div className={`relative grid gap-2 mt-3 ${chips.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {chips.map(c => (
        <div key={c.label} className="rounded-xl bg-white/10 px-2.5 py-1.5 min-w-0">
          <span className={`block text-[10px] font-bold truncate ${c.tone}`}>{c.label}</span>
          <span className="text-base font-black">{c.value}</span>
        </div>
      ))}
    </div>
  </div>
);
