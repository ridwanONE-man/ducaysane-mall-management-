import React, { useMemo, useState } from 'react';
import { Users, Search, Phone, Copy, Check, CalendarCheck, AlertTriangle, CheckCircle2, Store, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { PaymentRecord } from '../types';
import { TenantAccount } from '../utils/tenantAccount';
import { formatLongDate, formatMoney } from '../utils/printUtils';
import { RentCurrency, formatBoth } from '../utils/currency';

interface TenantAccountsPanelProps {
  accounts: TenantAccount[];
  payments?: PaymentRecord[];
  onOpenAccount: (account: TenantAccount) => void;
}

type Filter = 'all' | 'owing' | 'paid' | 'unpaid' | 'partial' | 'overdue';

const todayIdx = () => new Date().getFullYear() * 12 + new Date().getMonth();
// Owes at least one month with nothing paid
const isUnpaid = (a: TenantAccount) => a.owing.some(m => m.status === 'due');
// Owes at least one month that was only partly paid
const isPartial = (a: TenantAccount) => a.owing.some(m => m.status === 'partial');
// Still owes rent for a month that has already passed
const isOverdue = (a: TenantAccount) => a.owing.some(m => m.idx < todayIdx());

const FILTER_MATCH: Record<Filter, (a: TenantAccount) => boolean> = {
  all: () => true,
  owing: a => a.balance > 0,
  paid: a => a.balance <= 0,
  unpaid: isUnpaid,
  partial: isPartial,
  overdue: isOverdue,
};

// Active colour of each filter tab
const FILTER_TONE: Record<Filter, string> = {
  all: 'bg-slate-900 text-white',
  owing: 'bg-rose-600 text-white',
  paid: 'bg-emerald-600 text-white',
  unpaid: 'bg-rose-600 text-white',
  partial: 'bg-amber-500 text-white',
  overdue: 'bg-gradient-to-r from-rose-600 to-orange-500 text-white',
};

const usd = (n: number, currency: RentCurrency = 'USD') => formatMoney(n, currency);

export const TenantAccountsPanel: React.FC<TenantAccountsPanelProps> = ({ accounts, payments = [], onOpenAccount }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Rent due up to this month vs. what was paid of it, month by month (works across $ and SSP)
  const stats = useMemo(() => {
    const now = todayIdx();
    const dueMonths = accounts.flatMap(a => a.months.filter(m => m.contracted && m.idx <= now && m.due > 0));
    const rate = dueMonths.length
      ? Math.round((dueMonths.reduce((s, m) => s + Math.min(1, m.paid / m.due), 0) / dueMonths.length) * 1000) / 10
      : 100;
    const overdueOf = (cur: 'USD' | 'SSP') => accounts
      .filter(a => a.currency === cur)
      .reduce((s, a) => s + a.owing.filter(m => m.idx < now).reduce((t, m) => t + m.remaining, 0), 0);
    return {
      rate,
      collectedUSD: payments.filter(p => p.currency === 'USD').reduce((s, p) => s + p.amount, 0),
      collectedSSP: payments.filter(p => p.currency === 'SSP').reduce((s, p) => s + p.amount, 0),
      overdueUSD: overdueOf('USD'),
      overdueSSP: overdueOf('SSP'),
      overdueTenants: accounts.filter(isOverdue).length,
    };
  }, [accounts, payments]);

  const totals = useMemo(() => ({
    owedUSD: accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0),
    owedSSP: accounts.filter(a => a.currency === 'SSP').reduce((s, a) => s + a.balance, 0),
    owing: accounts.filter(a => a.balance > 0).length,
    paid: accounts.filter(a => a.balance <= 0).length,
    depositsUSD: accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.depositHeld, 0),
    depositsSSP: accounts.filter(a => a.currency === 'SSP').reduce((s, a) => s + a.depositHeld, 0),
  }), [accounts]);

  const q = search.trim().toLowerCase();
  const shown = accounts.filter(a => {
    if (!FILTER_MATCH[filter](a)) return false;
    return !q || [a.tenant.name, a.unit.unitNumber, a.tenant.phone, a.tenant.trade, a.tenant.code]
      .some(v => (v || '').toLowerCase().includes(q));
  });

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Collection rate */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
          <div className="absolute -right-8 -bottom-10 w-32 h-32 rounded-full bg-orange-500/20" />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Collection rate</span>
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <p className="relative text-3xl font-black mt-1">{stats.rate}%</p>
          <div className="relative mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${Math.min(100, stats.rate)}%` }} />
          </div>
          <p className="relative text-[10px] text-slate-400 mt-1.5">Rent paid of rent due up to this month</p>
        </div>

        {[
          { label: 'Collected', value: formatBoth(stats.collectedUSD, stats.collectedSSP), sub: `${payments.length} payment${payments.length === 1 ? '' : 's'} received`, icon: Wallet, tone: 'from-emerald-500 to-teal-500 shadow-emerald-500/30', text: 'text-emerald-700' },
          { label: 'Deposits held', value: formatBoth(totals.depositsUSD, totals.depositsSSP), sub: `${accounts.filter(a => a.depositHeld > 0).length} tenant(s) with a deposit`, icon: ShieldCheck, tone: 'from-sky-500 to-blue-500 shadow-sky-500/30', text: 'text-sky-700' },
          { label: 'Overdue arrears', value: formatBoth(stats.overdueUSD, stats.overdueSSP), sub: `${stats.overdueTenants} tenant(s) late • total balance ${formatBoth(totals.owedUSD, totals.owedSSP)}`, icon: AlertTriangle, tone: 'from-rose-500 to-orange-500 shadow-rose-500/30', text: 'text-rose-600' },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.label}</span>
              <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${t.tone} text-white flex items-center justify-center shadow-md`}><t.icon className="w-4 h-4" /></span>
            </div>
            <p className={`text-2xl font-black mt-1 truncate ${t.text}`}>{t.value}</p>
            <p className="text-[10px] text-slate-500 mt-1.5 truncate">{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {([
            ['all', 'All'],
            ['owing', 'Balance'],
            ['paid', 'Paid'],
            ['unpaid', 'Unpaid'],
            ['partial', 'Partially Paid'],
            ['overdue', 'Overdue Arrears'],
          ] as [Filter, string][]).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === f ? `${FILTER_TONE[f]} shadow-xs font-bold` : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              {label} <span className="opacity-75">({accounts.filter(FILTER_MATCH[f]).length})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tenant, unit, phone..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Cards */}
      {shown.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
          {accounts.length === 0 ? 'No leased units yet. Lease a unit to a tenant to start collecting rent.' : 'No tenants match this filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map(a => (
            <div
              key={a.key}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h3 className="font-extrabold text-slate-900 text-sm truncate">{a.tenant.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                      <Store className="w-3 h-3" /> {a.unit.unitNumber}
                    </span>
                    <span className="truncate">{a.tenant.trade}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Balance</span>
                  {a.balance > 0 ? (
                    <span className="inline-block mt-0.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-sm font-black">{usd(a.balance, a.currency)}</span>
                  ) : (
                    <span className="inline-block mt-0.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-sm font-black">✓ Paid</span>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Monthly rent</span>
                  <span className="font-bold text-emerald-700">{usd(a.monthlyRent, a.currency)}</span>
                </div>
                {a.depositHeld > 0 && (
                  <div className="flex justify-between text-indigo-700">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Security deposit</span>
                    <span className="font-bold">{usd(a.depositHeld, a.currency)}</span>
                  </div>
                )}
                {a.tenant.phone && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-600" /> {a.tenant.phone}</span>
                    <button
                      type="button"
                      onClick={() => copy(a.tenant.phone, a.key)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      {copied === a.key ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copied === a.key ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              {/* Month status */}
              <div className="mt-3 flex flex-wrap gap-1">
                {a.owing.slice(0, 4).map(m => (
                  <span key={m.key} className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">
                    {m.short} {usd(m.remaining, a.currency)}
                  </span>
                ))}
                {a.owing.length > 4 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">+{a.owing.length - 4} more</span>
                )}
                {a.owing.length === 0 && a.lastPayment && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    Last paid {formatLongDate(a.lastPayment.date)}
                  </span>
                )}
                {a.months.filter(m => m.status === 'paid').slice(-3).map(m => (
                  <span key={m.key} className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">✓ {m.short}</span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onOpenAccount(a)}
                className={`mt-4 w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  a.balance > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/25'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <CalendarCheck className="w-4 h-4" />
                {a.balance > 0 ? `Pay ${usd(a.balance, a.currency)}` : 'View months / Pay in advance'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
