import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Building2,
  Wallet,
  AlertTriangle,
  ShieldCheck,
  Hourglass,
  Trophy,
  Timer,
  Flame,
  CalendarClock,
  Store,
  LayoutGrid,
  CheckCircle2,
  Medal,
} from 'lucide-react';
import { CashflowTransaction, DepositRecord, PropertyUnit, WaitingEntry } from '../types';
import { TenantAccount, AccountMonth, coverageEndOf } from '../utils/tenantAccount';
import { unitCategoryOf } from './CategorySwitch';
import { formatMoney, parsePaymentDate, formatLongDate } from '../utils/printUtils';
import { MONTH_NAMES } from '../utils/rentLedger';
import { depositIn } from '../utils/currency';

type Currency = 'USD' | 'SSP';

// Rent is due on the 1st; paid by the 5th still counts as on time
const GRACE_DAYS = 5;
const DAY = 86_400_000;

interface AnalyticsViewProps {
  units: PropertyUnit[];
  tenantAccounts: TenantAccount[];
  deposits: DepositRecord[];
  cashflow: CashflowTransaction[]; // cashflow plus electricity, as listed on Cash Flow
  waitingList: WaitingEntry[];
}

const monthStart = (idx: number) => new Date(Math.floor(idx / 12), idx % 12, 1);

// When a month became fully paid: the latest payment that went into it
const paidOn = (m: AccountMonth) =>
  m.payments.reduce<Date | null>((latest, p) => {
    const d = parsePaymentDate(p.date);
    return d && (!latest || d > latest) ? d : latest;
  }, null);

const firstPaymentOn = (m: AccountMonth) =>
  m.payments.reduce<Date | null>((first, p) => {
    const d = parsePaymentDate(p.date);
    return d && (!first || d < first) ? d : first;
  }, null);

interface Behaviour {
  account: TenantAccount;
  onTime: number;
  early: number;
  late: number;
  missed: number; // past the grace days and still not fully paid
  avgDaysLate: number;
  score: number; // on-time share of months that are due, 0–100
  owed: number;
}

function behaviourOf(a: TenantAccount, today: Date): Behaviour {
  let onTime = 0, early = 0, late = 0, missed = 0, lateDays = 0;
  for (const m of a.months) {
    if (!m.contracted) continue;
    const due = monthStart(m.idx);
    const graceEnd = new Date(due.getTime() + GRACE_DAYS * DAY);
    if (m.status === 'paid') {
      const done = paidOn(m) || due;
      if (done <= graceEnd) {
        onTime++;
        if (done < due) early++;
      } else {
        late++;
        lateDays += Math.round((done.getTime() - graceEnd.getTime()) / DAY);
      }
    } else if (today > graceEnd) {
      missed++;
    }
  }
  const counted = onTime + late + missed;
  return {
    account: a,
    onTime,
    early,
    late,
    missed,
    avgDaysLate: late ? Math.round(lateDays / late) : 0,
    score: counted ? Math.round((onTime / counted) * 100) : 100,
    owed: a.balance,
  };
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ units, tenantAccounts, deposits, cashflow, waitingList }) => {
  const today = new Date();
  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const [chartCurrency, setChartCurrency] = useState<Currency>(() =>
    tenantAccounts.filter(a => a.currency === 'SSP').length > tenantAccounts.filter(a => a.currency === 'USD').length ? 'SSP' : 'USD'
  );
  const [firstMonthIdx, setFirstMonthIdx] = useState(todayIdx);

  // ---- Overview ---------------------------------------------------------
  const isSpace = (u: PropertyUnit) => unitCategoryOf(u.unitNumber, units) === 'space';
  const occupied = (list: PropertyUnit[]) => list.filter(u => u.currentTenant && u.occupancyStatus !== 'Available').length;
  const shops = units.filter(u => !isSpace(u));
  const spaces = units.filter(isSpace);
  const occupancy = units.length ? Math.round((occupied(units) / units.length) * 100) : 0;

  const thisMonth = (d: Date | null) => Boolean(d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth());
  const rentPayments = tenantAccounts.flatMap(a => a.months.flatMap(m => m.payments));
  const uniquePayments = [...new Map(rentPayments.map(p => [p.id, p])).values()].filter(p => p.paymentMethod !== 'Security Deposit');
  const collectedThisMonth = (c: Currency) =>
    uniquePayments.filter(p => p.currency === c && thisMonth(parsePaymentDate(p.date))).reduce((s, p) => s + p.amount, 0);
  const owedBy = (c: Currency) => tenantAccounts.filter(a => a.currency === c).reduce((s, a) => s + a.balance, 0);
  const owingCount = tenantAccounts.filter(a => a.balance > 0).length;
  const held = deposits.filter(d => d.status === 'Held in Escrow');
  const heldIn = (c: Currency) => held.reduce((s, d) => s + depositIn(d, c), 0);
  const cashNet = (c: Currency) =>
    cashflow
      .filter(t => (t.currency || 'USD') === c && thisMonth(parsePaymentDate(t.date)))
      .reduce((s, t) => s + (t.type === 'Inflow' ? t.amount : -t.amount), 0);
  const waiting = waitingList.filter(w => w.status === 'Waiting');

  const signed = (n: number, c: Currency) => `${n < 0 ? '-' : ''}${formatMoney(Math.abs(n), c)}`;
  const tiles = [
    { label: 'Occupancy', icon: Building2, tone: 'from-orange-500 to-amber-500', main: `${occupancy}%`, sub: `Shops ${occupied(shops)}/${shops.length} • Spaces ${occupied(spaces)}/${spaces.length}` },
    { label: 'Rent this month', icon: TrendingUp, tone: 'from-emerald-500 to-teal-500', main: formatMoney(collectedThisMonth('USD'), 'USD'), sub: formatMoney(collectedThisMonth('SSP'), 'SSP') },
    { label: 'Owed now', icon: AlertTriangle, tone: 'from-rose-500 to-orange-500', main: formatMoney(owedBy('USD'), 'USD'), sub: `${formatMoney(owedBy('SSP'), 'SSP')} • ${owingCount} tenant${owingCount === 1 ? '' : 's'}` },
    { label: 'Deposits held', icon: ShieldCheck, tone: 'from-blue-500 to-indigo-600', main: formatMoney(heldIn('USD'), 'USD'), sub: formatMoney(heldIn('SSP'), 'SSP') },
    { label: 'Cash this month', icon: Wallet, tone: 'from-slate-700 to-slate-900', main: signed(cashNet('USD'), 'USD'), sub: signed(cashNet('SSP'), 'SSP') },
    { label: 'Waiting list', icon: Hourglass, tone: 'from-amber-500 to-yellow-500', main: String(waiting.length), sub: `${waiting.filter(w => w.unitType === 'Shop').length} shops • ${waiting.filter(w => w.unitType === 'Space').length} spaces` },
  ];

  // ---- Collected vs expected, last 6 months ------------------------------
  const chart = useMemo(() => {
    const list = tenantAccounts.filter(a => a.currency === chartCurrency);
    return Array.from({ length: 6 }, (_, i) => {
      const idx = todayIdx - 5 + i;
      let expected = 0, paid = 0;
      for (const a of list) {
        const m = a.months.find(x => x.idx === idx);
        if (m?.contracted) expected += m.due;
        if (m) paid += Math.min(m.paid, m.due);
      }
      return { idx, label: MONTH_NAMES[idx % 12].slice(0, 3), expected, paid };
    });
  }, [tenantAccounts, chartCurrency, todayIdx]);
  const chartMax = Math.max(1, ...chart.map(c => Math.max(c.expected, c.paid)));
  const chartRate = (() => {
    const e = chart.reduce((s, c) => s + c.expected, 0);
    return e ? Math.round((chart.reduce((s, c) => s + Math.min(c.paid, c.expected), 0) / e) * 100) : 0;
  })();

  // ---- Payment behaviour --------------------------------------------------
  const behaviour = useMemo(() => tenantAccounts.map(a => behaviourOf(a, today)), [tenantAccounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = behaviour
    .filter(b => b.onTime + b.late + b.missed > 0)
    .sort((a, b) => b.score - a.score || b.early - a.early || b.onTime - a.onTime)
    .slice(0, 8);
  const worst = behaviour
    .filter(b => b.missed > 0 || b.late > 0 || b.owed > 0)
    .sort((a, b) => b.account.dueNow.length - a.account.dueNow.length || b.owed - a.owed || b.late - a.late)
    .slice(0, 8);

  // Who paid first for a chosen month
  const monthChoices = Array.from({ length: 12 }, (_, i) => todayIdx - i);
  const firstPayers = tenantAccounts
    .map(a => {
      const m = a.months.find(x => x.idx === firstMonthIdx);
      const first = m ? firstPaymentOn(m) : null;
      return m && first ? { a, m, first } : null;
    })
    .filter((x): x is { a: TenantAccount; m: AccountMonth; first: Date } => x !== null)
    .sort((x, y) => x.first.getTime() - y.first.getTime());
  const notPaidYet = tenantAccounts.filter(a => {
    const m = a.months.find(x => x.idx === firstMonthIdx);
    return m?.contracted && m.payments.length === 0;
  }).length;
  const timingLabel = (d: Date, idx: number) => {
    const days = Math.round((d.getTime() - monthStart(idx).getTime()) / DAY);
    if (days < 0) return `${-days} day${days === -1 ? '' : 's'} early`;
    if (days <= GRACE_DAYS) return days === 0 ? 'On the 1st' : `Day ${days + 1} • on time`;
    return `${days - GRACE_DAYS} day${days - GRACE_DAYS === 1 ? '' : 's'} late`;
  };

  // ---- Leases ending soon -------------------------------------------------
  const ending = units
    .filter(u => u.currentTenant)
    .map(u => {
      const end = parsePaymentDate(coverageEndOf(u));
      return { u, end, days: end ? Math.round((end.getTime() - new Date(today.toDateString()).getTime()) / DAY) : null };
    })
    .filter((x): x is { u: PropertyUnit; end: Date; days: number } => x.days !== null && x.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  const card = 'bg-white rounded-3xl border border-slate-200/80 shadow-xs';
  const initials = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const Avatar: React.FC<{ a: TenantAccount; tone?: string }> = ({ a, tone }) => (
    <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 bg-gradient-to-br ${
      tone || (unitCategoryOf(a.unit.unitNumber, units) === 'space' ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-amber-500')
    }`}>
      {initials(a.tenant.name)}
    </span>
  );
  const Empty: React.FC<{ text: string }> = ({ text }) => <p className="py-8 text-center text-xs text-slate-400">{text}</p>;

  return (
    <div id="analytics-view" className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className={`relative overflow-hidden ${card}`}>
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Analysis</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">The whole business at a glance • {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}</p>
          </div>
        </div>
      </div>

      {/* Overview tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.label} className={`relative overflow-hidden ${card} p-4`}>
              <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full bg-gradient-to-br ${t.tone} opacity-10`} />
              <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${t.tone} text-white flex items-center justify-center shadow-sm`}>
                <Icon className="w-4 h-4" />
              </span>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{t.label}</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">{t.main}</p>
              <p className="text-[11px] text-slate-500 truncate">{t.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Chart + units */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={`lg:col-span-2 ${card} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Rent collected vs expected</h2>
              <p className="text-xs text-slate-500">Last 6 months • {chartRate}% collected</p>
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
          <div className="mt-5 h-52 flex items-end gap-2 sm:gap-4">
            {chart.map(c => {
              const rate = c.expected ? Math.round((c.paid / c.expected) * 100) : 0;
              return (
                <div key={c.idx} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 min-w-0" title={`${c.label}: ${formatMoney(c.paid, chartCurrency)} of ${formatMoney(c.expected, chartCurrency)}`}>
                  <span className={`text-[10px] font-black ${rate >= 90 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{c.expected ? `${rate}%` : ''}</span>
                  <div className="relative w-full max-w-12 flex-1 flex items-end">
                    <div className="absolute bottom-0 inset-x-0 rounded-t-xl bg-slate-100" style={{ height: `${(c.expected / chartMax) * 100}%` }} />
                    <div className="relative w-full rounded-t-xl bg-gradient-to-t from-orange-500 to-amber-400 transition-all" style={{ height: `${(c.paid / chartMax) * 100}%` }} />
                  </div>
                  <span className={`text-[11px] font-bold ${c.idx === todayIdx ? 'text-orange-600' : 'text-slate-500'}`}>{c.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gradient-to-t from-orange-500 to-amber-400" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Expected</span>
          </div>
        </div>

        <div className={`${card} p-5 space-y-5`}>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Units</h2>
            {[{ label: 'Shops', icon: Store, list: shops, bar: 'from-orange-500 to-amber-500' }, { label: 'Spaces', icon: LayoutGrid, list: spaces, bar: 'from-blue-500 to-indigo-600' }].map(g => {
              const Icon = g.icon;
              const pct = g.list.length ? Math.round((occupied(g.list) / g.list.length) * 100) : 0;
              return (
                <div key={g.label} className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700"><Icon className="w-3.5 h-3.5 text-slate-400" /> {g.label}</span>
                    <span className="font-bold text-slate-500">{occupied(g.list)} of {g.list.length} rented • {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${g.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-orange-500" /> Ending in 30 days</h2>
            {ending.length === 0 ? (
              <Empty text="No lease ends in the next 30 days." />
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {ending.map(({ u, end, days }) => (
                  <li key={u.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0">
                      <span className="font-bold text-slate-900">{u.unitNumber}</span>
                      <span className="text-slate-500"> • {u.currentTenant?.name}</span>
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-lg font-black ${days < 0 ? 'bg-rose-100 text-rose-700' : days <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`} title={formatLongDate(end)}>
                      {days < 0 ? `Ended ${-days}d ago` : days === 0 ? 'Today' : `${days} days`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Payment behaviour */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* On time */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center gap-3">
            <Trophy className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-extrabold">Pays on time</h2>
              <p className="text-[11px] text-white/85">Paid by the {GRACE_DAYS}th of each month</p>
            </div>
          </div>
          {best.length === 0 ? <Empty text="No rent months due yet." /> : (
            <ul className="divide-y divide-slate-100">
              {best.map((b, i) => (
                <li key={b.account.key} className="px-4 py-3 flex items-center gap-3">
                  <span className="w-5 text-xs font-black text-slate-400 text-center">{i + 1}</span>
                  <Avatar a={b.account} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{b.account.tenant.name}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${b.score >= 80 ? 'bg-emerald-500' : b.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${b.score}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {b.account.unit.unitNumber} • {b.onTime} of {b.onTime + b.late + b.missed} on time{b.early ? ` • ${b.early} early` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-black ${b.score >= 80 ? 'text-emerald-600' : b.score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{b.score}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Who paid first */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5" />
              <div>
                <h2 className="text-sm font-extrabold">Who paid first</h2>
                <p className="text-[11px] text-white/85">Order of payment for the month</p>
              </div>
            </div>
            <select
              value={firstMonthIdx}
              onChange={e => setFirstMonthIdx(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold border border-white/30 focus:outline-none cursor-pointer [&>option]:text-slate-900"
            >
              {monthChoices.map(idx => <option key={idx} value={idx}>{MONTH_NAMES[idx % 12].slice(0, 3)} {Math.floor(idx / 12)}</option>)}
            </select>
          </div>
          {firstPayers.length === 0 ? <Empty text="Nobody has paid for this month yet." /> : (
            <ul className="divide-y divide-slate-100">
              {firstPayers.slice(0, 8).map(({ a, m, first }, i) => (
                <li key={a.key} className="px-4 py-3 flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                    i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {i < 3 ? <Medal className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{a.tenant.name}</p>
                    <p className="text-[10px] text-slate-500">{a.unit.unitNumber} • {formatLongDate(first)} • {timingLabel(first, firstMonthIdx)}</p>
                  </div>
                  {m.status === 'paid'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">Part</span>}
                </li>
              ))}
            </ul>
          )}
          {notPaidYet > 0 && (
            <p className="px-4 py-2.5 border-t border-slate-100 bg-rose-50/60 text-[11px] font-bold text-rose-700">{notPaidYet} tenant{notPaidYet === 1 ? ' has' : 's have'} not paid this month yet</p>
          )}
        </div>

        {/* Most overdue */}
        <div className={`${card} overflow-hidden md:col-span-2 xl:col-span-1`}>
          <div className="px-5 py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white flex items-center gap-3">
            <Flame className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-extrabold">Most overdue</h2>
              <p className="text-[11px] text-white/85">Months owed now and late payments</p>
            </div>
          </div>
          {worst.length === 0 ? <Empty text="Nobody is overdue. 🎉" /> : (
            <ul className="divide-y divide-slate-100">
              {worst.map(b => (
                <li key={b.account.key} className="px-4 py-3 flex items-center gap-3">
                  <Avatar a={b.account} tone={b.account.dueNow.length ? 'from-rose-500 to-orange-500' : undefined} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{b.account.tenant.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {b.account.dueNow.slice(0, 4).map(m => (
                        <span key={m.key} className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold">{m.short.split(' ')[0]}</span>
                      ))}
                      {b.account.dueNow.length > 4 && <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">+{b.account.dueNow.length - 4}</span>}
                      {b.late > 0 && <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">Late {b.late}×{b.avgDaysLate ? ` • ~${b.avgDaysLate}d` : ''}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-black text-rose-600">{b.owed > 0 ? formatMoney(b.owed, b.account.currency) : '—'}</span>
                    <span className="block text-[10px] text-slate-500">{b.account.dueNow.length} month{b.account.dueNow.length === 1 ? '' : 's'} owed</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
