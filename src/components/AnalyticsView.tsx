import React, { useEffect, useMemo, useState } from 'react';
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
  Printer,
  CalendarRange,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  CreditCard,
  Layers,
  Crown,
} from 'lucide-react';
import { CashflowTransaction, DepositRecord, PaymentRecord, PropertyUnit, WaitingEntry } from '../types';
import { TenantAccount, AccountMonth, coverageEndOf } from '../utils/tenantAccount';
import { unitCategoryOf } from './CategorySwitch';
import { formatMoney, parsePaymentDate, formatLongDate } from '../utils/printUtils';
import { MONTH_NAMES } from '../utils/rentLedger';
import { depositIn } from '../utils/currency';
import { PrintPortal } from './PrintPortal';
import { CashflowHeader } from './CashflowVoucher';
import { BUSINESS_PROFILE } from '../data/businessProfile';

type Currency = 'USD' | 'SSP';
type PeriodMode = 'all' | 'day' | 'month' | 'year' | 'range';
type Money = Record<Currency, number>;
const CURRENCIES: Currency[] = ['USD', 'SSP'];
const zero = (): Money => ({ USD: 0, SSP: 0 });
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const METHOD_LABEL: Record<string, string> = {
  'Cash (Office Management Desk)': 'Cash',
  'EVC Plus / Mobile Money': 'Mobile money',
  'Bank Wire Transfer': 'Bank transfer',
  'Cheque / Slip': 'Cheque / slip',
};

// Rent is due on the 1st; paid by the 5th still counts as on time
const GRACE_DAYS = 5;
const DAY = 86_400_000;

interface AnalyticsViewProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
  tenantAccounts: TenantAccount[];
  deposits: DepositRecord[];
  cashflow: CashflowTransaction[];
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

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ units, payments, tenantAccounts, deposits, cashflow, waitingList }) => {
  const today = new Date();
  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const [chartCurrency, setChartCurrency] = useState<Currency>(() =>
    tenantAccounts.filter(a => a.currency === 'SSP').length > tenantAccounts.filter(a => a.currency === 'USD').length ? 'SSP' : 'USD'
  );
  const [firstMonthIdx, setFirstMonthIdx] = useState(todayIdx);
  const [moneyCurrency, setMoneyCurrency] = useState<Currency>(chartCurrency);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const timer = setTimeout(() => { window.print(); setPrinting(false); }, 150);
    return () => clearTimeout(timer);
  }, [printing]);

  // ---- Period -----------------------------------------------------------
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [day, setDay] = useState(toISO(today));
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [fromDate, setFromDate] = useState(toISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toISO(today));
  const inPeriodDate = (d: Date | null) => {
    if (periodMode === 'all') return true;
    if (!d) return false;
    if (periodMode === 'year') return d.getFullYear() === year;
    if (periodMode === 'month') return d.getFullYear() === year && d.getMonth() === month;
    if (periodMode === 'day') return d.toDateString() === (parsePaymentDate(day) || today).toDateString();
    const from = parsePaymentDate(fromDate);
    const to = parsePaymentDate(toDate);
    return !(from && d < from) && !(to && d > to);
  };
  const inPeriod = (date: string) => inPeriodDate(parsePaymentDate(date));
  // A rent month is in the period when its 1st day is (or its month is, for a single day)
  const monthInPeriod = (idx: number) => {
    if (periodMode === 'all') return idx <= todayIdx;
    if (periodMode === 'day') {
      const d = parsePaymentDate(day) || today;
      return idx === d.getFullYear() * 12 + d.getMonth();
    }
    return inPeriodDate(monthStart(idx)) && idx <= todayIdx;
  };
  const periodLabel = periodMode === 'all' ? 'All time'
    : periodMode === 'year' ? `Year ${year}`
    : periodMode === 'month' ? `${MONTH_NAMES[month]} ${year}`
    : periodMode === 'day' ? formatLongDate(day)
    : `${formatLongDate(fromDate)} – ${formatLongDate(toDate)}`;
  const availableYears = [...new Set([today.getFullYear(), ...payments.map(p => parsePaymentDate(p.date)?.getFullYear()), ...cashflow.map(t => parsePaymentDate(t.date)?.getFullYear())]
    .filter((y): y is number => Boolean(y)))].sort((a, b) => b - a);

  // ---- Overview ---------------------------------------------------------
  const isSpace = (u: PropertyUnit) => unitCategoryOf(u.unitNumber, units) === 'space';
  const occupied = (list: PropertyUnit[]) => list.filter(u => u.currentTenant && u.occupancyStatus !== 'Available').length;
  const shops = units.filter(u => !isSpace(u));
  const spaces = units.filter(isSpace);
  const occupancy = units.length ? Math.round((occupied(units) / units.length) * 100) : 0;

  // Rent received in the period (money paid from a deposit is not new money)
  const periodPayments = payments.filter(p => p.paymentMethod !== 'Security Deposit' && inPeriod(p.date));
  const collectedThisMonth = (c: Currency) => periodPayments.filter(p => p.currency === c).reduce((s, p) => s + p.amount, 0);
  const owedBy = (c: Currency) => tenantAccounts.filter(a => a.currency === c).reduce((s, a) => s + a.balance, 0);
  const owingCount = tenantAccounts.filter(a => a.balance > 0).length;
  const held = deposits.filter(d => d.status === 'Held in Escrow');
  const heldIn = (c: Currency) => held.reduce((s, d) => s + depositIn(d, c), 0);
  const periodCash = cashflow.filter(t => inPeriod(t.date));
  const cashNet = (c: Currency) =>
    periodCash.filter(t => (t.currency || 'USD') === c).reduce((s, t) => s + (t.type === 'Inflow' ? t.amount : -t.amount), 0);

  // ---- Money in and out by category (period) -----------------------------
  const byCategory = (type: 'Inflow' | 'Outflow') => {
    const map = new Map<string, Money>();
    for (const t of periodCash.filter(x => x.type === type)) {
      const key = t.category === 'Electricity' ? 'Electricity' : t.category;
      const m = map.get(key) || zero();
      m[(t.currency || 'USD') as Currency] += t.amount;
      map.set(key, m);
    }
    return [...map.entries()].map(([label, money]) => ({ label, money }));
  };
  const income = byCategory('Inflow');
  const expenses = byCategory('Outflow');
  const total = (rows: { money: Money }[]) => rows.reduce((t, r) => ({ USD: t.USD + r.money.USD, SSP: t.SSP + r.money.SSP }), zero());
  const incomeTotal = total(income);
  const expenseTotal = total(expenses);

  // ---- Collection rate for rent months in the period ---------------------
  const collection = CURRENCIES.map(c => {
    let due = 0, paid = 0, full = 0, part = 0, none = 0;
    for (const a of tenantAccounts.filter(x => x.currency === c)) {
      for (const m of a.months) {
        if (!m.contracted || !monthInPeriod(m.idx)) continue;
        due += m.due;
        paid += Math.min(m.paid, m.due);
        if (m.status === 'paid') full++; else if (m.paid > 0) part++; else none++;
      }
    }
    return { c, due, paid, rate: due ? Math.round((paid / due) * 100) : 0, full, part, none };
  });

  // ---- Arrears age: how many months each tenant owes now -----------------
  const ageing = [
    { label: '1 month', test: (n: number) => n === 1, tone: 'bg-amber-400' },
    { label: '2 months', test: (n: number) => n === 2, tone: 'bg-orange-500' },
    { label: '3+ months', test: (n: number) => n >= 3, tone: 'bg-rose-600' },
  ].map(g => {
    const list = tenantAccounts.filter(a => g.test(a.dueNow.length));
    const money = zero();
    list.forEach(a => { money[a.currency] += a.balance; });
    return { ...g, count: list.length, money };
  });

  // ---- Rent by shops / spaces, payment methods, top payers (period) ------
  const paymentIsSpace = (p: PaymentRecord) => unitCategoryOf(p.unitNumber, units) === 'space';
  const rentBy = [
    { label: 'Shops', icon: Store, bar: 'from-orange-500 to-amber-500', list: periodPayments.filter(p => !paymentIsSpace(p)) },
    { label: 'Spaces', icon: LayoutGrid, bar: 'from-blue-500 to-indigo-600', list: periodPayments.filter(paymentIsSpace) },
  ].map(g => {
    const money = zero();
    g.list.forEach(p => { money[p.currency] += p.amount; });
    return { ...g, money, count: g.list.length };
  });
  const methods = [...periodPayments.reduce((map, p) => {
    const key = METHOD_LABEL[p.paymentMethod] || p.paymentMethod;
    const m = map.get(key) || { count: 0, money: zero() };
    m.count++;
    m.money[p.currency] += p.amount;
    return map.set(key, m);
  }, new Map<string, { count: number; money: Money }>()).entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.count - a.count);
  const topPayers = (c: Currency) => [...periodPayments.filter(p => p.currency === c).reduce((map, p) => {
    const key = `${p.tenantName}|${p.unitNumber}`;
    const m = map.get(key) || { name: p.tenantName, unit: p.unitNumber, amount: 0, count: 0 };
    m.amount += p.amount;
    m.count++;
    return map.set(key, m);
  }, new Map<string, { name: string; unit: string; amount: number; count: number }>()).values()].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const waiting = waitingList.filter(w => w.status === 'Waiting');

  const signed = (n: number, c: Currency) => `${n < 0 ? '-' : ''}${formatMoney(Math.abs(n), c)}`;
  const tiles = [
    { label: 'Occupancy', icon: Building2, tone: 'from-orange-500 to-amber-500', main: `${occupancy}%`, sub: `Shops ${occupied(shops)}/${shops.length} • Spaces ${occupied(spaces)}/${spaces.length}` },
    { label: 'Rent collected', icon: TrendingUp, tone: 'from-emerald-500 to-teal-500', main: formatMoney(collectedThisMonth('USD'), 'USD'), sub: formatMoney(collectedThisMonth('SSP'), 'SSP') },
    { label: 'Owed now', icon: AlertTriangle, tone: 'from-rose-500 to-orange-500', main: formatMoney(owedBy('USD'), 'USD'), sub: `${formatMoney(owedBy('SSP'), 'SSP')} • ${owingCount} tenant${owingCount === 1 ? '' : 's'}` },
    { label: 'Deposits held', icon: ShieldCheck, tone: 'from-blue-500 to-indigo-600', main: formatMoney(heldIn('USD'), 'USD'), sub: formatMoney(heldIn('SSP'), 'SSP') },
    { label: 'Cash balance', icon: Wallet, tone: 'from-slate-700 to-slate-900', main: signed(cashNet('USD'), 'USD'), sub: signed(cashNet('SSP'), 'SSP') },
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
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
      active ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
    }`;
  const selectCls = 'px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500';
  const mc = moneyCurrency;
  const share = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
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
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">The whole business at a glance • {periodLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setPrinting(true)}
            className="ml-auto shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-orange-500/25 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print analysis</span><span className="sm:hidden">Print</span>
          </button>
        </div>
      </div>

      {/* Period */}
      <div className={`${card} p-2.5 flex flex-wrap items-center gap-2`}>
        <span className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700"><CalendarRange className="w-4 h-4 text-orange-500" /> Period</span>
        <div className="inline-flex bg-slate-100 p-0.5 rounded-xl overflow-x-auto max-w-full">
          {([['all', 'All'], ['day', 'Day'], ['month', 'Month'], ['year', 'Year'], ['range', 'Custom']] as [PeriodMode, string][]).map(([m, label]) => (
            <button key={m} type="button" onClick={() => setPeriodMode(m)} className={pill(periodMode === m)}>{label}</button>
          ))}
        </div>
        {periodMode === 'day' && <input type="date" value={day} onChange={e => setDay(e.target.value)} className={selectCls} />}
        {(periodMode === 'month' || periodMode === 'year') && (
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {periodMode === 'month' && (
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls}>
            {MONTH_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
        )}
        {periodMode === 'range' && (
          <span className="flex flex-wrap items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={selectCls} />
            <span className="text-xs font-bold text-slate-400">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={selectCls} />
          </span>
        )}
        <span className="ml-auto px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold">{periodLabel}</span>
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

      {/* Money in / out for the period */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><PieChart className="w-4 h-4 text-orange-500" /> Money in &amp; out</h2>
            <p className="text-xs text-slate-500">{periodLabel} • cash flow money (electricity is kept separate)</p>
          </div>
          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
            {CURRENCIES.map(c => (
              <button key={c} type="button" onClick={() => setMoneyCurrency(c)} className={pill(mc === c)}>{c === 'USD' ? '$ Dollar' : 'SSP'}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Net */}
          <div className={`rounded-2xl p-4 text-white ${mc === 'USD' ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-orange-500 to-amber-500'}`}>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Balance (in − out)</p>
            <p className="mt-1 text-2xl sm:text-3xl font-black">{signed(incomeTotal[mc] - expenseTotal[mc], mc)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/10 p-2.5">
                <span className="flex items-center gap-1 opacity-80"><ArrowDownLeft className="w-3.5 h-3.5" /> In</span>
                <strong className="block text-sm">{formatMoney(incomeTotal[mc], mc)}</strong>
              </div>
              <div className="rounded-xl bg-white/10 p-2.5">
                <span className="flex items-center gap-1 opacity-80"><ArrowUpRight className="w-3.5 h-3.5" /> Out</span>
                <strong className="block text-sm">{formatMoney(expenseTotal[mc], mc)}</strong>
              </div>
            </div>
            <p className="mt-3 text-[11px] opacity-80">
              {incomeTotal[mc] ? `${share(Math.max(0, incomeTotal[mc] - expenseTotal[mc]), incomeTotal[mc])}% of money in is kept` : 'No money in for this period'}
            </p>
          </div>

          {/* Income and expenses by category */}
          {[{ title: 'Money in by source', rows: income, sum: incomeTotal, bar: 'bg-emerald-500', icon: ArrowDownLeft, ink: 'text-emerald-600' },
            { title: 'Money out by category', rows: expenses, sum: expenseTotal, bar: 'bg-rose-500', icon: ArrowUpRight, ink: 'text-rose-600' }].map(box => {
            const rows = box.rows.filter(r => r.money[mc] > 0).sort((a, b) => b.money[mc] - a.money[mc]);
            const Icon = box.icon;
            return (
              <div key={box.title} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5"><Icon className={`w-4 h-4 ${box.ink}`} /> {box.title}</p>
                {rows.length === 0 ? <Empty text="Nothing in this period." /> : (
                  <ul className="mt-3 space-y-2.5">
                    {rows.map(r => (
                      <li key={r.label}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-700 truncate">{r.label}</span>
                          <span className="shrink-0 font-black text-slate-900">{formatMoney(r.money[mc], mc)} <span className="text-slate-400 font-bold">{share(r.money[mc], box.sum[mc])}%</span></span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${box.bar}`} style={{ width: `${share(r.money[mc], box.sum[mc])}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Collection, arrears age, shops vs spaces, methods */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`${card} p-4`}>
          <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Rent collection rate</p>
          <p className="text-[11px] text-slate-500">Rent months due in {periodLabel}</p>
          <div className="mt-3 space-y-3">
            {collection.map(c => (
              <div key={c.c}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-slate-600">{c.c === 'USD' ? 'Dollar' : 'SSP'}</span>
                  <span className={`text-xl font-black ${c.rate >= 90 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-600' : c.due ? 'text-rose-600' : 'text-slate-300'}`}>{c.due ? `${c.rate}%` : '—'}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${c.rate}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{formatMoney(c.paid, c.c)} of {formatMoney(c.due, c.c)} • {c.full} paid • {c.part} part • {c.none} unpaid</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-4`}>
          <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5"><Layers className="w-4 h-4 text-rose-500" /> How long they owe</p>
          <p className="text-[11px] text-slate-500">Tenants owing right now</p>
          <ul className="mt-3 space-y-2.5">
            {ageing.map(g => (
              <li key={g.label} className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-xl ${g.tone} text-white flex items-center justify-center text-sm font-black shrink-0`}>{g.count}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">{g.label} owed</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {g.count === 0 ? 'Nobody' : [g.money.USD ? formatMoney(g.money.USD, 'USD') : '', g.money.SSP ? formatMoney(g.money.SSP, 'SSP') : ''].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${card} p-4`}>
          <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5"><Store className="w-4 h-4 text-orange-500" /> Rent: shops vs spaces</p>
          <p className="text-[11px] text-slate-500">Rent received in {periodLabel}</p>
          <div className="mt-3 space-y-3">
            {rentBy.map(g => {
              const Icon = g.icon;
              return (
                <div key={g.label} className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${g.bar} text-white flex items-center justify-center shrink-0`}><Icon className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">{g.label} <span className="text-slate-400 font-semibold">• {g.count} payment{g.count === 1 ? '' : 's'}</span></p>
                    <p className="text-[11px] font-black text-slate-900">{formatMoney(g.money.USD, 'USD')} <span className="text-orange-600">• {formatMoney(g.money.SSP, 'SSP')}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${card} p-4`}>
          <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-blue-500" /> How tenants pay</p>
          <p className="text-[11px] text-slate-500">{periodPayments.length} payment{periodPayments.length === 1 ? '' : 's'} in {periodLabel}</p>
          {methods.length === 0 ? <Empty text="No payments in this period." /> : (
            <ul className="mt-3 space-y-2">
              {methods.map(m => (
                <li key={m.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{m.label}</span>
                    <span className="font-black text-slate-900">{m.count} <span className="text-slate-400 font-bold">{share(m.count, periodPayments.length)}%</span></span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${share(m.count, periodPayments.length)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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

      {/* Top paying tenants */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-sm font-extrabold">Top paying tenants</h2>
              <p className="text-[11px] text-white/75">Most rent paid in {periodLabel}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {CURRENCIES.map(c => {
            const list = topPayers(c);
            return (
              <div key={c} className="p-4">
                <p className={`text-[10px] font-black uppercase tracking-wider ${c === 'USD' ? 'text-slate-500' : 'text-orange-600'}`}>{c === 'USD' ? 'Dollar' : 'SSP'}</p>
                {list.length === 0 ? <Empty text="No payments in this currency." /> : (
                  <ul className="mt-2 space-y-2">
                    {list.map((t, i) => (
                      <li key={t.name + t.unit} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900 truncate">{t.name}</span>
                          <span className="block text-[10px] text-slate-500">{t.unit} • {t.count} payment{t.count === 1 ? '' : 's'}</span>
                        </span>
                        <span className={`shrink-0 text-sm font-black ${c === 'USD' ? 'text-slate-900' : 'text-orange-600'}`}>{formatMoney(t.amount, c)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {printing && (
        <PrintPortal>
          <AnalysisPrint
            periodLabel={periodLabel}
            tiles={tiles}
            income={income}
            expenses={expenses}
            incomeTotal={incomeTotal}
            expenseTotal={expenseTotal}
            collection={collection}
            ageing={ageing}
            rentBy={rentBy}
            methods={methods}
            topPayers={CURRENCIES.map(c => ({ c, list: topPayers(c) }))}
            best={best}
            worst={worst}
          />
        </PrintPortal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Printed analysis: clean black and white tables, dollar and SSP side by side
// ---------------------------------------------------------------------------

const AnalysisPrint: React.FC<{
  periodLabel: string;
  tiles: { label: string; main: string; sub: string }[];
  income: { label: string; money: Money }[];
  expenses: { label: string; money: Money }[];
  incomeTotal: Money;
  expenseTotal: Money;
  collection: { c: Currency; due: number; paid: number; rate: number; full: number; part: number; none: number }[];
  ageing: { label: string; count: number; money: Money }[];
  rentBy: { label: string; count: number; money: Money }[];
  methods: { label: string; count: number; money: Money }[];
  topPayers: { c: Currency; list: { name: string; unit: string; amount: number; count: number }[] }[];
  best: Behaviour[];
  worst: Behaviour[];
}> = p => {
  const m = (n: number, c: Currency) => (n ? formatMoney(n, c) : '—');
  const net = (c: Currency) => p.incomeTotal[c] - p.expenseTotal[c];
  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="print-avoid-break">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-700 border-b-2 border-slate-900 pb-1 mb-1.5">{title}</p>
      {children}
    </div>
  );
  const th = 'py-1 text-left font-bold uppercase tracking-wider text-[9px] text-slate-500';
  const td = 'py-1 border-b border-slate-200';
  const MoneyTable: React.FC<{ rows: { label: string; money: Money }[]; sum: Money; sumLabel: string }> = ({ rows, sum, sumLabel }) => (
    <table className="w-full text-[10px]">
      <thead><tr><th className={th}>Item</th><th className={`${th} text-right`}>Dollar</th><th className={`${th} text-right`}>SSP</th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td className={td} colSpan={3}>Nothing in this period</td></tr>}
        {rows.map(r => (
          <tr key={r.label}><td className={td}>{r.label}</td><td className={`${td} text-right font-mono`}>{m(r.money.USD, 'USD')}</td><td className={`${td} text-right font-mono`}>{m(r.money.SSP, 'SSP')}</td></tr>
        ))}
        <tr className="font-black"><td className="py-1">{sumLabel}</td><td className="py-1 text-right font-mono">{formatMoney(sum.USD, 'USD')}</td><td className="py-1 text-right font-mono">{formatMoney(sum.SSP, 'SSP')}</td></tr>
      </tbody>
    </table>
  );

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
        <CashflowHeader title="Business Analysis" subtitle={p.periodLabel} tone="bg-gradient-to-b from-orange-500 to-amber-400" />
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Period: <strong className="text-slate-900">{p.periodLabel}</strong></span>
            <span>Printed {formatLongDate(new Date())} • {BUSINESS_PROFILE.managerName} (Admin)</span>
          </div>

          <Section title="Overview">
            <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 text-[10px]">
              {p.tiles.map(t => (
                <div key={t.label} className="flex items-baseline justify-between gap-2 border-b border-dotted border-slate-400 pb-0.5">
                  <span className="text-slate-500 font-bold uppercase text-[9px]">{t.label}</span>
                  <span className="text-right"><strong>{t.main}</strong> <span className="text-slate-500">{t.sub}</span></span>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-6">
            <Section title="Money in by source"><MoneyTable rows={p.income} sum={p.incomeTotal} sumLabel="Total in" /></Section>
            <Section title="Money out by category"><MoneyTable rows={p.expenses} sum={p.expenseTotal} sumLabel="Total out" /></Section>
          </div>

          <Section title="Balance">
            <table className="w-full text-[11px]">
              <tbody>
                <tr className="bg-slate-900 text-white font-black">
                  <td className="py-1.5 px-2">Money in − money out</td>
                  {CURRENCIES.map(c => <td key={c} className="py-1.5 px-2 text-right font-mono">{net(c) < 0 ? '-' : ''}{formatMoney(Math.abs(net(c)), c)}</td>)}
                </tr>
              </tbody>
            </table>
          </Section>

          <div className="grid grid-cols-2 gap-6">
            <Section title="Rent collection rate">
              <table className="w-full text-[10px]">
                <thead><tr><th className={th}>Currency</th><th className={`${th} text-right`}>Due</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Paid / Part / Unpaid</th></tr></thead>
                <tbody>
                  {p.collection.map(c => (
                    <tr key={c.c}><td className={td}>{c.c === 'USD' ? 'Dollar' : 'SSP'}</td><td className={`${td} text-right font-mono`}>{m(c.due, c.c)}</td><td className={`${td} text-right font-mono`}>{m(c.paid, c.c)}</td><td className={`${td} text-right font-black`}>{c.due ? `${c.rate}%` : '—'}</td><td className={`${td} text-right`}>{c.full} / {c.part} / {c.none}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section title="How long tenants owe (now)">
              <table className="w-full text-[10px]">
                <thead><tr><th className={th}>Owed</th><th className={`${th} text-right`}>Tenants</th><th className={`${th} text-right`}>Dollar</th><th className={`${th} text-right`}>SSP</th></tr></thead>
                <tbody>
                  {p.ageing.map(g => (
                    <tr key={g.label}><td className={td}>{g.label}</td><td className={`${td} text-right`}>{g.count}</td><td className={`${td} text-right font-mono`}>{m(g.money.USD, 'USD')}</td><td className={`${td} text-right font-mono`}>{m(g.money.SSP, 'SSP')}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Section title="Rent: shops vs spaces">
              <table className="w-full text-[10px]">
                <thead><tr><th className={th}>Type</th><th className={`${th} text-right`}>Payments</th><th className={`${th} text-right`}>Dollar</th><th className={`${th} text-right`}>SSP</th></tr></thead>
                <tbody>
                  {p.rentBy.map(g => (
                    <tr key={g.label}><td className={td}>{g.label}</td><td className={`${td} text-right`}>{g.count}</td><td className={`${td} text-right font-mono`}>{m(g.money.USD, 'USD')}</td><td className={`${td} text-right font-mono`}>{m(g.money.SSP, 'SSP')}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section title="How tenants pay">
              <table className="w-full text-[10px]">
                <thead><tr><th className={th}>Method</th><th className={`${th} text-right`}>Payments</th><th className={`${th} text-right`}>Dollar</th><th className={`${th} text-right`}>SSP</th></tr></thead>
                <tbody>
                  {p.methods.length === 0 && <tr><td className={td} colSpan={4}>No payments in this period</td></tr>}
                  {p.methods.map(g => (
                    <tr key={g.label}><td className={td}>{g.label}</td><td className={`${td} text-right`}>{g.count}</td><td className={`${td} text-right font-mono`}>{m(g.money.USD, 'USD')}</td><td className={`${td} text-right font-mono`}>{m(g.money.SSP, 'SSP')}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Section title="Pays on time">
              <table className="w-full text-[10px]">
                <thead><tr><th className={th}>#</th><th className={th}>Tenant</th><th className={th}>Unit</th><th className={`${th} text-right`}>On time</th><th className={`${th} text-right`}>Score</th></tr></thead>
                <tbody>
                  {p.best.map((b, i) => (
                    <tr key={b.account.key}><td className={td}>{i + 1}</td><td className={td}>{b.account.tenant.name}</td><td className={td}>{b.account.unit.unitNumber}</td><td className={`${td} text-right`}>{b.onTime}/{b.onTime + b.late + b.missed}</td><td className={`${td} text-right font-black`}>{b.score}%</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section title="Most overdue">
              <table className="w-full text-[10px]">
                <thead><tr><th className={th}>Tenant</th><th className={th}>Unit</th><th className={`${th} text-right`}>Months</th><th className={`${th} text-right`}>Late</th><th className={`${th} text-right`}>Owed</th></tr></thead>
                <tbody>
                  {p.worst.length === 0 && <tr><td className={td} colSpan={5}>Nobody is overdue</td></tr>}
                  {p.worst.map(b => (
                    <tr key={b.account.key}><td className={td}>{b.account.tenant.name}</td><td className={td}>{b.account.unit.unitNumber}</td><td className={`${td} text-right`}>{b.account.dueNow.length}</td><td className={`${td} text-right`}>{b.late}×</td><td className={`${td} text-right font-mono font-bold`}>{m(b.owed, b.account.currency)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>

          <Section title="Top paying tenants">
            <div className="grid grid-cols-2 gap-6">
              {p.topPayers.map(({ c, list }) => (
                <table key={c} className="w-full text-[10px]">
                  <thead><tr><th className={th}>#</th><th className={th}>Tenant ({c === 'USD' ? 'Dollar' : 'SSP'})</th><th className={th}>Unit</th><th className={`${th} text-right`}>Paid</th></tr></thead>
                  <tbody>
                    {list.length === 0 && <tr><td className={td} colSpan={4}>None</td></tr>}
                    {list.map((t, i) => (
                      <tr key={t.name + t.unit}><td className={td}>{i + 1}</td><td className={td}>{t.name}</td><td className={td}>{t.unit}</td><td className={`${td} text-right font-mono`}>{formatMoney(t.amount, c)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-10 pt-6 print-avoid-break">
            {['Prepared by', 'Approved by'].map(r => (
              <div key={r} className={r === 'Approved by' ? 'text-right' : ''}>
                <div className="h-10 border-b border-slate-500" />
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">{r}</p>
                <p className="text-[10px] font-bold">{BUSINESS_PROFILE.managerName} (Admin)</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
