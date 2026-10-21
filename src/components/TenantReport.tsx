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
  ArrowLeft,
  Phone,
  Store,
  X,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  ShieldCheck,
  Wallet,
  ChevronRight,
  Eye,
  CalendarRange,
} from 'lucide-react';
import { PropertyUnit, PaymentRecord, DepositRecord } from '../types';
import { getTenantPaymentsFromSupabase } from '../lib/supabaseService';
import { parsePaymentDate, formatLongDate, formatMoney, normalizeName, normalizeUnitNumber } from '../utils/printUtils';
import { MONTH_NAMES, LedgerMonth, LedgerStatus, RentLedger, buildRentLedger, paymentRentMonths, summarizeLedger } from '../utils/rentLedger';
import { depositMonthLabels, isCreditDeposit } from '../utils/tenantAccount';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import { PrintPortal } from './PrintPortal';
import { DeleteButton } from './DeleteControls';
import {
  DepositVoucher,
  DEPOSIT_RECEIVED_BY,
  depositDateLabel,
  depositMoney,
  depositMonthCount,
  findDepositUnit,
  formatDepositAmount,
  parseDepositDate,
} from './DepositVoucher';
import logoImg from '../assets/logo.png';

interface TenantReportProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
  deposits: DepositRecord[];
  onSelectReceiptForPrint?: (payment: PaymentRecord) => void;
  onDeletePayment?: (payment: PaymentRecord) => void;
}

interface TenantEntry {
  key: string;
  name: string;
  unitNumber: string;
  unit?: PropertyUnit;
  isCurrent: boolean;
}

type PeriodMode = 'all' | 'month' | 'year' | 'range';
type ListFilter = 'all' | 'owing' | 'paid';

const tenantKey = (name: string, unitNumber: string) => `${normalizeName(name)}|${normalizeUnitNumber(unitNumber)}`;
const shortLabel = (m: { year: number; month: number }) => `${MONTH_NAMES[m.month].slice(0, 3)} ${m.year}`;
const sortByDateDesc = (list: PaymentRecord[]) =>
  [...list].sort((a, b) => (parsePaymentDate(b.date)?.getTime() || 0) - (parsePaymentDate(a.date)?.getTime() || 0));
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Rent and currency come from the unit; former tenants fall back to their last receipt.
function ledgerFor(tenant: TenantEntry, list: PaymentRecord[]): RentLedger {
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

// Month tile colours: paid / partly paid / not paid
const MONTH_STYLE: Record<LedgerStatus, { tile: string; dot: string; label: string }> = {
  Paid: { tile: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', label: 'Paid' },
  Partial: { tile: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-400', label: 'Partial' },
  Unpaid: { tile: 'bg-rose-50 border-rose-200 text-rose-700', dot: 'bg-rose-500', label: 'Not paid' },
};

const Avatar: React.FC<{ name: string; size?: string }> = ({ name, size = 'w-11 h-11 text-base' }) => (
  <span className={`${size} shrink-0 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white font-black flex items-center justify-center shadow-sm shadow-orange-500/25`}>
    {name.trim().charAt(0).toUpperCase() || '?'}
  </span>
);

export const TenantReport: React.FC<TenantReportProps> = ({ units, payments, deposits, onSelectReceiptForPrint, onDeletePayment }) => {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [fromDate, setFromDate] = useState(toISO(new Date(now.getFullYear(), 0, 1)));
  const [toDate, setToDate] = useState(toISO(now));
  const [dbPayments, setDbPayments] = useState<PaymentRecord[] | null>(null);
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'synced' | 'offline'>('idle');
  const [viewingDeposit, setViewingDeposit] = useState<DepositRecord | null>(null);
  const [printing, setPrinting] = useState<'report' | DepositRecord | null>(null);
  const latestRequest = useRef<string | null>(null);

  // Current tenants, plus former tenants who still have payments or deposits on file
  const tenants = useMemo<TenantEntry[]>(() => {
    const map = new Map<string, TenantEntry>();
    units.forEach(u => {
      if (!u.currentTenant?.name) return;
      const key = tenantKey(u.currentTenant.name, u.unitNumber);
      map.set(key, { key, name: u.currentTenant.name, unitNumber: u.unitNumber, unit: u, isCurrent: true });
    });
    [...payments.map(p => ({ name: p.tenantName, unit: p.unitNumber })), ...deposits.map(d => ({ name: d.tenantName, unit: d.unitNumber }))]
      .forEach(({ name, unit }) => {
        if (!name) return;
        const key = tenantKey(name, unit);
        if (!map.has(key)) map.set(key, { key, name, unitNumber: unit, isCurrent: false });
      });
    return [...map.values()].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || a.name.localeCompare(b.name));
  }, [units, payments, deposits]);

  const selected = tenants.find(t => t.key === selectedKey) || null;

  // Fresh history for the opened tenant straight from the database
  const loadFromDb = async (tenant: TenantEntry) => {
    latestRequest.current = tenant.key;
    setDbStatus('loading');
    const rows = await getTenantPaymentsFromSupabase(tenant.name);
    if (latestRequest.current !== tenant.key) return;
    if (rows === null) {
      setDbPayments(null);
      setDbStatus('offline');
    } else {
      setDbPayments(rows.filter(p => tenantKey(p.tenantName, p.unitNumber) === tenant.key));
      setDbStatus('synced');
    }
  };

  useEffect(() => {
    setDbPayments(null);
    setDbStatus('idle');
    latestRequest.current = null;
    if (selected) loadFromDb(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // ----- Period -----
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
    if (periodMode === 'range') {
      const d = parsePaymentDate(p.date);
      const from = parsePaymentDate(fromDate);
      const to = parsePaymentDate(toDate);
      return Boolean(d) && !(from && d! < from) && !(to && d! > to);
    }
    return periodMode === 'all' || paymentRentMonths(p).some(({ year: y, month: m }) => isMonthInPeriod(y, m));
  };
  const isDepositInPeriod = (d: DepositRecord) => {
    if (periodMode === 'all') return true;
    const dt = parseDepositDate(d.heldSince);
    if (periodMode === 'range') {
      const from = parsePaymentDate(fromDate);
      const to = parsePaymentDate(toDate);
      return Boolean(dt) && !(from && dt! < from) && !(to && dt! > to);
    }
    return (dt ? isMonthInPeriod(dt.getFullYear(), dt.getMonth()) : false)
      || depositMonthLabels(d).some(l => MONTH_NAMES.some((n, i) => l === `${n.slice(0, 3)} ${l.slice(-4)}` && isMonthInPeriod(Number(l.slice(-4)), i)));
  };
  const periodLabel = periodMode === 'all' ? 'All time'
    : periodMode === 'year' ? `Year ${year}`
    : periodMode === 'month' ? `${MONTH_NAMES[month]} ${year}`
    : `${formatLongDate(fromDate)} – ${formatLongDate(toDate)}`;

  const availableYears = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    payments.forEach(p => paymentRentMonths(p).forEach(m => ys.add(m.year)));
    deposits.forEach(d => { const dt = parseDepositDate(d.heldSince); if (dt) ys.add(dt.getFullYear()); });
    return [...ys].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, deposits]);

  // ----- Tenant list -----
  const overview = useMemo(() => tenants.map(t => {
    const own = payments.filter(p => tenantKey(p.tenantName, p.unitNumber) === t.key);
    const ledger = ledgerFor(t, own);
    const summary = summarizeLedger(ledger.months);
    const recent = ledger.months.filter(m => m.key <= todayKey).slice(-6);
    const held = deposits
      .filter(d => tenantKey(d.tenantName, d.unitNumber) === t.key && d.status !== 'Refunded' && !isCreditDeposit(d));
    return { tenant: t, ledger, summary, recent, held };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tenants, payments, deposits]);

  const q = search.trim().toLowerCase();
  const shownOverview = overview.filter(o => {
    if (listFilter === 'owing' && o.summary.outstanding <= 0) return false;
    if (listFilter === 'paid' && o.summary.outstanding > 0) return false;
    return !q || [o.tenant.name, o.tenant.unitNumber, o.tenant.unit?.currentTenant?.phone, o.tenant.unit?.currentTenant?.code]
      .some(v => (v || '').toLowerCase().includes(q));
  });
  const owingCount = overview.filter(o => o.summary.outstanding > 0).length;

  // ----- Selected tenant -----
  const tenantPayments = useMemo(() => {
    if (!selected) return [];
    const local = payments.filter(p => tenantKey(p.tenantName, p.unitNumber) === selected.key);
    if (!dbPayments) return local;
    const ids = new Set(dbPayments.map(p => p.id));
    return [...dbPayments, ...local.filter(p => !ids.has(p.id))];
  }, [selected, payments, dbPayments]);

  const ledger = useMemo(() => (selected ? ledgerFor(selected, tenantPayments) : null), [selected, tenantPayments]);
  const money = (n: number) => formatMoney(n, ledger?.currency || 'USD');

  const tenantDeposits = selected ? deposits.filter(d => tenantKey(d.tenantName, d.unitNumber) === selected.key) : [];
  const depositCovered = new Set(tenantDeposits.filter(d => d.status !== 'Refunded').flatMap(depositMonthLabels));

  const periodMonths = (ledger?.months || []).filter(m => isMonthInPeriod(m.year, m.month));
  const summary = summarizeLedger(periodMonths);
  const periodPayments = sortByDateDesc(tenantPayments.filter(isPaymentInPeriod));
  const periodDeposits = tenantDeposits
    .filter(isDepositInPeriod)
    .sort((a, b) => (parseDepositDate(b.heldSince)?.getTime() || 0) - (parseDepositDate(a.heldSince)?.getTime() || 0));
  const securityHeld = tenantDeposits.filter(d => d.status !== 'Refunded' && !isCreditDeposit(d));
  const creditHeld = tenantDeposits.filter(d => d.status !== 'Refunded' && isCreditDeposit(d)).reduce((s, d) => s + d.amountUSD, 0);
  const depositMonthsInPeriod = periodMonths.filter(m => depositCovered.has(shortLabel(m))).length;
  const heldText = (list: DepositRecord[]) => {
    const usd = list.reduce((s, d) => { const m = depositMoney(d); return m.currency === 'USD' ? s + m.value : s; }, 0);
    const ssp = list.reduce((s, d) => { const m = depositMoney(d); return m.currency === 'SSP' ? s + m.value : s; }, 0);
    return usd || !ssp ? `${formatMoney(usd, 'USD')}${ssp ? ` + ${formatMoney(ssp, 'SSP')}` : ''}` : formatMoney(ssp, 'SSP');
  };

  // Print once the copy is in the portal
  useEffect(() => {
    if (!printing) return;
    const timer = setTimeout(() => { window.print(); setPrinting(null); }, 120);
    return () => clearTimeout(timer);
  }, [printing]);

  const reportNumber = selected
    ? `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${normalizeUnitNumber(selected.unitNumber).toUpperCase()}`
    : '';

  const selectCls = 'px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500';

  // ================================================================
  // Period bar
  // ================================================================
  const periodBar = (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700"><CalendarRange className="w-4 h-4 text-orange-500" /> Show</span>
      <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
        {([['all', 'All'], ['month', 'Month'], ['year', 'Year'], ['range', 'Custom']] as [PeriodMode, string][]).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setPeriodMode(m)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              periodMode === m ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
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
      {periodMode === 'range' && (
        <span className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={selectCls} />
          <span className="text-xs font-bold text-slate-400">to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={selectCls} />
        </span>
      )}
      <span className="ml-auto px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold">{periodLabel}</span>
    </div>
  );

  // ================================================================
  // Printed report — side-panel layout, unlike receipts and deposit vouchers
  // ================================================================
  const printReport = selected && ledger && (
    <div className="bg-white text-slate-900 font-sans">
      <div className="grid grid-cols-[190px_1fr] min-h-[270mm]">
        {/* Side panel */}
        <aside className="bg-slate-900 text-white px-5 py-7 flex flex-col">
          <div className="w-20 h-20 rounded-2xl bg-white p-1.5 mx-auto flex items-center justify-center">
            <img src={logoImg} alt={BUSINESS_PROFILE.name} className="w-full h-full object-contain" />
          </div>
          <p className="mt-3 text-center font-['Playfair_Display',serif] text-sm font-extrabold uppercase leading-tight">{BUSINESS_PROFILE.name}</p>
          <p className="text-center text-[8px] font-bold uppercase tracking-[0.2em] text-orange-300 mt-1">{BUSINESS_PROFILE.tagline}</p>
          <div className="h-0.5 bg-gradient-to-r from-orange-500 to-amber-400 my-4" />

          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-300">Tenant</p>
          <p className="text-sm font-extrabold leading-tight mt-0.5">{selected.name}</p>
          <div className="mt-2 space-y-1 text-[10px] text-slate-300">
            <p>Unit: <strong className="text-white">{selected.unitNumber}</strong></p>
            {selected.unit && <p>{selected.unit.floor} • {selected.unit.type}</p>}
            {selected.unit?.currentTenant?.phone && <p>Tel: {selected.unit.currentTenant.phone}</p>}
            {selected.unit?.leaseStart && <p>Lease: {formatLongDate(selected.unit.leaseStart)}{selected.unit.leaseEnd ? ` – ${formatLongDate(selected.unit.leaseEnd)}` : ''}</p>}
            <p>Rent: <strong className="text-white">{money(ledger.monthlyRent)}</strong> / month</p>
            <p>Status: {selected.isCurrent ? 'Current tenant' : 'Former tenant'}</p>
          </div>

          <div className="h-px bg-slate-700 my-4" />
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-300 mb-2">Summary</p>
          {[
            ['Months paid', String(summary.paidCount), 'text-emerald-300'],
            ['Partly paid', String(summary.partialCount), 'text-amber-300'],
            ['Not paid', String(summary.unpaidCount), 'text-rose-300'],
            ['Total paid', money(summary.totalPaid), 'text-white'],
            ['Deposit held', heldText(securityHeld), 'text-sky-300'],
          ].map(([k, v, tone]) => (
            <div key={k} className="flex justify-between gap-2 text-[10px] py-1 border-b border-slate-800">
              <span className="text-slate-400">{k}</span>
              <span className={`font-black ${tone}`}>{v}</span>
            </div>
          ))}
          <div className="mt-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 px-3 py-2.5">
            <span className="block text-[8px] font-black uppercase tracking-wider text-orange-50">Balance due</span>
            <span className="block text-lg font-black">{money(summary.outstanding)}</span>
          </div>

          <div className="mt-auto pt-6 text-[8px] text-slate-400 space-y-0.5">
            <p>{BUSINESS_PROFILE.address}</p>
            {BUSINESS_PROFILE.phones.map(p => <p key={p}>{p}</p>)}
            <p>{BUSINESS_PROFILE.email}</p>
          </div>
        </aside>

        {/* Main */}
        <main className="px-7 py-7 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-600">Tenant account</p>
              <h2 className="text-2xl font-black tracking-tight">RENT & DEPOSIT REPORT</h2>
              <p className="text-[11px] text-slate-500">Period: <strong className="text-slate-900">{periodLabel}</strong></p>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              <p className="font-mono text-sm font-black text-orange-600">{reportNumber}</p>
              <p>Issued {formatLongDate(now)}</p>
            </div>
          </div>

          {/* Month grid */}
          <section className="print-avoid-break">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Month by month</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {periodMonths.map(m => (
                <div key={m.key} className={`rounded-lg border px-2 py-1.5 ${MONTH_STYLE[m.status].tile}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black">{shortLabel(m)}</span>
                    {depositCovered.has(shortLabel(m)) && <ShieldCheck className="w-3 h-3 text-sky-600" />}
                  </div>
                  <span className="block text-[9px] font-bold">{MONTH_STYLE[m.status].label} • {money(m.paid)}</span>
                </div>
              ))}
              {periodMonths.length === 0 && <p className="col-span-4 text-[10px] text-slate-400">No rent months in this period.</p>}
            </div>
            <p className="mt-1.5 text-[9px] text-slate-500">
              Green = paid • Amber = partly paid • Red = not paid • <ShieldCheck className="inline w-2.5 h-2.5 text-sky-600" /> = covered by deposit
            </p>
          </section>

          {/* Payments */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Payments received ({periodPayments.length})</h3>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-y-2 border-slate-900 text-left uppercase tracking-wider">
                  <th className="py-1.5">Date</th><th className="py-1.5">Receipt</th><th className="py-1.5">For month</th><th className="py-1.5">Method</th><th className="py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {periodPayments.map(p => (
                  <tr key={p.id} className="border-b border-slate-200 print-avoid-break">
                    <td className="py-1.5">{formatLongDate(p.date)}</td>
                    <td className="py-1.5 font-mono font-bold">{p.receiptNumber}</td>
                    <td className="py-1.5">{p.accountingPeriod}</td>
                    <td className="py-1.5">{p.paymentMethod}</td>
                    <td className="py-1.5 text-right font-mono font-bold">{formatMoney(p.amount, p.currency)}</td>
                  </tr>
                ))}
                {periodPayments.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-400">No payments in this period.</td></tr>}
              </tbody>
            </table>
          </section>

          {/* Deposits */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Deposits ({periodDeposits.length})</h3>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-y-2 border-slate-900 text-left uppercase tracking-wider">
                  <th className="py-1.5">Date</th><th className="py-1.5">Voucher</th><th className="py-1.5">Covers</th><th className="py-1.5">Status</th><th className="py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {periodDeposits.map(d => (
                  <tr key={d.id} className="border-b border-slate-200 print-avoid-break">
                    <td className="py-1.5">{depositDateLabel(d.heldSince)}</td>
                    <td className="py-1.5 font-mono font-bold">{d.depositSlip || d.id}</td>
                    <td className="py-1.5">{isCreditDeposit(d) ? 'Advance credit' : depositMonthLabels(d).join(', ') || `${depositMonthCount(d) || '—'} month(s)`}</td>
                    <td className="py-1.5">{d.status === 'Held in Escrow' ? 'Held' : d.status}</td>
                    <td className="py-1.5 text-right font-mono font-bold">{formatDepositAmount(d)}</td>
                  </tr>
                ))}
                {periodDeposits.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-400">No deposits in this period.</td></tr>}
              </tbody>
            </table>
          </section>

          <div className="grid grid-cols-2 gap-10 pt-6 print-avoid-break">
            <div>
              <div className="h-10 border-b border-slate-500" />
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Tenant's signature</p>
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-slate-500" />
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Prepared by</p>
              <p className="text-[10px] font-bold">{DEPOSIT_RECEIVED_BY}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );

  // ================================================================
  // Tenant list
  // ================================================================
  if (!selected) {
    const totalOwed = overview.reduce((s, o) => s + (o.ledger.currency === 'USD' ? o.summary.outstanding : 0), 0);
    const totalPaid = payments.filter(p => p.currency === 'USD').reduce((s, p) => s + p.amount, 0);
    const totalHeld = deposits.filter(d => d.status !== 'Refunded' && !isCreditDeposit(d) && depositMoney(d).currency === 'USD').reduce((s, d) => s + d.amountUSD, 0);

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Tenants', value: String(tenants.length), icon: Users, tone: 'bg-orange-50 text-orange-600' },
            { label: 'Rent collected', value: formatMoney(totalPaid, 'USD'), icon: Wallet, tone: 'bg-emerald-50 text-emerald-600' },
            { label: 'Balance owed', value: formatMoney(totalOwed, 'USD'), icon: AlertTriangle, tone: 'bg-rose-50 text-rose-600' },
            { label: 'Deposits held', value: formatMoney(totalHeld, 'USD'), icon: ShieldCheck, tone: 'bg-sky-50 text-sky-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.tone}`}><s.icon className="w-5 h-5" /></span>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold text-slate-500">{s.label}</span>
                <span className="block text-lg font-black text-slate-900 truncate">{s.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold self-start">
            {([['all', `All (${overview.length})`], ['owing', `Owing (${owingCount})`], ['paid', `Paid up (${overview.length - owingCount})`]] as [ListFilter, string][]).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setListFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  listFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tenant name, unit or phone..."
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-100"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {shownOverview.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            {tenants.length === 0 ? 'No tenants yet.' : 'No tenant matches your search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shownOverview.map(({ tenant, ledger: l, summary: s, recent, held }) => (
              <button
                key={tenant.key}
                type="button"
                onClick={() => setSelectedKey(tenant.key)}
                className="group text-left bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-orange-300 hover:-translate-y-0.5 transition-all p-5 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={tenant.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-900 text-sm truncate">{tenant.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                        <Store className="w-3 h-3" /> {tenant.unitNumber}
                      </span>
                      {!tenant.isCurrent && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-bold">Former</span>}
                    </div>
                  </div>
                  {s.outstanding > 0 ? (
                    <span className="shrink-0 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 text-xs font-black">{formatMoney(s.outstanding, l.currency)}</span>
                  ) : (
                    <span className="shrink-0 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black">✓ Paid up</span>
                  )}
                </div>

                {/* Last months at a glance */}
                <div className="mt-4 flex items-end gap-1.5">
                  {recent.map(m => (
                    <div key={m.key} className="flex-1 text-center">
                      <div className={`h-2 rounded-full ${MONTH_STYLE[m.status].dot}`} />
                      <span className="block mt-1 text-[9px] font-bold text-slate-400">{MONTH_NAMES[m.month].slice(0, 3)}</span>
                    </div>
                  ))}
                  {recent.length === 0 && <span className="text-[10px] text-slate-400">No rent months yet</span>}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-3 text-slate-500">
                    <span><strong className="text-emerald-600">{s.paidCount}</strong> paid</span>
                    <span><strong className="text-rose-600">{s.unpaidCount + s.partialCount}</strong> owing</span>
                    {held.length > 0 && <span className="flex items-center gap-0.5 text-sky-700 font-bold"><ShieldCheck className="w-3 h-3" /> {heldText(held)}</span>}
                  </span>
                  <span className="flex items-center gap-0.5 font-bold text-orange-600 group-hover:gap-1.5 transition-all">
                    Report <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ================================================================
  // One tenant's report
  // ================================================================
  const tiles = [
    { label: 'Paid months', value: String(summary.paidCount), icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Partly paid', value: String(summary.partialCount), icon: CircleDashed, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Not paid', value: String(summary.unpaidCount), icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
    { label: 'Deposit months', value: String(depositMonthsInPeriod), icon: ShieldCheck, tone: 'text-sky-600 bg-sky-50' },
  ];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setSelectedKey(null)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All tenants
      </button>

      {/* Profile */}
      <div className="relative overflow-hidden bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-14 -top-14 w-52 h-52 rounded-full bg-orange-100/50" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Avatar name={selected.name} size="w-16 h-16 text-2xl" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 truncate">{selected.name}</h2>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${selected.isCurrent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {selected.isCurrent ? 'Current tenant' : 'Former tenant'}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 font-bold text-slate-700"><Store className="w-3.5 h-3.5 text-orange-500" /> {selected.unitNumber}</span>
                {selected.unit?.currentTenant?.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-orange-500" /> {selected.unit.currentTenant.phone}</span>}
                {selected.unit?.leaseStart && (
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-orange-500" />
                    {formatLongDate(selected.unit.leaseStart)}{selected.unit.leaseEnd ? ` – ${formatLongDate(selected.unit.leaseEnd)}` : ''}
                  </span>
                )}
                {ledger && <span>Rent <strong className="text-slate-800">{money(ledger.monthlyRent)}</strong>/month</span>}
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold">
                {dbStatus === 'loading' && <span className="text-slate-500 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Loading from database…</span>}
                {dbStatus === 'synced' && <span className="text-emerald-600 flex items-center gap-1"><Database className="w-3 h-3" /> Up to date with database</span>}
                {dbStatus === 'offline' && <span className="text-amber-600 flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline — showing saved data</span>}
                {dbStatus !== 'loading' && (
                  <button type="button" onClick={() => loadFromDb(selected)} className="ml-1 text-orange-600 hover:text-orange-800 cursor-pointer">Refresh</button>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl px-4 py-3 text-right ${summary.outstanding > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Balance</span>
              <span className={`block text-2xl font-black ${summary.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {summary.outstanding > 0 ? money(summary.outstanding) : 'Paid up'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPrinting('report')}
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-orange-500/25 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print report
            </button>
          </div>
        </div>
      </div>

      {periodBar}

      {/* Count tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex items-center gap-3">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.tone}`}><t.icon className="w-5 h-5" /></span>
            <div>
              <span className="block text-2xl font-black text-slate-900 leading-none">{t.value}</span>
              <span className="block text-[11px] font-semibold text-slate-500 mt-1">{t.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-extrabold text-slate-900">Rent months</h3>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
            {(['Paid', 'Partial', 'Unpaid'] as LedgerStatus[]).map(s => (
              <span key={s} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${MONTH_STYLE[s].dot}`} /> {MONTH_STYLE[s].label}</span>
            ))}
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-sky-600" /> Deposit</span>
          </div>
        </div>
        {periodMonths.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">No rent months in {periodLabel.toLowerCase()}.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
            {periodMonths.map((m: LedgerMonth) => {
              const style = MONTH_STYLE[m.status];
              const future = m.key > todayKey;
              const covered = depositCovered.has(shortLabel(m));
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { setPeriodMode('month'); setYear(m.year); setMonth(m.month); }}
                  title="Show only this month"
                  className={`relative text-left rounded-2xl border px-3 py-2.5 transition-all hover:shadow-md cursor-pointer ${style.tile} ${future && m.status === 'Unpaid' ? 'opacity-70 border-dashed' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black">{shortLabel(m)}</span>
                    {covered && <span className="p-0.5 rounded-md bg-sky-100" title="Covered by a deposit"><ShieldCheck className="w-3 h-3 text-sky-600" /></span>}
                  </div>
                  <span className="block text-[10px] font-bold mt-0.5">{future && m.status === 'Unpaid' ? 'Upcoming' : style.label}</span>
                  <span className="block text-[10px] opacity-80">{money(m.paid)} of {money(m.due)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Payments */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-600" /> Payments</h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{money(summary.totalPaid)} paid</span>
          </div>
          {periodPayments.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-400">No payments in {periodLabel.toLowerCase()}.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {periodPayments.map(p => (
                <li key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/70">
                  <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Receipt className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.accountingPeriod}</p>
                    <p className="text-[10px] text-slate-500 truncate">{formatLongDate(p.date)} • <span className="font-mono">{p.receiptNumber}</span> • {p.paymentMethod}</p>
                  </div>
                  <span className="text-sm font-black text-slate-900">{formatMoney(p.amount, p.currency)}</span>
                  {onSelectReceiptForPrint && (
                    <button type="button" onClick={() => onSelectReceiptForPrint(p)} title="Print receipt" className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 cursor-pointer">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDeletePayment && (
                    <DeleteButton
                      title="Delete payment"
                      onDelete={() => onDeletePayment(p)}
                      confirm={{ title: 'Delete this payment?', subject: `${p.receiptNumber} • ${formatMoney(p.amount, p.currency)}` }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Deposits */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-sky-600" /> Deposits</h3>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
              {heldText(securityHeld)} held{creditHeld > 0 ? ` • ${formatMoney(creditHeld, 'USD')} credit` : ''}
            </span>
          </div>
          {periodDeposits.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-400">No deposits in {periodLabel.toLowerCase()}.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {periodDeposits.map(d => {
                const credit = isCreditDeposit(d);
                const months = depositMonthLabels(d);
                return (
                  <li key={d.id} className={`px-5 py-3 flex items-center gap-3 hover:bg-slate-50/70 ${d.status === 'Refunded' ? 'opacity-60' : ''}`}>
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {credit ? 'Advance credit' : months.length ? months.join(', ') : `${depositMonthCount(d) || '—'} month(s) deposit`}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {depositDateLabel(d.heldSince)} • <span className="font-mono">{d.depositSlip || d.id}</span> • {d.status === 'Held in Escrow' ? 'Held' : d.status}
                      </p>
                    </div>
                    <span className="text-sm font-black text-slate-900">{formatDepositAmount(d)}</span>
                    <button type="button" onClick={() => setViewingDeposit(d)} title="View voucher" className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 cursor-pointer">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setPrinting(d)} title="Print voucher" className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 cursor-pointer">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Deposit voucher preview */}
      {viewingDeposit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto" onClick={() => setViewingDeposit(null)}>
          <div className="bg-slate-100 rounded-3xl max-w-3xl w-full shadow-2xl my-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-slate-200">
              <p className="text-sm font-extrabold text-slate-900 truncate">Voucher {viewingDeposit.depositSlip || viewingDeposit.id}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrinting(viewingDeposit)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button type="button" onClick={() => setViewingDeposit(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="rounded-xl shadow-lg overflow-hidden">
                <DepositVoucher deposit={viewingDeposit} unit={findDepositUnit(viewingDeposit, units)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {printing && (
        <PrintPortal>
          {printing === 'report'
            ? printReport
            : <DepositVoucher deposit={printing} unit={findDepositUnit(printing, units)} />}
        </PrintPortal>
      )}
    </div>
  );
};
