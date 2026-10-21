import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Download,
  Users,
  CheckCircle2,
  AlertTriangle,
  Store,
  Phone,
  CreditCard,
  Undo2,
  X,
} from 'lucide-react';
import { DepositRecord, PropertyUnit, CurrencyMode } from '../types';
import { ClearAllButton } from './DeleteControls';
import { DepositRecordsPanel } from './DepositRecordsPanel';
import { formatDepositAmount } from './DepositVoucher';
import { TenantAccount, depositMonthLabels, isCreditDeposit } from '../utils/tenantAccount';

interface DepositsViewProps {
  units: PropertyUnit[];
  deposits?: DepositRecord[];
  currencyMode?: CurrencyMode;
  tenantAccounts?: TenantAccount[];
  onOpenDeposit?: (account: TenantAccount) => void;
  onOpenTenantPayments?: (account: TenantAccount) => void;
  onReleaseDeposit?: (deposit: DepositRecord) => void;
  onDeleteDeposit?: (deposit: DepositRecord) => void;
  onClearAllDeposits?: () => void;
}

type View = 'tenants' | 'records';
type TenantFilter = 'all' | 'ready' | 'owing' | 'held';

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const DepositsView: React.FC<DepositsViewProps> = ({
  units,
  deposits = [],
  tenantAccounts = [],
  onOpenDeposit,
  onOpenTenantPayments,
  onReleaseDeposit,
  onDeleteDeposit,
  onClearAllDeposits,
}) => {
  const [view, setView] = useState<View>('tenants');
  const [filter, setFilter] = useState<TenantFilter>('all');
  const [search, setSearch] = useState('');
  const [releasing, setReleasing] = useState<DepositRecord | null>(null);

  const q = search.trim().toLowerCase();
  const matches = (...values: (string | undefined)[]) => !q || values.some(v => (v || '').toLowerCase().includes(q));

  const heldDeposits = deposits.filter(d => d.status === 'Held in Escrow' && !isCreditDeposit(d));
  const totalHeld = heldDeposits.reduce((s, d) => s + d.amountUSD, 0);
  const counts = {
    ready: tenantAccounts.filter(a => a.canDeposit).length,
    owing: tenantAccounts.filter(a => !a.canDeposit).length,
    held: tenantAccounts.filter(a => a.depositHeld > 0).length,
  };

  const shownAccounts = tenantAccounts.filter(a => {
    if (filter === 'ready' && !a.canDeposit) return false;
    if (filter === 'owing' && a.canDeposit) return false;
    if (filter === 'held' && a.depositHeld <= 0) return false;
    return matches(a.tenant.name, a.unit.unitNumber, a.tenant.phone, a.tenant.trade);
  });

  const handleExportCSV = () => {
    const headers = ['Slip', 'Tenant', 'Unit', 'Amount USD', 'Months', 'Held Since', 'Status', 'Held In', 'Notes'];
    const rows = deposits.map(d => [
      d.depositSlip || d.id,
      `"${d.tenantName}"`,
      d.unitNumber,
      d.amountUSD.toFixed(2),
      String(d.depositMonths || ''),
      d.heldSince,
      d.status,
      `"${d.bankAccount}"`,
      `"${(d.notes || '').replace(/"/g, "'")}"`,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `Deposits_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="deposits-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Security Deposits</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Take a deposit once a tenant's rent is paid up to date, and choose the months it covers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          {onClearAllDeposits && (
            <ClearAllButton count={deposits.length} itemLabel="deposits" onClear={onClearAllDeposits} />
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Deposits held', value: usd(totalHeld), tone: 'text-blue-700', icon: ShieldCheck },
          { label: 'Tenants with a deposit', value: String(counts.held), tone: 'text-blue-700', icon: Users },
          { label: 'Ready for a deposit', value: String(counts.ready), tone: 'text-emerald-600', icon: CheckCircle2 },
          { label: 'Must pay rent first', value: String(counts.owing), tone: 'text-rose-600', icon: AlertTriangle },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
              <t.icon className={`w-3.5 h-3.5 ${t.tone}`} /> {t.label}
            </span>
            <span className={`block text-xl font-black mt-0.5 ${t.tone}`}>{t.value}</span>
          </div>
        ))}
      </div>

      {/* View switch + search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold self-start">
          {([
            ['tenants', `Tenants (${tenantAccounts.length})`],
            ['records', `Deposit Records (${deposits.length})`],
          ] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                view === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {view === 'tenants' && (
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-semibold">
              {([
                ['all', 'All'],
                ['ready', `Ready (${counts.ready})`],
                ['owing', `Pay first (${counts.owing})`],
                ['held', `Has deposit (${counts.held})`],
              ] as [TenantFilter, string][]).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filter === f ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={view === 'tenants' ? 'Search tenant, unit, phone...' : 'Search tenant name or voucher no...'}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {view === 'tenants' ? (
        shownAccounts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            {tenantAccounts.length === 0 ? 'No tenants yet. Lease a unit to a tenant first.' : 'No tenants match this search or filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shownAccounts.map(a => {
              const depositMonths = a.securityDeposits.flatMap(depositMonthLabels);
              return (
                <div key={a.key} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 text-sm truncate">{a.tenant.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                          <Store className="w-3 h-3" /> {a.unit.unitNumber}
                        </span>
                        <span>Rent {usd(a.monthlyRent)}</span>
                      </div>
                    </div>
                    {a.canDeposit ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black">
                        <CheckCircle2 className="w-3 h-3" /> Rent paid
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-[10px] font-black">
                        <AlertTriangle className="w-3 h-3" /> Owes rent
                      </span>
                    )}
                  </div>

                  {/* Rent status */}
                  <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] ${a.canDeposit ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
                    {a.canDeposit
                      ? `All months up to ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} are paid.`
                      : <>Owes <strong>{usd(a.dueNow.reduce((s, m) => s + m.remaining, 0))}</strong> for {a.dueNow.map(m => m.short).join(', ')}. Pay this before taking a deposit.</>}
                  </div>

                  {/* Deposit held */}
                  <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2 text-[11px] flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-blue-900 min-w-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{a.depositHeld > 0 ? (depositMonths.length ? depositMonths.join(', ') : 'Deposit held') : 'No deposit yet'}</span>
                    </span>
                    <span className="font-black text-blue-700 shrink-0">{a.depositHeld > 0 ? usd(a.depositHeld) : '—'}</span>
                  </div>

                  {a.tenant.phone && (
                    <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-emerald-600" /> {a.tenant.phone}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    {a.canDeposit ? (
                      <button
                        type="button"
                        onClick={() => onOpenDeposit?.(a)}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/25 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {a.depositHeld > 0 ? 'Add More Deposit' : 'Add Deposit'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenTenantPayments?.(a)}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        Pay rent first
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <DepositRecordsPanel
          deposits={deposits}
          units={units}
          search={search}
          onRelease={onReleaseDeposit ? setReleasing : undefined}
          onDelete={onDeleteDeposit}
        />
      )}

      {/* Release confirmation */}
      {releasing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Undo2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Release this deposit?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Return <strong>{formatDepositAmount(releasing)}</strong> to <strong>{releasing.tenantName}</strong> ({releasing.unitNumber}).
                It is recorded as an outflow in Cashflow and the record stays as "Refunded".
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReleasing(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onReleaseDeposit?.(releasing); setReleasing(null); }}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Release {formatDepositAmount(releasing)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
