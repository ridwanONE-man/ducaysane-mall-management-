import React, { useMemo, useState } from 'react';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Plus,
  CreditCard,
  Users,
  Store,
  LayoutGrid,
  ArrowRight,
  Sun,
  Moon,
  Sunrise,
} from 'lucide-react';
import { PropertyUnit, PaymentRecord, NavigationTab, DepositRecord } from '../types';
import { AssignTenantModal } from './AssignTenantModal';
import { DashboardLeaseBoxes } from './DashboardLeaseBoxes';
import { unitCategoryOf } from './CategorySwitch';
import { TenantAccount } from '../utils/tenantAccount';
import { depositIn } from '../utils/currency';
import { formatMoney, parsePaymentDate, formatLongDate } from '../utils/printUtils';
import { MONTH_NAMES } from '../utils/rentLedger';
import { BUSINESS_PROFILE } from '../data/businessProfile';

type Currency = 'USD' | 'SSP';

interface DashboardViewProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
  tenantAccounts: TenantAccount[];
  deposits?: DepositRecord[];
  onOpenAddUnit: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onSaveUnit?: (unit: PropertyUnit) => void;
  onSaveDeposit?: (deposit: DepositRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  units,
  payments,
  tenantAccounts,
  deposits = [],
  onOpenAddUnit,
  onNavigate,
  onSaveUnit,
  onSaveDeposit,
}) => {
  const today = new Date();
  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const [leasingUnit, setLeasingUnit] = useState<PropertyUnit | null>(null);
  const [chartCurrency, setChartCurrency] = useState<Currency>(() =>
    tenantAccounts.filter(a => a.currency === 'SSP').length > tenantAccounts.filter(a => a.currency === 'USD').length ? 'SSP' : 'USD'
  );

  // ---- Numbers ------------------------------------------------------------
  const isSpace = (u: PropertyUnit) => unitCategoryOf(u.unitNumber, units) === 'space';
  const isLeased = (u: PropertyUnit) => Boolean(u.currentTenant) && u.occupancyStatus !== 'Available';
  const shops = units.filter(u => !isSpace(u));
  const spaces = units.filter(isSpace);
  const leased = units.filter(isLeased).length;
  const occupancy = units.length ? Math.round((leased / units.length) * 100) : 0;

  const rentPayments = payments.filter(p => p.paymentMethod !== 'Security Deposit');
  const thisMonth = (p: PaymentRecord) => {
    const d = parsePaymentDate(p.date);
    return Boolean(d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth());
  };
  const collected = (c: Currency) => rentPayments.filter(p => p.currency === c && thisMonth(p)).reduce((s, p) => s + p.amount, 0);
  const owed = (c: Currency) => tenantAccounts.filter(a => a.currency === c).reduce((s, a) => s + a.balance, 0);
  const owingCount = tenantAccounts.filter(a => a.balance > 0).length;
  const held = deposits.filter(d => d.status === 'Held in Escrow');
  const heldIn = (c: Currency) => held.reduce((s, d) => s + depositIn(d, c), 0);

  const tiles = [
    { label: 'Occupancy', icon: Building2, tone: 'from-orange-500 to-amber-500', main: `${occupancy}%`, sub: `${leased} of ${units.length} units rented`, go: 'units' as NavigationTab },
    { label: `Rent • ${MONTH_NAMES[today.getMonth()]}`, icon: TrendingUp, tone: 'from-emerald-500 to-teal-500', main: formatMoney(collected('USD'), 'USD'), sub: formatMoney(collected('SSP'), 'SSP'), go: 'payments' as NavigationTab },
    { label: 'Owed now', icon: AlertTriangle, tone: 'from-rose-500 to-orange-500', main: formatMoney(owed('USD'), 'USD'), sub: `${formatMoney(owed('SSP'), 'SSP')} • ${owingCount} tenant${owingCount === 1 ? '' : 's'}`, go: 'payments' as NavigationTab },
    { label: 'Deposits held', icon: ShieldCheck, tone: 'from-blue-500 to-indigo-600', main: formatMoney(heldIn('USD'), 'USD'), sub: formatMoney(heldIn('SSP'), 'SSP'), go: 'deposits' as NavigationTab },
  ];

  // Rent collected in each of the last 6 months (by payment date)
  const chart = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const idx = todayIdx - 5 + i;
    const amount = rentPayments
      .filter(p => {
        const d = parsePaymentDate(p.date);
        return p.currency === chartCurrency && d && d.getFullYear() * 12 + d.getMonth() === idx;
      })
      .reduce((s, p) => s + p.amount, 0);
    return { idx, label: MONTH_NAMES[idx % 12].slice(0, 3), amount };
  }), [rentPayments, chartCurrency, todayIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  const chartMax = Math.max(1, ...chart.map(c => c.amount));
  const chartTotal = chart.reduce((s, c) => s + c.amount, 0);

  const recent = [...rentPayments]
    .sort((a, b) => (parsePaymentDate(b.date)?.getTime() || 0) - (parsePaymentDate(a.date)?.getTime() || 0))
    .slice(0, 6);

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const GreetIcon = hour < 12 ? Sunrise : hour < 17 ? Sun : Moon;
  const card = 'bg-white rounded-3xl border border-slate-200/80 shadow-xs';

  return (
    <div id="dashboard-view-container" className="p-3 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">

      {/* Welcome */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-lg">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-orange-500/20 blur-2xl" />
        <div className="absolute right-40 -bottom-24 w-56 h-56 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="relative p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold text-orange-300">
              <GreetIcon className="w-4 h-4" /> {greeting} • {formatLongDate(today)}
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-black tracking-tight">{BUSINESS_PROFILE.name}</h1>
            <p className="mt-1 text-sm text-slate-300">
              {leased} rented • {units.length - leased} available • {owingCount} tenant{owingCount === 1 ? '' : 's'} owing
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-orange-500/30 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" /> Take payment
            </button>
            <button data-edit
              type="button"
              onClick={onOpenAddUnit}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add unit
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tenants')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold cursor-pointer"
            >
              <Users className="w-4 h-4" /> Tenants
            </button>
          </div>
        </div>
      </div>

      {/* Four main numbers */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {tiles.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => onNavigate(t.go)}
              className={`group relative overflow-hidden text-left ${card} p-4 sm:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer`}
            >
              <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br ${t.tone} opacity-10 group-hover:opacity-20 transition-opacity`} />
              <span className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${t.tone} text-white flex items-center justify-center shadow-md`}>
                <Icon className="w-5 h-5" />
              </span>
              <p className="mt-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">{t.label}</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight truncate">{t.main}</p>
              <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 truncate">{t.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Available units & leases ending within 10 days */}
      <DashboardLeaseBoxes units={units} onLeaseUnit={setLeasingUnit} onNavigate={onNavigate} />

      {/* Rent chart + shops/spaces */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={`lg:col-span-2 ${card} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Rent collected</h2>
              <p className="text-xs text-slate-500">Last 6 months • {formatMoney(chartTotal, chartCurrency)}</p>
            </div>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
              {(['USD', 'SSP'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChartCurrency(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${chartCurrency === c ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600'}`}
                >
                  {c === 'USD' ? '$ Dollar' : 'SSP'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 h-48 flex items-end gap-2 sm:gap-4">
            {chart.map(c => {
              const now = c.idx === todayIdx;
              return (
                <div key={c.idx} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 min-w-0" title={`${c.label}: ${formatMoney(c.amount, chartCurrency)}`}>
                  <span className="text-[10px] font-black text-slate-500 truncate max-w-full">{c.amount ? formatMoney(c.amount, chartCurrency) : ''}</span>
                  <div className="w-full max-w-12 flex-1 flex items-end rounded-t-xl bg-slate-50">
                    <div
                      className={`w-full rounded-t-xl transition-all ${now ? 'bg-gradient-to-t from-orange-500 to-amber-400' : 'bg-gradient-to-t from-slate-800 to-slate-600'}`}
                      style={{ height: `${Math.max(c.amount ? 4 : 0, (c.amount / chartMax) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold ${now ? 'text-orange-600' : 'text-slate-500'}`}>{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${card} p-5`}>
          <h2 className="text-sm font-extrabold text-slate-900">Shops &amp; spaces</h2>
          <p className="text-xs text-slate-500">How full the centre is</p>
          <div className="mt-5 flex items-center justify-center">
            <div
              className="relative w-32 h-32 rounded-full"
              style={{ background: `conic-gradient(#f97316 ${occupancy * 3.6}deg, #f1f5f9 0deg)` }}
            >
              <div className="absolute inset-3 rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900">{occupancy}%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">rented</span>
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[{ label: 'Shops', icon: Store, list: shops, bar: 'from-orange-500 to-amber-500' }, { label: 'Spaces', icon: LayoutGrid, list: spaces, bar: 'from-blue-500 to-indigo-600' }].map(g => {
              const Icon = g.icon;
              const n = g.list.filter(isLeased).length;
              const pct = g.list.length ? Math.round((n / g.list.length) * 100) : 0;
              return (
                <div key={g.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700"><Icon className="w-3.5 h-3.5 text-slate-400" /> {g.label}</span>
                    <span className="font-bold text-slate-500">{n}/{g.list.length} • {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${g.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Latest payments */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Latest payments</h2>
            <p className="text-xs text-slate-500">The last money received</p>
          </div>
          <button type="button" onClick={() => onNavigate('payments')} className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer">
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map(p => {
              const space = unitCategoryOf(p.unitNumber, units) === 'space';
              return (
                <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 bg-gradient-to-br ${space ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-amber-500'}`}>
                    {p.tenantName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.tenantName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{p.unitNumber} • {p.accountingPeriod} • {formatLongDate(p.date)}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-black ${p.currency === 'SSP' ? 'text-orange-600' : 'text-emerald-600'}`}>+{formatMoney(p.amount, p.currency)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {leasingUnit && (
        <AssignTenantModal
          isOpen={leasingUnit !== null}
          onClose={() => setLeasingUnit(null)}
          unit={leasingUnit}
          onConfirmLease={(updatedUnit, newDeposit) => {
            onSaveUnit?.(updatedUnit);
            if (newDeposit) onSaveDeposit?.(newDeposit);
            setLeasingUnit(null);
          }}
        />
      )}
    </div>
  );
};
