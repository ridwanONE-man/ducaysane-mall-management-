import React from 'react';
import { DoorOpen, Hourglass, UserPlus, ArrowRight, CalendarClock, AlertTriangle, CheckCircle2, Store } from 'lucide-react';
import { PropertyUnit, NavigationTab } from '../types';
import { parsePaymentDate, formatLongDate } from '../utils/printUtils';
import { formatBoth, formatUnitRent, unitCurrency, unitRent } from '../utils/currency';

interface DashboardLeaseBoxesProps {
  units: PropertyUnit[];
  onLeaseUnit: (unit: PropertyUnit) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const EXPIRING_WITHIN_DAYS = 10;

const isShopUnit = (u: PropertyUnit) => u.type === 'Shop' || u.categoryType === 'Shop' || u.unitNumber.startsWith('G');

// Whole days from today until the lease end date (negative once it has passed)
function daysUntil(dateStr?: string): number | null {
  const end = parsePaymentDate(dateStr);
  if (!end) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

const countdownStyle = (days: number) =>
  days <= 3 ? 'bg-rose-600 text-white' : days <= 7 ? 'bg-amber-500 text-white' : 'bg-yellow-100 text-yellow-800';

export const DashboardLeaseBoxes: React.FC<DashboardLeaseBoxesProps> = ({ units, onLeaseUnit, onNavigate }) => {
  const available = units.filter(u => u.occupancyStatus === 'Available' || !u.currentTenant);
  const availableShops = available.filter(isShopUnit).length;
  const vacantArea = available.reduce((s, u) => s + (u.sizeSqM || 0), 0);
  const potentialUSD = available.filter(u => unitCurrency(u) === 'USD').reduce((s, u) => s + unitRent(u), 0);
  const potentialSSP = available.filter(u => unitCurrency(u) === 'SSP').reduce((s, u) => s + unitRent(u), 0);

  const leased = units
    .filter(u => u.currentTenant && u.occupancyStatus !== 'Available')
    .map(u => ({ unit: u, days: daysUntil(u.leaseEnd || u.currentTenant?.leaseEnd) }))
    .filter((x): x is { unit: PropertyUnit; days: number } => x.days !== null);
  const expiring = leased.filter(x => x.days >= 0 && x.days <= EXPIRING_WITHIN_DAYS).sort((a, b) => a.days - b.days);
  const expired = leased.filter(x => x.days < 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Available units */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-white shadow-xs">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-emerald-100/60" />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
                <DoorOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Available Units</p>
                <p className="text-3xl font-black text-slate-900 leading-none mt-1">{available.length}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('units')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            {[
              { label: 'Shops', value: String(availableShops) },
              { label: 'Spaces', value: String(available.length - availableShops) },
              { label: 'Vacant area', value: `${Math.round(vacantArea).toLocaleString()} m²` },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-emerald-50/70 border border-emerald-100 px-3 py-2">
                <span className="block text-[10px] font-semibold text-emerald-700">{s.label}</span>
                <span className="block text-sm font-black text-slate-900">{s.value}</span>
              </div>
            ))}
          </div>

          {available.length === 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> Fully occupied — every unit has a tenant.
            </div>
          ) : (
            <>
              <p className="mt-4 text-[11px] text-slate-500">
                Leasing these would add <strong className="text-emerald-700">{formatBoth(potentialUSD, potentialSSP)}/month</strong> in rent.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {available.slice(0, 8).map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onLeaseUnit(u)}
                    title={`Lease ${u.unitNumber} • ${u.floor} • ${formatUnitRent(u)}/mo`}
                    className="group inline-flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-600 hover:border-emerald-600 text-[11px] font-bold text-slate-700 hover:text-white transition-colors cursor-pointer"
                  >
                    <Store className="w-3 h-3 text-emerald-600 group-hover:text-white" />
                    {u.unitNumber}
                    <span className="text-[10px] font-semibold text-slate-400 group-hover:text-emerald-100">{formatUnitRent(u)}</span>
                    <UserPlus className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
                {available.length > 8 && (
                  <button
                    type="button"
                    onClick={() => onNavigate('units')}
                    className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold cursor-pointer hover:bg-emerald-100"
                  >
                    +{available.length - 8} more
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expiring soon */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-white shadow-xs">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-amber-100/60" />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                <Hourglass className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Expiring Soon</p>
                <p className="text-3xl font-black text-slate-900 leading-none mt-1">
                  {expiring.length}
                  <span className="text-xs font-bold text-slate-400 ml-1.5">within {EXPIRING_WITHIN_DAYS} days</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tenants')}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              Tenants <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {expiring.length === 0 ? (
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> No leases end in the next {EXPIRING_WITHIN_DAYS} days.
            </div>
          ) : (
            <ul className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
              {expiring.map(({ unit, days }) => (
                <li key={unit.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">{unit.currentTenant?.name}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="font-bold text-slate-700">{unit.unitNumber}</span>
                      <CalendarClock className="w-3 h-3" /> ends {formatLongDate(unit.leaseEnd)}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-black ${countdownStyle(days)}`}>
                    {days === 0 ? 'Ends today' : `${days} day${days === 1 ? '' : 's'} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {expired.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('tenants')}
              className="mt-3 w-full flex items-center justify-between gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {expired.length} lease{expired.length === 1 ? ' has' : 's have'} already expired — renew or vacate
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
