import React from 'react';
import { Minus, Plus } from 'lucide-react';

// "1 year 3 months", "2 years", "5 months"
export function formatDuration(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [
    years ? `${years} year${years === 1 ? '' : 's'}` : '',
    months ? `${months} month${months === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return parts.join(' ') || '0 months';
}

const QUICK = [
  { label: '1 mo', months: 1 },
  { label: '3 mo', months: 3 },
  { label: '6 mo', months: 6 },
  { label: '1 yr', months: 12 },
  { label: '2 yrs', months: 24 },
  { label: '3 yrs', months: 36 },
];

const MAX_MONTHS = 120;

interface DurationPickerProps {
  months: number; // total lease length in months
  onChange: (months: number) => void;
}

// Lease length as years + months. 12 months roll over into a year automatically.
export const DurationPicker: React.FC<DurationPickerProps> = ({ months, onChange }) => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const set = (total: number) => onChange(Math.min(MAX_MONTHS, Math.max(1, total)));

  const stepper = (label: string, value: number, step: number, max: number) => (
    <div className="flex-1 min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => set(months - step)}
          disabled={label === 'Years' ? value <= 0 : months <= 1}
          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-30 cursor-pointer"
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={e => {
            const v = Math.max(0, Math.min(max, parseInt(e.target.value) || 0));
            set(label === 'Years' ? v * 12 + rest : years * 12 + v);
          }}
          className="flex-1 min-w-0 w-full text-center text-sm font-black text-slate-900 focus:outline-none [appearance:textfield]"
        />
        <button
          type="button"
          onClick={() => set(months + step)}
          disabled={months + step > MAX_MONTHS}
          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-30 cursor-pointer"
          aria-label={`More ${label.toLowerCase()}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        {stepper('Years', years, 12, 10)}
        {stepper('Months', rest, 1, 11)}
      </div>
      {/* Quick picks: one even row */}
      <div className="grid grid-cols-6 gap-1 p-1 bg-slate-100 rounded-xl">
        {QUICK.map(q => (
          <button
            key={q.months}
            type="button"
            onClick={() => set(q.months)}
            className={`py-1.5 rounded-lg text-[11px] font-bold text-center whitespace-nowrap transition-all cursor-pointer ${
              months === q.months
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-orange-700'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 px-3 py-1.5 text-[11px]">
        <span className="text-slate-600">Lease length</span>
        <span className="font-black text-orange-700">
          {formatDuration(months)}
          {months >= 12 && <span className="font-semibold text-slate-400"> • {months} months</span>}
        </span>
      </div>
    </div>
  );
};
