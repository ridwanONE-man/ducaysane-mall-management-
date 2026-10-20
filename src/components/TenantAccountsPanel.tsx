import React, { useMemo, useState } from 'react';
import { Users, Search, Phone, Copy, Check, CalendarCheck, PiggyBank, AlertTriangle, CheckCircle2, Store, ShieldCheck } from 'lucide-react';
import { TenantAccount } from '../utils/tenantAccount';
import { formatLongDate } from '../utils/printUtils';

interface TenantAccountsPanelProps {
  accounts: TenantAccount[];
  onOpenAccount: (account: TenantAccount) => void;
}

type Filter = 'all' | 'owing' | 'paid' | 'credit';

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TenantAccountsPanel: React.FC<TenantAccountsPanelProps> = ({ accounts, onOpenAccount }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const totals = useMemo(() => ({
    owed: accounts.reduce((s, a) => s + a.balance, 0),
    owing: accounts.filter(a => a.balance > 0).length,
    paid: accounts.filter(a => a.balance <= 0).length,
    credit: accounts.reduce((s, a) => s + a.credit, 0),
  }), [accounts]);

  const q = search.trim().toLowerCase();
  const shown = accounts.filter(a => {
    if (filter === 'owing' && a.balance <= 0) return false;
    if (filter === 'paid' && a.balance > 0) return false;
    if (filter === 'credit' && a.credit <= 0) return false;
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total balance owed', value: usd(totals.owed), tone: 'text-rose-600', icon: AlertTriangle },
          { label: 'Tenants with balance', value: String(totals.owing), tone: 'text-rose-600', icon: Users },
          { label: 'Tenants paid up', value: String(totals.paid), tone: 'text-emerald-600', icon: CheckCircle2 },
          { label: 'Advance credit held', value: usd(totals.credit), tone: 'text-blue-600', icon: PiggyBank },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
              <t.icon className={`w-3.5 h-3.5 ${t.tone}`} /> {t.label}
            </span>
            <span className={`block text-xl font-black mt-0.5 ${t.tone}`}>{t.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
          {([
            ['all', `All (${accounts.length})`],
            ['owing', `Balance (${totals.owing})`],
            ['paid', `Paid (${totals.paid})`],
            ['credit', `Credit (${accounts.filter(a => a.credit > 0).length})`],
          ] as [Filter, string][]).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === f ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
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
                    <span className="inline-block mt-0.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-sm font-black">{usd(a.balance)}</span>
                  ) : (
                    <span className="inline-block mt-0.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-sm font-black">✓ Paid</span>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Monthly rent</span>
                  <span className="font-bold text-emerald-700">{usd(a.monthlyRent)}</span>
                </div>
                {a.depositHeld > 0 && (
                  <div className="flex justify-between text-indigo-700">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Security deposit</span>
                    <span className="font-bold">{usd(a.depositHeld)}</span>
                  </div>
                )}
                {a.credit > 0 && (
                  <div className="flex justify-between text-blue-700">
                    <span className="flex items-center gap-1"><PiggyBank className="w-3.5 h-3.5" /> Advance credit</span>
                    <span className="font-bold">{usd(a.credit)}</span>
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
                    {m.short} {usd(m.remaining)}
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
                {a.balance > 0 ? `Pay ${usd(a.balance)}` : 'View months / Pay in advance'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
