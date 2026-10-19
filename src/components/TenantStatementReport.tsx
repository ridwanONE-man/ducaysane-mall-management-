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
  CalendarCheck,
  AlertTriangle,
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
import {
  MONTH_NAMES,
  LedgerMonth,
  LedgerStatus,
  RentLedger,
  buildRentLedger,
  paymentRentMonths,
  monthKey,
  summarizeLedger,
} from '../utils/rentLedger';
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
type LedgerFilter = 'all' | 'paid' | 'owing';

const tenantKey = (name: string, unitNumber: string) =>
  `${normalizeName(name)}|${normalizeUnitNumber(unitNumber)}`;

const paymentBelongsTo = (p: PaymentRecord, tenant: TenantEntry) =>
  tenantKey(p.tenantName, p.unitNumber) === tenant.key;

const sumBy = (list: PaymentRecord[], currency: 'USD' | 'SSP') =>
  list.filter(p => p.currency === currency).reduce((s, p) => s + p.amount, 0);

const sortByDateDesc = (list: PaymentRecord[]) =>
  [...list].sort((a, b) => (parsePaymentDate(b.date)?.getTime() || 0) - (parsePaymentDate(a.date)?.getTime() || 0));

// Rent and currency come from the unit; former tenants fall back to their last receipt.
function ledgerForTenant(tenant: TenantEntry, list: PaymentRecord[]): RentLedger {
  const latest = sortByDateDesc(list)[0];
  const rentUSD = tenant.unit?.monthlyRateUSD || 0;
  const rentSSP = tenant.unit?.monthlyRateSSP || 0;
  let currency: 'USD' | 'SSP' = 'USD';
  let monthlyRent = rentUSD;
  if (rentUSD <= 0 && rentSSP > 0) {
    currency = 'SSP';
    monthlyRent = rentSSP;
  } else if (rentUSD <= 0) {
    currency = latest?.currency || 'USD';
    monthlyRent = latest?.monthlyBaseRent || 0;
  }
  return buildRentLedger({
    payments: list,
    monthlyRent,
    currency,
    leaseStart: tenant.unit?.leaseStart,
    leaseEnd: tenant.unit?.leaseEnd,
    isCurrent: tenant.isCurrent,
  });
}

const STATUS_STYLES: Record<LedgerStatus, string> = {
  Paid: 'bg-emerald-50 text-emerald-700',
  Partial: 'bg-amber-50 text-amber-700',
  Unpaid: 'bg-rose-50 text-rose-700',
};

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
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [dbPayments, setDbPayments] = useState<PaymentRecord[] | null>(null);
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'synced' | 'offline'>('idle');
  // null = not printing; keys = only those rent months; 'period' = everything in the current period
  const [printRequest, setPrintRequest] = useState<{ keys: string[] | 'period' } | null>(null);
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
    setSelectedMonths(new Set());
    latestRequestKey.current = null;
    if (selectedTenant) loadTenantFromDb(selectedTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Year / month filters use the rent month a payment covers; custom dates use the payment date.
  const isMonthInPeriod = (y: number, m: number) => {
    if (periodMode === 'all') return true;
    if (periodMode === 'year') return y === year;
    if (periodMode === 'month') return y === year && m === month;
    const from = parsePaymentDate(fromDate);
    const to = parsePaymentDate(toDate);
    if (from && new Date(y, m + 1, 0) < from) return false;
    if (to && new Date(y, m, 1) > to) return false;
    return true;
  };

  const isPaymentInPeriod = (p: PaymentRecord) => {
    if (periodMode === 'all') return true;
    if (periodMode === 'range') {
      const d = parsePaymentDate(p.date);
      if (!d) return false;
      const from = parsePaymentDate(fromDate);
      const to = parsePaymentDate(toDate);
      return !(from && d < from) && !(to && d > to);
    }
    return paymentRentMonths(p).some(({ year: y, month: m }) => isMonthInPeriod(y, m));
  };

  const matchesSearch = (p: PaymentRecord) => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return true;
    return [p.receiptNumber, p.accountingPeriod, p.paymentMethod, p.notes, p.date, p.status, p.receivedBy]
      .some(v => (v || '').toLowerCase().includes(q));
  };

  // Database rows win; locally cached rows that haven't synced yet are kept too.
  const tenantAllPayments = useMemo(() => {
    if (!selectedTenant) return [];
    const local = payments.filter(p => paymentBelongsTo(p, selectedTenant));
    if (!dbPayments) return local;
    const dbIds = new Set(dbPayments.map(p => p.id));
    return [...dbPayments, ...local.filter(p => !dbIds.has(p.id))];
  }, [selectedTenant, payments, dbPayments]);

  const ledger = useMemo(
    () => (selectedTenant ? ledgerForTenant(selectedTenant, tenantAllPayments) : null),
    [selectedTenant, tenantAllPayments]
  );

  const periodMonths = (ledger?.months || []).filter(m => isMonthInPeriod(m.year, m.month));
  const ledgerSummary = summarizeLedger(periodMonths);
  const visibleMonths = [...periodMonths]
    .filter(m => ledgerFilter === 'all' || (ledgerFilter === 'paid' ? m.paid > 0 : m.status !== 'Paid'))
    .reverse();

  const statementPayments = sortByDateDesc(tenantAllPayments.filter(p => isPaymentInPeriod(p) && matchesSearch(p)));

  const periodLabel =
    periodMode === 'all' ? 'All Time'
    : periodMode === 'year' ? `Year ${year}`
    : periodMode === 'month' ? `${MONTH_NAMES[month]} ${year}`
    : `${fromDate ? formatLongDate(fromDate) : 'Beginning'} – ${toDate ? formatLongDate(toDate) : 'Today'}`;

  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    payments.forEach(p => paymentRentMonths(p).forEach(m => years.add(m.year)));
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
        const all = payments.filter(p => paymentBelongsTo(p, t));
        const inPeriod = all.filter(isPaymentInPeriod);
        const tLedger = ledgerForTenant(t, all);
        const tSummary = summarizeLedger(tLedger.months.filter(m => isMonthInPeriod(m.year, m.month)));
        return {
          tenant: t,
          count: inPeriod.length,
          paidUSD: sumBy(inPeriod, 'USD'),
          paidSSP: sumBy(inPeriod, 'SSP'),
          lastDate: sortByDateDesc(inPeriod)[0]?.date,
          unpaidMonths: tSummary.unpaidCount + tSummary.partialCount,
          balance: tSummary.outstanding,
          currency: tLedger.currency,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, payments, tenantSearch, periodMode, year, month, fromDate, toDate]);

  const deposit = selectedTenant
    ? deposits.find(d => tenantKey(d.tenantName, d.unitNumber) === selectedTenant.key && d.status !== 'Refunded')
    : undefined;

  const toggleMonth = (key: string) => {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const openMonth = (m: LedgerMonth) => {
    setPeriodMode('month');
    setYear(m.year);
    setMonth(m.month);
  };

  // Print only once the print copy has been rendered into the portal.
  useEffect(() => {
    if (!printRequest) return;
    const timer = setTimeout(() => {
      window.print();
      setPrintRequest(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [printRequest]);

  // What goes on the printed statement.
  const printMonths: LedgerMonth[] = !printRequest || printRequest.keys === 'period'
    ? periodMonths
    : (ledger?.months || []).filter(m => (printRequest.keys as string[]).includes(m.key));
  const printMonthKeys = new Set(printMonths.map(m => m.key));
  const printPayments = !printRequest || printRequest.keys === 'period'
    ? statementPayments
    : sortByDateDesc(tenantAllPayments.filter(p =>
        paymentRentMonths(p).some(({ year: y, month: m }) => printMonthKeys.has(monthKey(y, m)))
      ));
  const printSummary = summarizeLedger(printMonths);
  const printLabel = !printRequest || printRequest.keys === 'period'
    ? periodLabel
    : printMonths.length === 1
      ? printMonths[0].label
      : `${printMonths.length} selected months (${printMonths[0]?.label || ''} – ${printMonths[printMonths.length - 1]?.label || ''})`;

  const statementNumber = `STM-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
    selectedTenant ? normalizeUnitNumber(selectedTenant.unitNumber).toUpperCase() : 'ALL'
  }`;

  const ledgerMoney = (n: number) => formatMoney(n, ledger?.currency || 'USD');

  // ---------------------------------------------------------------
  // Filters bar
  // ---------------------------------------------------------------
  const filters = (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
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
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
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
            <p className="text-xs text-slate-500 mt-0.5">Period: <strong className="text-slate-900">{printLabel}</strong></p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p className="font-mono font-black text-rose-700 text-sm">{statementNumber}</p>
            <p className="text-slate-500">Issued: <strong className="text-slate-900">{formatLongDate(now)}</strong></p>
          </div>
        </div>

        {selectedTenant && ledger ? (
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
                  <div className="flex justify-between"><span className="text-slate-500">Floor / Type</span><strong>{selectedTenant.unit.floor} • {selectedTenant.unit.type}</strong></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Monthly Rent</span><strong>{ledgerMoney(ledger.monthlyRent)}</strong></div>
                {selectedTenant.unit?.leaseStart && (
                  <div className="flex justify-between"><span className="text-slate-500">Lease</span><strong>{formatLongDate(selectedTenant.unit.leaseStart)} → {formatLongDate(selectedTenant.unit.leaseEnd) || 'Open'}</strong></div>
                )}
                {deposit && (
                  <div className="flex justify-between"><span className="text-slate-500">Security Deposit</span><strong>{formatMoney(deposit.amountUSD, 'USD')}</strong></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Status</span><strong>{selectedTenant.isCurrent ? 'Active Tenant' : 'Former Tenant'}</strong></div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 print-avoid-break">
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Rent Due</p>
                <p className="font-mono text-base font-black">{ledgerMoney(printSummary.totalDue)}</p>
              </div>
              <div className="rounded-2xl border-2 border-slate-900 bg-emerald-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Total Paid</p>
                <p className="font-mono text-base font-black text-emerald-700">{ledgerMoney(printSummary.totalPaid)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Months Not Paid</p>
                <p className="text-base font-black text-rose-600">
                  {printSummary.unpaidCount}
                  {printSummary.partialCount > 0 && <span className="text-xs text-amber-600"> + {printSummary.partialCount} partial</span>}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Balance Due</p>
                <p className={`font-mono text-base font-black ${printSummary.outstanding > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {ledgerMoney(printSummary.outstanding)}
                </p>
                {printSummary.credit > 0 && <p className="text-[10px] font-bold text-blue-700">Credit {ledgerMoney(printSummary.credit)}</p>}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">Monthly Rent Ledger</h3>
              <table className="w-full text-[11px] border border-slate-200">
                <thead>
                  <tr className="bg-slate-900 text-white text-left">
                    <th className="py-2 px-2.5">Rent Month</th>
                    <th className="py-2 px-2.5 text-right">Rent Due</th>
                    <th className="py-2 px-2.5 text-right">Paid</th>
                    <th className="py-2 px-2.5 text-right">Balance</th>
                    <th className="py-2 px-2.5 text-right">Running Balance</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5">Receipts</th>
                  </tr>
                </thead>
                <tbody>
                  {printMonths.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">No rent months in this period.</td></tr>
                  ) : printMonths.map((m, i) => (
                    <tr key={m.key} className={`print-avoid-break ${i % 2 ? 'bg-slate-50' : ''}`}>
                      <td className="py-1.5 px-2.5 font-bold">{m.label}</td>
                      <td className="py-1.5 px-2.5 text-right font-mono">{ledgerMoney(m.due)}</td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-700">{ledgerMoney(m.paid)}</td>
                      <td className={`py-1.5 px-2.5 text-right font-mono ${m.balance > 0 ? 'text-rose-600 font-bold' : ''}`}>{ledgerMoney(Math.max(0, m.balance))}</td>
                      <td className={`py-1.5 px-2.5 text-right font-mono ${m.running > 0 ? 'text-rose-600' : ''}`}>{ledgerMoney(m.running)}</td>
                      <td className={`py-1.5 px-2.5 font-bold ${m.status === 'Paid' ? 'text-emerald-700' : m.status === 'Partial' ? 'text-amber-600' : 'text-rose-600'}`}>{m.status}</td>
                      <td className="py-1.5 px-2.5 font-mono text-[10px]">{m.payments.map(p => p.receiptNumber).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {printPayments.length > 0 && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">Payment Receipts</h3>
                <table className="w-full text-[11px] border border-slate-200">
                  <thead>
                    <tr className="bg-slate-900 text-white text-left">
                      <th className="py-2 px-2.5">Date Paid</th>
                      <th className="py-2 px-2.5">Receipt #</th>
                      <th className="py-2 px-2.5">Rent Period</th>
                      <th className="py-2 px-2.5">Method</th>
                      <th className="py-2 px-2.5 text-right">Amount</th>
                      <th className="py-2 px-2.5">Received By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printPayments.map((p, i) => (
                      <tr key={p.id} className={`print-avoid-break ${i % 2 ? 'bg-slate-50' : ''}`}>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{formatLongDate(p.date)}</td>
                        <td className="py-1.5 px-2.5 font-mono">{p.receiptNumber}</td>
                        <td className="py-1.5 px-2.5">{p.accountingPeriod}</td>
                        <td className="py-1.5 px-2.5">{p.paymentMethod}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold">{formatMoney(p.amount, p.currency)}</td>
                        <td className="py-1.5 px-2.5">{p.receivedBy || BUSINESS_PROFILE.managerName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                <th className="py-2 px-2.5 text-right">Months Not Paid</th>
                <th className="py-2 px-2.5 text-right">Balance Due</th>
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
                  <td className={`py-1.5 px-2.5 text-right font-bold ${row.unpaidMonths ? 'text-rose-600' : ''}`}>{row.unpaidMonths}</td>
                  <td className={`py-1.5 px-2.5 text-right font-mono font-bold ${row.balance > 0 ? 'text-rose-600' : ''}`}>{formatMoney(row.balance, row.currency)}</td>
                </tr>
              ))}
            </tbody>
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

  // ---------------------------------------------------------------
  // Screen: all tenants overview
  // ---------------------------------------------------------------
  if (!selectedTenant || !ledger) {
    return (
      <div className="space-y-5 animate-in fade-in">
        {filters}

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Select a Tenant
              </h4>
              <p className="text-[11px] text-slate-500">Click any tenant to see paid and unpaid months, balance and receipts.</p>
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
              <button
                type="button"
                onClick={() => setPrintRequest({ keys: 'period' })}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-orange-500/20 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Summary</span>
              </button>
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
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Months Not Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4">Last Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenantOverview.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-400">No tenants match your search.</td></tr>
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
                    <td className="py-3 px-4 text-right">
                      {row.unpaidMonths > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
                          {row.unpaidMonths} month{row.unpaidMonths > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600">All paid</span>
                      )}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${row.balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {formatMoney(row.balance, row.currency)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{row.lastDate ? formatLongDate(row.lastDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {printRequest && <PrintPortal>{printDocument}</PrintPortal>}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Screen: single tenant statement
  // ---------------------------------------------------------------
  const contact = selectedTenant.unit?.currentTenant;
  const paidMonthKeys = periodMonths.filter(m => m.paid > 0).map(m => m.key);
  const allVisibleSelected = visibleMonths.length > 0 && visibleMonths.every(m => selectedMonths.has(m.key));

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

        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => setPrintRequest({ keys: 'period' })}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-orange-500/20 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {filters}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Total Paid</span>
          <span className="text-2xl font-black text-emerald-600">{ledgerMoney(ledgerSummary.totalPaid)}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {ledgerSummary.paidCount} month{ledgerSummary.paidCount === 1 ? '' : 's'} paid • {periodLabel}
          </span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Months Not Paid</span>
          <span className={`text-2xl font-black ${ledgerSummary.unpaidCount ? 'text-rose-600' : 'text-slate-900'}`}>
            {ledgerSummary.unpaidCount}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {ledgerSummary.partialCount > 0 ? `+ ${ledgerSummary.partialCount} partially paid` : 'No partial months'}
          </span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Monthly Rent</span>
          <span className="text-2xl font-black text-blue-600">{ledgerMoney(ledger.monthlyRent)}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Rent due in period: {ledgerMoney(ledgerSummary.totalDue)}
          </span>
        </div>
        <div className={`rounded-2xl p-5 border shadow-2xs ${ledgerSummary.outstanding > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200/80'}`}>
          <span className="text-xs font-medium text-slate-500 block">Balance Due</span>
          <span className={`text-2xl font-black ${ledgerSummary.outstanding > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {ledgerMoney(ledgerSummary.outstanding)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {ledgerSummary.credit > 0 ? `In credit: ${ledgerMoney(ledgerSummary.credit)}` : `As at end of ${periodMonths[periodMonths.length - 1]?.label || 'period'}`}
          </span>
        </div>
      </div>

      {/* Monthly rent ledger */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" /> Monthly Rent Ledger
            </h4>
            <p className="text-[11px] text-slate-500">
              Each month of the tenancy with rent due, amount paid and running balance. Tick months to print them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', 'All Months'],
              ['paid', 'Paid Months'],
              ['owing', 'Not Paid / Partial'],
            ] as [LedgerFilter, string][]).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setLedgerFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                  ledgerFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={paidMonthKeys.length === 0}
              onClick={() => setPrintRequest({ keys: paidMonthKeys })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Paid Months
            </button>
            <button
              type="button"
              disabled={selectedMonths.size === 0}
              onClick={() => setPrintRequest({ keys: [...selectedMonths] })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Selected ({selectedMonths.size})
            </button>
          </div>
        </div>

        {ledger.monthlyRent <= 0 && (
          <div className="px-4 py-2.5 bg-amber-50 text-amber-800 text-[11px] font-semibold flex items-center gap-2 border-b border-amber-100">
            <AlertTriangle className="w-3.5 h-3.5" /> No monthly rent is set for this unit, so unpaid months and balance can't be calculated.
          </div>
        )}

        {visibleMonths.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">No rent months in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => setSelectedMonths(prev => {
                        const next = new Set(prev);
                        visibleMonths.forEach(m => allVisibleSelected ? next.delete(m.key) : next.add(m.key));
                        return next;
                      })}
                      className="accent-orange-500 cursor-pointer"
                      title="Select all shown months"
                    />
                  </th>
                  <th className="py-3 px-4">Rent Month</th>
                  <th className="py-3 px-4 text-right">Rent Due</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Receipts</th>
                  <th className="py-3 px-4 text-right">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleMonths.map(m => (
                  <tr
                    key={m.key}
                    className={`${selectedMonths.has(m.key) ? 'bg-orange-50/60' : m.status === 'Unpaid' ? 'bg-rose-50/30' : ''} hover:bg-slate-50`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedMonths.has(m.key)}
                        onChange={() => toggleMonth(m.key)}
                        className="accent-orange-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openMonth(m)}
                        className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer"
                        title="Show only this month"
                      >
                        {m.label}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{ledgerMoney(m.due)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{ledgerMoney(m.paid)}</td>
                    <td className={`py-3 px-4 text-right font-mono ${m.balance > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {ledgerMoney(Math.max(0, m.balance))}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${m.running > 0 ? 'text-rose-600' : m.running < 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                      {m.running < 0 ? `${ledgerMoney(-m.running)} CR` : ledgerMoney(m.running)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[m.status]}`}>
                        {m.status === 'Unpaid' ? 'Not Paid' : m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {m.payments.length === 0 ? <span className="text-slate-300">—</span> : m.payments.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onSelectReceiptForPrint?.(p)}
                            className="font-mono text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                            title="Open and print this receipt"
                          >
                            {p.receiptNumber}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setPrintRequest({ keys: [m.key] })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                        title={`Print statement for ${m.label}`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" /> Payment Receipts
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
                  <th className="py-3 px-4">Date Paid</th>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Rent Period</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
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

      {printRequest && <PrintPortal>{printDocument}</PrintPortal>}
    </div>
  );
};
