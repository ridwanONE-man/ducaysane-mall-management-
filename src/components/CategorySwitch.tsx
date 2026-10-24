import React from 'react';
import { Building2, Store, LayoutGrid } from 'lucide-react';
import { PropertyUnit } from '../types';
import { normalizeUnitNumber } from '../utils/printUtils';

export type UnitCategory = 'all' | 'shop' | 'space';

// Shops are "G..." units, spaces are "BW..." units; the unit record wins when it is known.
export function unitCategoryOf(unitNumber: string | undefined, units: PropertyUnit[] = []): 'shop' | 'space' | null {
  if (!unitNumber) return null;
  const key = normalizeUnitNumber(unitNumber);
  const unit = units.find(u => normalizeUnitNumber(u.unitNumber) === key);
  if (unit) return unit.type === 'Space' || unit.categoryType === 'Space' ? 'space' : 'shop';
  if (/^bw/.test(key)) return 'space';
  if (/^g/.test(key)) return 'shop';
  return null;
}

interface CategorySwitchProps {
  value: UnitCategory;
  onChange: (value: UnitCategory) => void;
  counts: Record<UnitCategory, number>;
  noun: string; // e.g. "entries", "tenants"
}

const OPTIONS: { value: UnitCategory; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { value: 'all', label: 'All', icon: Building2, tone: 'from-slate-700 to-slate-900' },
  { value: 'shop', label: 'Shops', icon: Store, tone: 'from-orange-500 to-amber-500' },
  { value: 'space', label: 'Spaces', icon: LayoutGrid, tone: 'from-sky-500 to-blue-500' },
];

// Three tiles to switch a page between all units, shops only and spaces only.
export const CategorySwitch: React.FC<CategorySwitchProps> = ({ value, onChange, counts, noun }) => (
  <div className="grid grid-cols-3 gap-2 sm:gap-3">
    {OPTIONS.map(o => {
      const active = value === o.value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`relative flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 rounded-2xl p-2.5 sm:p-4 text-center sm:text-left border transition-all cursor-pointer ${
            active
              ? `bg-gradient-to-br ${o.tone} text-white border-transparent shadow-lg`
              : 'bg-white border-slate-200/80 hover:border-orange-200 hover:shadow-sm'
          }`}
        >
          <span className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center ${active ? 'bg-white/20' : `bg-gradient-to-br ${o.tone} text-white shadow-sm`}`}>
            <o.icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
          <span className="min-w-0">
            <span className={`block text-xs sm:text-sm font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>{o.label}</span>
            <span className={`block text-[11px] ${active ? 'text-white/80' : 'text-slate-500'}`}>{counts[o.value]} {noun}</span>
          </span>
        </button>
      );
    })}
  </div>
);
