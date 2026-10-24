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
import { formatMoney } from '../utils/printUtils';
import { RentCurrency, depositIn, formatBoth } from '../utils/currency';
import { DepositRecordsPanel } from './DepositRecordsPanel';
import { unitCategoryOf } from './CategorySwitch';
import { formatDepositAmount } from './DepositVoucher';
import { TenantAccount, depositMonthLabels, isAmountDeposit } from '../utils/tenantAccount';

interface DepositsViewProps {
  units: PropertyUnit[];
  deposits?: DepositRecord[];
  currencyMode?: CurrencyMode;
  tenantAccounts?: TenantAccount[];
  onOpenDeposit?: (account: TenantAccount) => void;
  onManageDeposit?: (account: TenantAccount) => void;
  onOpenTenantPayments?: (account: TenantAccount) => void;
  onReleaseDeposit?: (deposit: DepositRecord) => void;
  onDeleteDeposit?: (deposit: DepositRecord) => void;
  onClearAllDeposits?: () => void;
}

type View = 'tenants' | 'records';
type TenantFilter = 'all' | 'ready' | 'owing' | 'held' | 'none';

const usd = (n: number, currency: RentCurrency = 'USD') => formatMoney(n, currency);

export const DepositsView: React.FC<DepositsViewProps> = ({
  units,
  deposits = [],
  tenantAccounts = [],
  onOpenDeposit,
  onManageDeposit,
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

  const heldDeposits = deposits.filter(d => d.status === 'Held in Escrow');
  const totalHeldUSD = heldDeposits.reduce((s, d) => s + depositIn(d, 'USD'), 0);
  const totalHeldSSP = heldDeposits.reduce((s, d) => s + depositIn(d, 'SSP'), 0);
  const counts = {
    ready: tenantAccounts.filter(a => a.canDeposit).length,
    owing: tenantAccounts.filter(a => !a.canDeposit).length,
    held: tenantAccounts.filter(a => a.depositHeld > 0).length,
    none: tenantAccounts.filter(a => a.depositHeld <= 0).length,
  };

  const shownAccounts = tenantAccounts.filter(a => {
    if (filter === 'ready' && !a.canDeposit) return false;
    if (filter === 'owing' && a.canDeposit) return false;
    if (filter === 'held' && a.depositHeld <= 0) return false;
    if (filter === 'none' && a.depositHeld > 0) return false;
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
    <div id="deposits-view" className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Security Deposits</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Take a deposit once rent is paid up to date — by months or any amount.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
            </button>
            {onClearAllDeposits && (
              <ClearAllButton count={deposits.length} itemLabel="deposits" onClear={onClearAllDeposits} />
            )}
          </div>
        </div>
      </div>

      {/* Totals: who can deposit, then one card per currency */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1.6fr)] gap-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
          <div className="absolute -right-8 -bottom-10 w-32 h-32 rounded-full bg-orange-500/20" />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Tenants</span>
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center"><Users className="w-4 h-4" /></span>
          </div>
          <p className="relative text-4xl font-black mt-1">{tenantAccounts.length}</p>
          <div className="relative grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl bg-white/10 px-2.5 py-1.5">
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300"><CheckCircle2 className="w-3 h-3" /> Ready</span>
              <span className="text-base font-black">{counts.ready}</span>
            </div>
            <div className="rounded-xl bg-white/10 px-2.5 py-1.5">
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-300"><AlertTriangle className="w-3 h-3" /> Pay first</span>
              <span className="text-base font-black">{counts.owing}</span>
            </div>
          </div>
        </div>

        {(['USD', 'SSP'] as const).map(cur => {
          const isUsd = cur === 'USD';
          const list = tenantAccounts.filter(a => a.currency === cur);
          const held = deposits.filter(d => d.status === 'Held in Escrow').reduce((s, d) => s + depositIn(d, cur), 0);
          const refunded = deposits.filter(d => d.status === 'Refunded').reduce((s, d) => s + depositIn(d, cur), 0);
          const boxes = [
            { label: 'Deposits held', value: formatMoney(held, cur), icon: ShieldCheck },
            { label: 'With a deposit', value: `${list.filter(a => a.depositHeld > 0).length} tenant(s)`, icon: Users },
            { label: 'No deposit yet', value: `${list.filter(a => a.depositHeld <= 0).length} tenant(s)`, icon: AlertTriangle },
            { label: 'Refunded', value: formatMoney(refunded, cur), icon: Undo2 },
          ];
          return (
            <div
              key={cur}
              className={`relative overflow-hidden rounded-3xl p-5 text-white ${
                isUsd ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-orange-500 to-amber-500'
              }`}
            >
              <div className="absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-white/10" />
              <div className="relative flex items-center gap-3">
                <span className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${isUsd ? 'bg-orange-500' : 'bg-white/20'}`}>
                  {isUsd ? <span className="text-lg">$</span> : <span className="text-[11px]">SSP</span>}
                </span>
                <div>
                  <p className="text-sm font-extrabold">{isUsd ? 'Dollar ($)' : 'South Sudanese Pound'}</p>
                  <p className="text-[11px] opacity-70">{list.length} tenant{list.length === 1 ? '' : 's'} renting in {isUsd ? 'dollars' : 'SSP'}</p>
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
        })}
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
                view === v ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/25' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={view === 'tenants' ? 'Search tenant, unit, phone...' : 'Search tenant name or voucher no...'}
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tenant filters: who has a deposit and who doesn't */}
      {view === 'tenants' && (
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold w-fit max-w-full">
          {([
            ['all', 'All', tenantAccounts.length, 'bg-slate-900 text-white'],
            ['held', 'With deposit', counts.held, 'bg-blue-600 text-white'],
            ['none', 'No deposit', counts.none, 'bg-slate-600 text-white'],
            ['ready', 'Ready to deposit', counts.ready, 'bg-emerald-600 text-white'],
            ['owing', 'Pay rent first', counts.owing, 'bg-rose-600 text-white'],
          ] as [TenantFilter, string, number, string][]).map(([f, label, n, tone]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === f ? `${tone} shadow-xs font-bold` : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              {label} <span className="opacity-75">({n})</span>
            </button>
          ))}
        </div>
      )}

      {view === 'tenants' ? (
        shownAccounts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            {tenantAccounts.length === 0 ? 'No tenants yet. Lease a unit to a tenant first.' : 'No tenants match this search or filter.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shownAccounts.map(a => {
              const depositMonths = a.securityDeposits.flatMap(depositMonthLabels);
              const amountDeposits = a.securityDeposits.filter(isAmountDeposit).reduce((s, d) => s + depositIn(d, a.currency), 0);
              const isShop = unitCategoryOf(a.unit.unitNumber, units) !== 'space';
              const owed = a.dueNow.reduce((s, m) => s + m.remaining, 0);
              const hasDeposit = a.depositHeld > 0;
              const initials = a.tenant.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={a.key} className="group bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className={`relative px-4 pt-4 pb-3 text-white bg-gradient-to-br ${isShop ? 'from-orange-500 to-amber-500' : 'from-blue-600 to-indigo-600'}`}>
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                    <div className="relative flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-xs flex items-center justify-center font-black text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-sm truncate">{a.tenant.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-white/85">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/20 font-bold text-white">
                            <Store className="w-3 h-3" /> {a.unit.unitNumber}
                          </span>
                          <span>{isShop ? 'Shop' : 'Space'} • {usd(a.monthlyRent, a.currency)}/mo</span>
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-[10px] font-black shadow-xs ${a.canDeposit ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {a.canDeposit ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {a.canDeposit ? 'Rent paid' : 'Owes rent'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1 gap-3">
                    {/* Deposit held */}
                    <div className={`rounded-2xl p-3 ${hasDeposit ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-dashed border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${hasDeposit ? 'text-orange-300' : 'text-slate-400'}`}>
                          <ShieldCheck className="w-3.5 h-3.5" /> Deposit held
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${hasDeposit ? 'bg-white/10 text-white/80' : 'bg-white text-slate-400'}`}>{a.currency}</span>
                      </div>
                      <p className={`mt-1 text-xl font-black tracking-tight ${hasDeposit ? 'text-white' : 'text-slate-300'}`}>
                        {hasDeposit ? usd(a.depositHeld, a.currency) : 'No deposit yet'}
                      </p>
                      {hasDeposit && (depositMonths.length > 0 || amountDeposits > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {depositMonths.map(m => (
                            <span key={m} className="px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-200 text-[10px] font-bold">{m}</span>
                          ))}
                          {amountDeposits > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/80 text-[10px] font-bold">{usd(amountDeposits, a.currency)} any amount</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Rent status */}
                    <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] ${a.canDeposit ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${a.canDeposit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span>
                        {a.canDeposit
                          ? `All months up to ${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} are paid.`
                          : <>Owes <strong>{usd(owed, a.currency)}</strong> for {a.dueNow.map(m => m.short).join(', ')}. Pay this before taking a deposit.</>}
                      </span>
                    </div>

                    {a.tenant.phone && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {a.tenant.phone}
                      </p>
                    )}

                    <div className="mt-auto pt-1 flex gap-2">
                      {hasDeposit && onManageDeposit && (
                        <button data-edit
                          type="button"
                          onClick={() => onManageDeposit(a)}
                          className="shrink-0 px-3 py-2.5 rounded-xl bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 hover:text-orange-700 text-xs font-extrabold cursor-pointer"
                          title="Unmark months or clear this deposit"
                        >
                          Manage
                        </button>
                      )}
                      {a.canDeposit ? (
                        <button data-edit
                          type="button"
                          onClick={() => onOpenDeposit?.(a)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/25 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          {hasDeposit ? 'Add More Deposit' : 'Add Deposit'}
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
