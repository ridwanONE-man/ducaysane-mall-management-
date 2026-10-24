import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  Printer,
  CheckCircle,
  Clock,
  Search,
  Receipt,
  CalendarRange,
  Users,
  ListOrdered,
  DollarSign,
  Wallet,
} from 'lucide-react';
import { PaymentRecord, CurrencyMode, PropertyUnit } from '../types';
import { exportPaymentsToCSV } from '../utils/exportUtils';
import { TenantAccount } from '../utils/tenantAccount';
import { TenantAccountsPanel } from './TenantAccountsPanel';
import { DeleteButton, ClearAllButton } from './DeleteControls';
import { formatMoney, formatLongDate, parsePaymentDate } from '../utils/printUtils';
import { MONTH_NAMES } from '../utils/rentLedger';
import { CategorySwitch, UnitCategory, unitCategoryOf } from './CategorySwitch';

interface PaymentsViewProps {
  payments: PaymentRecord[];
  units?: PropertyUnit[];
  currencyMode: CurrencyMode;
  onOpenRecordPayment?: () => void;
  onSelectReceiptForPrint: (payment: PaymentRecord) => void;
  onDeletePayment?: (payment: PaymentRecord) => void;
  onClearAllPayments?: () => void;
  tenantAccounts?: TenantAccount[];
  onOpenTenantAccount?: (account: TenantAccount) => void;
}

type PeriodMode = 'all' | 'month' | 'year' | 'day' | 'range';
type StatusTab = 'All' | 'Paid' | 'Partially Paid';

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments: allPayments,
  units = [],
  onSelectReceiptForPrint,
  onDeletePayment,
  onClearAllPayments,
  tenantAccounts,
  onOpenTenantAccount
}) => {
  const [view, setView] = useState<'accounts' | 'ledger'>(tenantAccounts ? 'accounts' : 'ledger');
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('All');

  // Shops / spaces: by the unit each payment and tenant account belongs to
  const [category, setCategory] = useState<UnitCategory>('all');
  const accountsAll = tenantAccounts || [];
  const accountCategory = (a: TenantAccount) => unitCategoryOf(a.unit.unitNumber, units);
  const paymentCategory = (p: PaymentRecord) => unitCategoryOf(p.unitNumber, units);
  const payments = category === 'all' ? allPayments : allPayments.filter(p => paymentCategory(p) === category);
  const accounts = category === 'all' ? accountsAll : accountsAll.filter(a => accountCategory(a) === category);

  // Period: only transactions paid inside it are listed
  const today = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [day, setDay] = useState(toISO(today));
  const [fromDate, setFromDate] = useState(toISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toISO(today));

  const inPeriod = (p: PaymentRecord) => {
    if (periodMode === 'all') return true;
    const d = parsePaymentDate(p.date);
    if (!d) return false;
    if (periodMode === 'year') return d.getFullYear() === year;
    if (periodMode === 'month') return d.getFullYear() === year && d.getMonth() === month;
    if (periodMode === 'day') return d.toDateString() === (parsePaymentDate(day) || today).toDateString();
    const from = parsePaymentDate(fromDate);
    const to = parsePaymentDate(toDate);
    return !(from && d < from) && !(to && d > to);
  };
  const periodLabel = periodMode === 'all' ? 'All time'
    : periodMode === 'year' ? `Year ${year}`
    : periodMode === 'month' ? `${MONTH_NAMES[month]} ${year}`
    : periodMode === 'day' ? formatLongDate(day)
    : `${formatLongDate(fromDate)} – ${formatLongDate(toDate)}`;
  const availableYears = [...new Set([today.getFullYear(), ...payments.map(p => parsePaymentDate(p.date)?.getFullYear()).filter((y): y is number => Boolean(y))])]
    .sort((a, b) => b - a);

  const periodPayments = payments.filter(inPeriod);
  const q = search.trim().toLowerCase();
  const filteredPayments = periodPayments.filter(p => {
    const matchesSearch = !q || [p.tenantName, p.unitNumber, p.receiptNumber, p.accountingPeriod].some(v => (v || '').toLowerCase().includes(q));
    const matchesStatus = statusTab === 'All' || p.status === statusTab;
    return matchesSearch && matchesStatus;
  });

  const collected = (cur: 'USD' | 'SSP') => periodPayments.filter(p => p.currency === cur).reduce((s, p) => s + p.amount, 0);
  const collectedUSD = collected('USD');
  const collectedSSP = collected('SSP');
  const tenantsPaying = new Set(periodPayments.map(p => `${p.tenantName}|${p.unitNumber}`)).size;

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
      active ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
    }`;
  const selectCls = 'px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500';

  return (
    <div id="payments-ledger-container" className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <CreditCard className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Payments</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Who has paid, who owes, and every rent transaction.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportPaymentsToCSV(view === 'ledger' ? filteredPayments : payments)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
            </button>
            <button
              type="button"
              disabled={payments.length === 0}
              onClick={() => payments.length > 0 && onSelectReceiptForPrint(payments[0])}
              className="px-3.5 py-2 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5 text-orange-500" /> Print Latest
            </button>
            {onClearAllPayments && (
              <ClearAllButton
                count={allPayments.length}
                itemLabel="payments"
                onClear={onClearAllPayments}
                message="Every payment record is removed from the database, along with the cashflow entries created for them. This cannot be undone."
              />
            )}
          </div>
        </div>
      </div>

      {/* View switch */}
      {tenantAccounts && onOpenTenantAccount && (
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          {([
            ['accounts', 'Tenant Accounts', Users],
            ['ledger', `Transactions (${allPayments.length})`, ListOrdered],
          ] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                view === v ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/25' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Shops / spaces */}
      {view === 'accounts' ? (
        <CategorySwitch
          value={category}
          onChange={setCategory}
          noun="tenants"
          counts={{
            all: accountsAll.length,
            shop: accountsAll.filter(a => accountCategory(a) === 'shop').length,
            space: accountsAll.filter(a => accountCategory(a) === 'space').length,
          }}
        />
      ) : (
        <CategorySwitch
          value={category}
          onChange={setCategory}
          noun="payments"
          counts={{
            all: allPayments.filter(inPeriod).length,
            shop: allPayments.filter(inPeriod).filter(p => paymentCategory(p) === 'shop').length,
            space: allPayments.filter(inPeriod).filter(p => paymentCategory(p) === 'space').length,
          }}
        />
      )}

      {view === 'accounts' && tenantAccounts && onOpenTenantAccount ? (
        <TenantAccountsPanel accounts={accounts} payments={payments} onOpenAccount={onOpenTenantAccount} />
      ) : (
        <>
          {/* Period */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700"><CalendarRange className="w-4 h-4 text-orange-500" /> Show</span>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
              {([['all', 'All'], ['month', 'Month'], ['year', 'Year'], ['day', 'Day'], ['range', 'Custom']] as [PeriodMode, string][]).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setPeriodMode(m)} className={pill(periodMode === m)}>{label}</button>
              ))}
            </div>
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
            {periodMode === 'day' && <input type="date" value={day} onChange={e => setDay(e.target.value)} className={selectCls} />}
            {periodMode === 'range' && (
              <span className="flex items-center gap-2">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={selectCls} />
                <span className="text-xs font-bold text-slate-400">to</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={selectCls} />
              </span>
            )}
            <span className="ml-auto px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold">{periodLabel}</span>
          </div>

          {/* Period totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Transactions', value: String(periodPayments.length), icon: Receipt, tone: 'from-orange-500 to-amber-500 shadow-orange-500/30' },
              { label: 'Collected in dollars', value: formatMoney(collectedUSD, 'USD'), icon: DollarSign, tone: 'from-emerald-500 to-teal-500 shadow-emerald-500/30' },
              { label: 'Collected in SSP', value: formatMoney(collectedSSP, 'SSP'), icon: Wallet, tone: 'from-sky-500 to-blue-500 shadow-sky-500/30' },
              { label: 'Tenants who paid', value: String(tenantsPaying), icon: Users, tone: 'from-slate-600 to-slate-800 shadow-slate-500/30' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
                <span className={`w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br ${m.tone} text-white flex items-center justify-center shadow-md`}>
                  <m.icon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-500">{m.label}</span>
                  <span className="block text-lg font-black text-slate-900 truncate">{m.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search receipt, tenant, unit, month..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
                {(['All', 'Paid', 'Partially Paid'] as StatusTab[]).map(tab => (
                  <button key={tab} type="button" onClick={() => setStatusTab(tab)} className={pill(statusTab === tab)}>
                    {tab === 'Partially Paid' ? 'Partly paid' : tab}{' '}
                    <span className="opacity-75">({periodPayments.filter(p => tab === 'All' || p.status === tab).length})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Date & Month</th>
                    <th className="py-3 px-4">Tenant & Unit</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance left</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-14 text-center">
                        <div className="w-14 h-14 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3">
                          <Receipt className="w-7 h-7" />
                        </div>
                        <p className="font-extrabold text-slate-900 text-sm">
                          {payments.length === 0 ? 'No payments yet' : periodPayments.length === 0 ? `No payments in ${periodLabel}` : 'No matching payments'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Payments taken on Tenant Accounts appear here.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((item, i) => (
                      <tr key={item.id} className={`hover:bg-orange-50/40 transition-colors ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => onSelectReceiptForPrint(item)}
                            title="Open voucher"
                            className="font-mono text-[11px] font-black text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-lg cursor-pointer"
                          >
                            {item.receiptNumber}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800 whitespace-nowrap">{item.date}</p>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">{item.accountingPeriod}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 shrink-0 rounded-xl bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">{initials(item.tenantName)}</span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate max-w-[180px]">{item.tenantName}</p>
                              <p className="text-[10px] text-slate-500">{item.unitNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500 max-w-[140px] truncate">{item.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-black text-sm text-slate-900 whitespace-nowrap">{formatMoney(item.amount, item.currency)}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {item.remainingBalance > 0
                            ? <span className="font-bold text-amber-700">{formatMoney(item.remainingBalance, item.currency)}</span>
                            : <span className="font-bold text-emerald-600">Cleared</span>}
                        </td>
                        <td className="py-3 px-4">
                          {item.status === 'Paid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black">
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black">
                              <Clock className="w-3 h-3" /> Partly paid
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectReceiptForPrint(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" /> Voucher
                            </button>
                            {onDeletePayment && (
                              <DeleteButton
                                title="Delete payment"
                                onDelete={() => onDeletePayment(item)}
                                confirm={{
                                  title: 'Delete this payment?',
                                  subject: `${item.receiptNumber} • ${item.tenantName} • ${formatMoney(item.amount, item.currency)}`,
                                  message: 'The payment and its cashflow entry are removed from the database. This cannot be undone.',
                                }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredPayments.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
                Showing <strong className="text-slate-900">{filteredPayments.length}</strong> of {periodPayments.length} payments in {periodLabel}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
