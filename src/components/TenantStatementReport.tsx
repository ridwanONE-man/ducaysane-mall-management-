import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Printer,
  Users,
  Calendar,
  Receipt,
  RefreshCw,
  Database,
  WifiOff,
  ChevronLeft,
  Phone,
  Mail,
  Store,
  X,
} from 'lucide-react';
import { PropertyUnit, PaymentRecord, DepositRecord } from '../types';
import { getTenantPaymentsFromSupabase } from '../lib/supabaseService';
import {
  parsePaymentDate,
  formatLongDate,
  formatMoney,
  normalizeName,
  normalizeUnitNumber,
} from '../utils/printUtils';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import { Letterhead } from './ReceiptDocument';
import { PrintPortal } from './PrintPortal';

interface TenantStatementReportProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
  deposits: DepositRecord[];
  onSelectReceiptForPrint?: (payment: PaymentRecord) => void;
}

interface TenantEntry {
  key: string;
  name: string;
  unitNumber: string;
  unit?: PropertyUnit;
  isCurrent: boolean;
}

type PeriodMode = 'all' | 'year' | 'month' | 'range';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const tenantKey = (name: string, unitNumber: string) =>
  `${normalizeName(name)}|${normalizeUnitNumber(unitNumber)}`;

const paymentBelongsTo = (p: PaymentRecord, tenant: TenantEntry) =>
  tenantKey(p.tenantName, p.unitNumber) === tenant.key;

const sumBy = (list: PaymentRecord[], currency: 'USD' | 'SSP') =>
  list.filter(p => p.currency === currency).reduce((s, p) => s + p.amount, 0);

export const TenantStatementReport: React.FC<TenantStatementReportProps> = ({
  units,
  payments,
  deposits,
  onSelectReceiptForPrint,
}) => {
  const now = new Date();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dbPayments, setDbPayments] = useState<PaymentRecord[] | null>(null);
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'synced' | 'offline'>('idle');
  const [isPrinting, setIsPrinting] = useState(false);
  const latestRequestKey = useRef<string | null>(null);

  // Every tenant who currently leases a unit, plus former tenants who still have payment history.
  const tenants = useMemo<TenantEntry[]>(() => {
    const map = new Map<string, TenantEntry>();
    units.forEach(u => {
      if (!u.currentTenant?.name) return;
      const key = tenantKey(u.currentTenant.name, u.unitNumber);
      map.set(key, { key, name: u.currentTenant.name, unitNumber: u.unitNumber, unit: u, isCurrent: true });
    });
    payments.forEach(p => {
      if (!p.tenantName) return;
      const key = tenantKey(p.tenantName, p.unitNumber);
      if (!map.has(key)) {
        map.set(key, { key, name: p.tenantName, unitNumber: p.unitNumber, isCurrent: false });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [units, payments]);

  const selectedTenant = tenants.find(t => t.key === selectedKey) || null;

  // Pull the freshest history for the selected tenant from the database.
  const loadTenantFromDb = async (tenant: TenantEntry) => {
    latestRequestKey.current = tenant.key;
    setDbStatus('loading');
    const rows = await getTenantPaymentsFromSupabase(tenant.name);
    if (latestRequestKey.current !== tenant.key) return;
    if (rows === null) {
      setDbPayments(null);
      setDbStatus('offline');
    } else {
      setDbPayments(rows.filter(p => paymentBelongsTo(p, tenant)));
      setDbStatus('synced');
    }
  };

  useEffect(() => {
    setDbPayments(null);
    setDbStatus('idle');
    latestRequestKey.current = null;
    if (selectedTenant) loadTenantFromDb(selectedTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const isInPeriod = (p: PaymentRecord) => {
    if (periodMode === 'all') return true;
    const d = parsePaymentDate(p.date);
    if (!d) return false;
    if (periodMode === 'year') return d.getFullYear() === year;
    if (periodMode === 'month') return d.getFullYear() === year && d.getMonth() === month;
    const from = parsePaymentDate(fromDate);
    const to = parsePaymentDate(toDate);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const matchesSearch = (p: PaymentRecord) => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return true;
    return [p.receiptNumber, p.accountingPeriod, p.paymentMethod, p.notes, p.date, p.status, p.receivedBy]
      .some(v => (v || '').toLowerCase().includes(q));
  };

  const sortByDateDesc = (list: PaymentRecord[]) =>
    [...list].sort((a, b) => (parsePaymentDate(b.date)?.getTime() || 0) - (parsePaymentDate(a.date)?.getTime() || 0));

  // Database rows win; locally cached rows that haven't synced yet are kept too.
  const tenantAllPayments = useMemo(() => {
    if (!selectedTenant) return [];
    const local = payments.filter(p => paymentBelongsTo(p, selectedTenant));
    if (!dbPayments) return local;
    const dbIds = new Set(dbPayments.map(p => p.id));
    return [...dbPayments, ...local.filter(p => !dbIds.has(p.id))];
  }, [selectedTenant, payments, dbPayments]);

  const statementPayments = sortByDateDesc(tenantAllPayments.filter(p => isInPeriod(p) && matchesSearch(p)));

  const periodLabel =
    periodMode === 'all' ? 'All Time'
    : periodMode === 'year' ? `Year ${year}`
    : periodMode === 'month' ? `${MONTHS[month]} ${year}`
    : `${fromDate ? formatLongDate(fromDate) : 'Beginning'} – ${toDate ? formatLongDate(toDate) : 'Today'}`;

  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    payments.forEach(p => {
      const d = parsePaymentDate(p.date);
      if (d) years.add(d.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments]);

  // Overview of all tenants for the chosen period (shown when no tenant is selected).
  const tenantOverview = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    return tenants
      .filter(t => !q || t.name.toLowerCase().includes(q) || t.unitNumber.toLowerCase().includes(q)
        || (t.unit?.currentTenant?.code || '').toLowerCase().includes(q)
        || (t.unit?.currentTenant?.phone || '').toLowerCase().includes(q))
      .map(t => {
        const list = payments.filter(p => paymentBelongsTo(p, t) && isInPeriod(p));
        const last = sortByDateDesc(list)[0];
        return {
          tenant: t,
          count: list.length,
          paidUSD: sumBy(list, 'USD'),
          paidSSP: sumBy(list, 'SSP'),
          lastDate: last?.date,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, payments, tenantSearch, periodMode, year, month, fromDate, toDate]);

  const monthlyBreakdown = useMemo(() => {
    if (!selectedTenant || periodMode !== 'year') return [];
    return MONTHS.map((label, idx) => {
      const list = tenantAllPayments.filter(p => {
        const d = parsePaymentDate(p.date);
        return d && d.getFullYear() === year && d.getMonth() === idx;
      });
      return { label, idx, usd: sumBy(list, 'USD'), ssp: sumBy(list, 'SSP'), count: list.length };
    });
  }, [selectedTenant, periodMode, year, tenantAllPayments]);

  const deposit = selectedTenant
    ? deposits.find(d => tenantKey(d.tenantName, d.unitNumber) === selectedTenant.key && d.status !== 'Refunded')
    : undefined;

  const summary = {
    count: statementPayments.length,
    paidUSD: sumBy(statementPayments, 'USD'),
    paidSSP: sumBy(statementPayments, 'SSP'),
    arrearsUSD: selectedTenant?.unit?.arrearsUSD || 0,
    arrearsSSP: selectedTenant?.unit?.arrearsSSP || 0,
    lastPayment: statementPayments[0],
  };

  // Print only once the print copy has been rendered into the portal.
  useEffect(() => {
    if (!isPrinting) return;
    const timer = setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [isPrinting]);

  const statementNumber = `STM-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
    selectedTenant ? normalizeUnitNumber(selectedTenant.unitNumber).toUpperCase() : 'ALL'
  }`;

  // ---------------------------------------------------------------
  // Filters bar
  // ---------------------------------------------------------------
  const filters = (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-bold text-slate-700 mr-1">Period:</span>
        {([
          ['all', 'All Time'],
          ['year', 'By Year'],
          ['month', 'By Month'],
          ['range', 'Custom Dates'],
        ] as [PeriodMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPeriodMode(mode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              periodMode === mode ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}

        {(periodMode === 'year' || periodMode === 'month') && (
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {periodMode === 'month' && (
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        )}
        {periodMode === 'range' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>
        )}

        <span className="ml-auto text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
          {periodLabel}
        </span>
      </div>
    </div>
  );

  // ---------------------------------------------------------------
  // Print document
  // ---------------------------------------------------------------
  const printDocument = (
    <div className="bg-white text-slate-900 font-sans">
      <Letterhead />
      <div className="px-8 py-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Official Document</p>
            <h2 className="text-2xl font-black tracking-tight">
              {selectedTenant ? 'TENANT STATEMENT OF ACCOUNT' : 'TENANT PAYMENTS SUMMARY'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Period: <strong className="text-slate-900">{periodLabel}</strong></p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p className="font-mono font-black text-rose-700 text-sm">{statementNumber}</p>
            <p className="text-slate-500">Issued: <strong className="text-slate-900">{formatLongDate(now)}</strong></p>
          </div>
        </div>

        {selectedTenant ? (
          <>
            <div className="grid grid-cols-2 gap-4 print-avoid-break">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tenant</p>
                <p className="text-lg font-extrabold leading-tight">{selectedTenant.name}</p>
                {selectedTenant.unit?.currentTenant?.code && (
                  <p className="font-mono text-slate-500">ID: {selectedTenant.unit.currentTenant.code}</p>
                )}
                {selectedTenant.unit?.currentTenant?.trade && <p className="text-slate-600">{selectedTenant.unit.currentTenant.trade}</p>}
                {selectedTenant.unit?.currentTenant?.phone && <p className="text-slate-600">Tel: {selectedTenant.unit.currentTenant.phone}</p>}
                {selectedTenant.unit?.currentTenant?.email && <p className="text-slate-600">{selectedTenant.unit.currentTenant.email}</p>}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-500">Unit</span><strong>{selectedTenant.unitNumber}</strong></div>
                {selectedTenant.unit && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-500">Floor / Type</span><strong>{selectedTenant.unit.floor} • {selectedTenant.unit.type}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-500">Monthly Rent</span><strong>{formatMoney(selectedTenant.unit.monthlyRateUSD, 'USD')}</strong></div>
                    {selectedTenant.unit.leaseEnd && (
                      <div className="flex justify-between"><span className="text-slate-500">Lease</span><strong>{formatLongDate(selectedTenant.unit.leaseStart) || '—'} → {formatLongDate(selectedTenant.unit.leaseEnd)}</strong></div>
                    )}
                  </>
                )}
                {deposit && (
                  <div className="flex justify-between"><span className="text-slate-500">Security Deposit</span><strong>{formatMoney(deposit.amountUSD, 'USD')}</strong></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Status</span><strong>{selectedTenant.isCurrent ? 'Active Tenant' : 'Former Tenant'}</strong></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 print-avoid-break">
              <div className="rounded-2xl border-2 border-slate-900 bg-emerald-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Total Paid</p>
                <p className="font-mono text-lg font-black text-emerald-700">{formatMoney(summary.paidUSD, 'USD')}</p>
                {summary.paidSSP > 0 && <p className="font-mono text-xs font-bold text-emerald-700">{formatMoney(summary.paidSSP, 'SSP')}</p>}
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Payments</p>
                <p className="text-lg font-black">{summary.count}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Current Balance Due</p>
                <p className={`font-mono text-lg font-black ${summary.arrearsUSD > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatMoney(summary.arrearsUSD, 'USD')}
                </p>
                {summary.arrearsSSP > 0 && <p className="font-mono text-xs font-bold text-rose-600">{formatMoney(summary.arrearsSSP, 'SSP')}</p>}
              </div>
            </div>

            <table className="w-full text-[11px] border border-slate-200">
              <thead>
                <tr className="bg-slate-900 text-white text-left">
                  <th className="py-2 px-2.5">Date</th>
                  <th className="py-2 px-2.5">Receipt #</th>
                  <th className="py-2 px-2.5">Rent Period</th>
                  <th className="py-2 px-2.5">Method</th>
                  <th className="py-2 px-2.5 text-right">Amount</th>
                  <th className="py-2 px-2.5 text-right">Balance</th>
                  <th className="py-2 px-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {statementPayments.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">No payments recorded in this period.</td></tr>
                ) : statementPayments.map((p, i) => (
                  <tr key={p.id} className={`print-avoid-break ${i % 2 ? 'bg-slate-50' : ''}`}>
                    <td className="py-1.5 px-2.5 whitespace-nowrap">{formatLongDate(p.date)}</td>
                    <td className="py-1.5 px-2.5 font-mono">{p.receiptNumber}</td>
                    <td className="py-1.5 px-2.5">{p.accountingPeriod}</td>
                    <td className="py-1.5 px-2.5">{p.paymentMethod}</td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold">{formatMoney(p.amount, p.currency)}</td>
                    <td className="py-1.5 px-2.5 text-right font-mono">{formatMoney(Math.max(0, p.remainingBalance), p.currency)}</td>
                    <td className="py-1.5 px-2.5">{p.status}</td>
                  </tr>
                ))}
              </tbody>
              {statementPayments.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-black">
                    <td colSpan={4} className="py-2 px-2.5 text-right uppercase text-[10px]">Total Paid in Period</td>
                    <td className="py-2 px-2.5 text-right font-mono">
                      {formatMoney(summary.paidUSD, 'USD')}
                      {summary.paidSSP > 0 && <div>{formatMoney(summary.paidSSP, 'SSP')}</div>}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </>
        ) : (
          <table className="w-full text-[11px] border border-slate-200">
            <thead>
              <tr className="bg-slate-900 text-white text-left">
                <th className="py-2 px-2.5">#</th>
                <th className="py-2 px-2.5">Tenant</th>
                <th className="py-2 px-2.5">Unit</th>
                <th className="py-2 px-2.5 text-right">Payments</th>
                <th className="py-2 px-2.5 text-right">Paid (USD)</th>
                <th className="py-2 px-2.5 text-right">Paid (SSP)</th>
                <th className="py-2 px-2.5">Last Payment</th>
              </tr>
            </thead>
            <tbody>
              {tenantOverview.map((row, i) => (
                <tr key={row.tenant.key} className={`print-avoid-break ${i % 2 ? 'bg-slate-50' : ''}`}>
                  <td className="py-1.5 px-2.5 text-slate-400">{i + 1}</td>
                  <td className="py-1.5 px-2.5 font-bold">{row.tenant.name}</td>
                  <td className="py-1.5 px-2.5">{row.tenant.unitNumber}</td>
                  <td className="py-1.5 px-2.5 text-right">{row.count}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">{formatMoney(row.paidUSD, 'USD')}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">{row.paidSSP ? formatMoney(row.paidSSP, 'SSP') : '—'}</td>
                  <td className="py-1.5 px-2.5">{row.lastDate ? formatLongDate(row.lastDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black">
                <td colSpan={3} className="py-2 px-2.5 text-right uppercase text-[10px]">Totals</td>
                <td className="py-2 px-2.5 text-right">{tenantOverview.reduce((s, r) => s + r.count, 0)}</td>
                <td className="py-2 px-2.5 text-right font-mono">{formatMoney(tenantOverview.reduce((s, r) => s + r.paidUSD, 0), 'USD')}</td>
                <td className="py-2 px-2.5 text-right font-mono">{formatMoney(tenantOverview.reduce((s, r) => s + r.paidSSP, 0), 'SSP')}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        <div className="grid grid-cols-2 gap-10 pt-8 print-avoid-break">
          <div>
            <div className="h-10 border-b-2 border-dotted border-slate-400" />
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">Prepared By</p>
          </div>
          <div className="text-right">
            <div className="h-10 border-b-2 border-dotted border-slate-400" />
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">Authorized Signature & Stamp</p>
            <p className="text-[10px] text-slate-400">For {BUSINESS_PROFILE.name}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-8 py-3 flex justify-between text-[10px] text-slate-500">
        <span className="font-bold uppercase tracking-widest text-slate-700">{BUSINESS_PROFILE.name}</span>
        <span>Computer generated statement • {formatLongDate(now)}</span>
      </div>
    </div>
  );

  const printButton = (
    <button
      type="button"
      onClick={() => setIsPrinting(true)}
      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-orange-500/20 cursor-pointer"
    >
      <Printer className="w-3.5 h-3.5" />
      <span>{selectedTenant ? 'Print Statement' : 'Print Summary'}</span>
    </button>
  );

  // ---------------------------------------------------------------
  // Screen: all tenants overview
  // ---------------------------------------------------------------
  if (!selectedTenant) {
    return (
      <div className="space-y-5 animate-in fade-in">
        {filters}

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Select a Tenant
              </h4>
              <p className="text-[11px] text-slate-500">Click any tenant to open their full payment statement.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  placeholder="Search name, unit, ID or phone..."
                  className="pl-9 pr-8 py-2 w-64 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                {tenantSearch && (
                  <button onClick={() => setTenantSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {printButton}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tenant</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Payments</th>
                  <th className="py-3 px-4 text-right">Paid ({periodLabel})</th>
                  <th className="py-3 px-4">Last Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenantOverview.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">No tenants match your search.</td></tr>
                ) : tenantOverview.map(row => (
                  <tr
                    key={row.tenant.key}
                    onClick={() => setSelectedKey(row.tenant.key)}
                    className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{row.tenant.name}</div>
                      {row.tenant.unit?.currentTenant?.trade && (
                        <div className="text-[11px] text-slate-400">{row.tenant.unit.currentTenant.trade}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">{row.tenant.unitNumber}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.tenant.isCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.tenant.isCurrent ? 'Active' : 'Former'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold">{row.count}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {formatMoney(row.paidUSD, 'USD')}
                      {row.paidSSP > 0 && <div className="text-[11px]">{formatMoney(row.paidSSP, 'SSP')}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{row.lastDate ? formatLongDate(row.lastDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isPrinting && <PrintPortal>{printDocument}</PrintPortal>}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Screen: single tenant statement
  // ---------------------------------------------------------------
  const contact = selectedTenant.unit?.currentTenant;
  const maxMonthUSD = Math.max(1, ...monthlyBreakdown.map(m => m.usd));

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Tenant header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setSelectedKey(null)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
            title="Back to all tenants"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-extrabold text-slate-900">{selectedTenant.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                selectedTenant.isCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {selectedTenant.isCurrent ? 'Active Tenant' : 'Former Tenant'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><Store className="w-3.5 h-3.5" /> {selectedTenant.unitNumber}{selectedTenant.unit ? ` • ${selectedTenant.unit.floor}` : ''}</span>
              {contact?.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {contact.phone}</span>}
              {contact?.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {contact.email}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTenant.key}
            onChange={e => setSelectedKey(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 max-w-56 focus:outline-none focus:border-blue-600"
          >
            {tenants.map(t => <option key={t.key} value={t.key}>{t.name} — {t.unitNumber}</option>)}
          </select>
          <button
            type="button"
            onClick={() => loadTenantFromDb(selectedTenant)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
              dbStatus === 'offline' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="Reload this tenant's payments from the database"
          >
            {dbStatus === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : dbStatus === 'offline' ? <WifiOff className="w-3.5 h-3.5" />
              : <Database className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{dbStatus === 'loading' ? 'Syncing…' : dbStatus === 'offline' ? 'Offline (cached)' : 'Live from database'}</span>
          </button>
          {printButton}
        </div>
      </div>

      {filters}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Total Paid</span>
          <span className="text-2xl font-black text-emerald-600">{formatMoney(summary.paidUSD, 'USD')}</span>
          {summary.paidSSP > 0 && <span className="text-xs font-bold text-emerald-600 block">{formatMoney(summary.paidSSP, 'SSP')}</span>}
          <span className="text-[11px] text-slate-400 block mt-0.5">{periodLabel}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Payments Made</span>
          <span className="text-2xl font-black text-slate-900">{summary.count}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Last: {summary.lastPayment ? formatLongDate(summary.lastPayment.date) : '—'}
          </span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Monthly Rent</span>
          <span className="text-2xl font-black text-blue-600">{formatMoney(selectedTenant.unit?.monthlyRateUSD || 0, 'USD')}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Deposit: {deposit ? formatMoney(deposit.amountUSD, 'USD') : formatMoney(selectedTenant.unit?.escrowDepositUSD || 0, 'USD')}
          </span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Current Balance Due</span>
          <span className={`text-2xl font-black ${summary.arrearsUSD > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {formatMoney(summary.arrearsUSD, 'USD')}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">{selectedTenant.unit?.billingStatus || '—'}</span>
        </div>
      </div>

      {/* Month-by-month for the selected year */}
      {periodMode === 'year' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <h4 className="font-bold text-slate-900 text-sm mb-3">Month-by-Month Payments — {year}</h4>
          <div className="grid grid-cols-6 lg:grid-cols-12 gap-2">
            {monthlyBreakdown.map(m => (
              <button
                key={m.label}
                type="button"
                onClick={() => { setPeriodMode('month'); setMonth(m.idx); }}
                className="group flex flex-col items-center gap-1 cursor-pointer"
                title={`View ${m.label} ${year}`}
              >
                <div className="h-20 w-full bg-slate-50 rounded-lg flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-lg transition-all ${m.count ? 'bg-blue-600 group-hover:bg-blue-700' : 'bg-slate-200'}`}
                    style={{ height: m.count ? `${Math.max(8, (m.usd / maxMonthUSD) * 100)}%` : '4px' }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-600">{m.label.slice(0, 3)}</span>
                <span className={`text-[10px] font-mono ${m.count ? 'text-emerald-600 font-bold' : 'text-slate-300'}`}>
                  {m.count ? `$${m.usd.toLocaleString()}` : 'unpaid'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" /> Payment History
            <span className="text-xs text-slate-400 font-semibold">({statementPayments.length})</span>
          </h4>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={paymentSearch}
              onChange={e => setPaymentSearch(e.target.value)}
              placeholder="Search receipt #, period, method..."
              className="pl-9 pr-3 py-2 w-64 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>

        {statementPayments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-700 text-xs">No payments found</p>
            <p className="text-[11px] mt-0.5">Try another period or clear the search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Rent Period</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statementPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatLongDate(p.date)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">{p.receiptNumber}</td>
                    <td className="py-3 px-4">{p.accountingPeriod}</td>
                    <td className="py-3 px-4 text-slate-600">{p.paymentMethod}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">{formatMoney(p.amount, p.currency)}</td>
                    <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${p.remainingBalance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {formatMoney(Math.max(0, p.remainingBalance), p.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'Paid' ? 'bg-emerald-50 text-emerald-700'
                          : p.status === 'Partially Paid' ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectReceiptForPrint?.(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-bold cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isPrinting && <PrintPortal>{printDocument}</PrintPortal>}
    </div>
  );
};
