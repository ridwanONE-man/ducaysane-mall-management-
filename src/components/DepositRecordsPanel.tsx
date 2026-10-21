import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, FileText, Printer, Undo2, Users, X, ShieldCheck, ChevronRight, Eye, Wallet, RotateCcw, Layers } from 'lucide-react';
import { DepositRecord, PropertyUnit } from '../types';
import { DeleteButton } from './DeleteControls';
import { PrintPortal } from './PrintPortal';
import { DepositVoucher, DepositStatement, parseDepositDate, depositDateLabel, depositMoney, formatDepositAmount, depositMonthCount, findDepositUnit } from './DepositVoucher';
import { accountKey, depositMonthLabels, isAmountDeposit } from '../utils/tenantAccount';
import { MONTH_NAMES } from '../utils/rentLedger';
import { formatLongDate, formatMoney } from '../utils/printUtils';

interface DepositRecordsPanelProps {
  deposits: DepositRecord[];
  units?: PropertyUnit[];
  search: string;
  onRelease?: (deposit: DepositRecord) => void;
  onDelete?: (deposit: DepositRecord) => void;
}

type PeriodMode = 'all' | 'year' | 'month' | 'range';
type PrintJob = { kind: 'voucher'; deposit: DepositRecord } | { kind: 'statement' };

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const DepositRecordsPanel: React.FC<DepositRecordsPanelProps> = ({ deposits, units = [], search, onRelease, onDelete }) => {
  const now = new Date();
  const [tenantKey, setTenantKey] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [fromDate, setFromDate] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(toISO(now));
  const [viewing, setViewing] = useState<DepositRecord | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);

  // One bundle per tenant + unit, newest deposit first
  const tenants = useMemo(() => {
    const map = new Map<string, { key: string; name: string; unit: string; records: DepositRecord[]; held: number; heldSSP: number }>();
    deposits.forEach(d => {
      const key = accountKey(d.tenantName, d.unitNumber);
      const t = map.get(key) || { key, name: d.tenantName, unit: d.unitNumber, records: [], held: 0, heldSSP: 0 };
      t.records.push(d);
      if (d.status !== 'Refunded') {
        const m = depositMoney(d);
        if (m.currency === 'USD') t.held += m.value; else t.heldSSP += m.value;
      }
      map.set(key, t);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [deposits]);

  const q = search.trim().toLowerCase();
  const shownTenants = tenants.filter(t =>
    !q || [t.name, t.unit, ...t.records.map(r => r.depositSlip || '')].some(v => v.toLowerCase().includes(q))
  );
  const selected = tenants.find(t => t.key === tenantKey) || null;

  const availableYears = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    deposits.forEach(d => {
      const dt = parseDepositDate(d.heldSince);
      if (dt) ys.add(dt.getFullYear());
      depositMonthLabels(d).forEach(l => { const y = Number(l.slice(-4)); if (y) ys.add(y); });
    });
    return [...ys].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposits]);

  // Year/month match the date received or a month the deposit covers; custom dates use the date received.
  const inPeriod = (d: DepositRecord) => {
    if (periodMode === 'all') return true;
    const dt = parseDepositDate(d.heldSince);
    const labels = depositMonthLabels(d);
    if (periodMode === 'year') {
      return dt?.getFullYear() === year || labels.some(l => l.endsWith(String(year)));
    }
    if (periodMode === 'month') {
      const label = `${MONTH_NAMES[month].slice(0, 3)} ${year}`;
      return (dt?.getFullYear() === year && dt.getMonth() === month) || labels.includes(label);
    }
    if (!dt) return false;
    const from = parseDepositDate(fromDate);
    const to = parseDepositDate(toDate);
    return (!from || dt >= from) && (!to || dt <= to);
  };

  const periodLabel = periodMode === 'all' ? 'All time'
    : periodMode === 'year' ? `Year ${year}`
    : periodMode === 'month' ? `${MONTH_NAMES[month]} ${year}`
    : `${formatLongDate(fromDate)} – ${formatLongDate(toDate)}`;

  const base = selected ? selected.records : deposits.filter(d => shownTenants.some(t => t.key === accountKey(d.tenantName, d.unitNumber)));
  const records = base
    .filter(inPeriod)
    .sort((a, b) => (parseDepositDate(b.heldSince)?.getTime() || 0) - (parseDepositDate(a.heldSince)?.getTime() || 0));
  const sumBy = (list: DepositRecord[], cur: 'USD' | 'SSP') =>
    list.reduce((s, d) => { const m = depositMoney(d); return m.currency === cur ? s + m.value : s; }, 0);
  const heldList = records.filter(d => d.status !== 'Refunded');
  const refundedList = records.filter(d => d.status === 'Refunded');
  const totals = [
    { label: 'Currently held', usd: sumBy(heldList, 'USD'), ssp: sumBy(heldList, 'SSP'), icon: Wallet, tone: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700' },
    { label: 'Refunded', usd: sumBy(refundedList, 'USD'), ssp: sumBy(refundedList, 'SSP'), icon: RotateCcw, tone: 'bg-slate-100 text-slate-600', value: 'text-slate-700' },
  ];

  // Print once the copy is in the portal
  useEffect(() => {
    if (!printJob) return;
    const timer = setTimeout(() => {
      window.print();
      setPrintJob(null);
    }, 120);
    return () => clearTimeout(timer);
  }, [printJob]);

  const periodBtn = (mode: PeriodMode, label: string) => (
    <button
      key={mode}
      type="button"
      onClick={() => setPeriodMode(mode)}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
        periodMode === mode ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
  const selectCls = 'px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500';

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-bold text-slate-700 mr-1">Period:</span>
        {periodBtn('all', 'All')}
        {periodBtn('month', 'Month')}
        {periodBtn('year', 'Year')}
        {periodBtn('range', 'Custom')}
        {(periodMode === 'year' || periodMode === 'month') && (
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {periodMode === 'month' && (
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        )}
        {periodMode === 'range' && (
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={selectCls} />
            <span className="text-xs font-bold text-slate-400">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={selectCls} />
          </div>
        )}
        <span className="ml-auto text-[11px] font-semibold text-slate-500">{periodLabel}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
        {/* Tenant bundles */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 lg:sticky lg:top-4">
          <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Tenants ({shownTenants.length})</p>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setTenantKey(null)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl text-left text-xs cursor-pointer transition-colors ${
                !selected ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/25' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2 font-bold"><Users className="w-4 h-4" /> All tenants</span>
              <span className="font-black">{deposits.length}</span>
            </button>
            {shownTenants.length === 0 && (
              <p className="px-3 py-6 text-center text-[11px] text-slate-400">No tenant matches "{search}".</p>
            )}
            {shownTenants.map(t => {
              const active = selected?.key === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTenantKey(active ? null : t.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-left cursor-pointer transition-colors ${
                    active ? 'bg-orange-50 ring-2 ring-orange-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black ${active ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700'}`}>
                    {t.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-extrabold text-slate-900 truncate">{t.name}</span>
                    <span className="block text-[10px] text-slate-500">{t.unit} • {t.records.length} record{t.records.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="text-[11px] font-black text-orange-600 shrink-0">{t.heldSSP && !t.held ? formatMoney(t.heldSSP, 'SSP') : usd(t.held)}</span>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-orange-600' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Records */}
        <div className="space-y-3 min-w-0">
          <div className="relative overflow-hidden bg-white rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
            <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-orange-100/50" />
            <div className="relative p-5 flex flex-col xl:flex-row xl:items-center gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30 text-lg font-black">
                  {selected ? selected.name.trim().charAt(0).toUpperCase() : <Layers className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">{selected ? `Unit ${selected.unit}` : 'Deposit records'}</p>
                  <h3 className="text-xl font-black text-slate-900 truncate">{selected ? selected.name : 'All tenants'}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> {periodLabel}
                    <span className="px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700 font-bold">{records.length} record{records.length === 1 ? '' : 's'}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-stretch gap-2">
                {totals.map(t => (
                  <div key={t.label} className="min-w-[130px] rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span className={`p-1 rounded-md ${t.tone}`}><t.icon className="w-3 h-3" /></span> {t.label}
                    </span>
                    <span className={`block text-lg font-black mt-0.5 ${t.value}`}>{usd(t.usd)}</span>
                    {t.ssp > 0 && <span className="block text-[10px] font-bold text-slate-500">+ {formatMoney(t.ssp, 'SSP')}</span>}
                  </div>
                ))}
                <button
                  type="button"
                  disabled={records.length === 0}
                  onClick={() => setPrintJob({ kind: 'statement' })}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-sm shadow-orange-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" /> Print {selected ? 'statement' : 'list'}
                </button>
              </div>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No deposit records {periodMode === 'all' ? (q ? 'match your search' : 'yet') : `in ${periodLabel}`}.
            </div>
          ) : (
            <div className="space-y-2">
              {records.map(d => {
                const months = depositMonthLabels(d);
                return (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewing(d)}
                    onKeyDown={e => { if (e.key === 'Enter') setViewing(d); }}
                    className={`group bg-white rounded-2xl border border-slate-200/80 hover:border-orange-300 hover:shadow-md transition-all p-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer ${d.status === 'Refunded' ? 'opacity-70' : ''}`}
                  >
                    <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center bg-orange-100 text-orange-700`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-black text-orange-700">{d.depositSlip || d.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'Refunded' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {d.status === 'Held in Escrow' ? 'Held' : d.status}
                        </span>
                      </div>
                      {!selected && <p className="text-xs font-extrabold text-slate-900 mt-0.5 truncate">{d.tenantName} <span className="font-semibold text-slate-500">• {d.unitNumber}</span></p>}
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {depositDateLabel(d.heldSince)} • {months.length ? months.join(', ') : isAmountDeposit(d) ? 'Any amount — not for a month' : depositMonthCount(d) ? `${depositMonthCount(d)} month(s)` : 'Security deposit'}
                      </p>
                    </div>
                    <span className="text-base font-black text-slate-900 sm:w-32 sm:text-right">{formatDepositAmount(d)}</span>
                    <div className="flex items-center gap-1 sm:justify-end" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setViewing(d)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-bold cursor-pointer"
                        title="View voucher"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintJob({ kind: 'voucher', deposit: d })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                        title="Print voucher"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {d.status === 'Held in Escrow' && onRelease && (
                        <button
                          type="button"
                          onClick={() => onRelease(d)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 rounded-lg text-[11px] font-bold cursor-pointer"
                          title="Return the deposit to the tenant"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <DeleteButton
                          title="Delete deposit"
                          onDelete={() => onDelete(d)}
                          confirm={{ title: 'Delete this deposit?', subject: `${d.depositSlip || d.id} • ${d.tenantName} • ${formatDepositAmount(d)}` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Voucher preview */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto" onClick={() => setViewing(null)}>
          <div className="bg-slate-100 rounded-3xl max-w-3xl w-full shadow-2xl my-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-slate-200">
              <p className="text-sm font-extrabold text-slate-900 truncate">Voucher {viewing.depositSlip || viewing.id}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintJob({ kind: 'voucher', deposit: viewing })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print voucher
                </button>
                <button type="button" onClick={() => setViewing(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="rounded-xl shadow-lg overflow-hidden">
                <DepositVoucher deposit={viewing} unit={findDepositUnit(viewing, units)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {printJob && (
        <PrintPortal>
          {printJob.kind === 'voucher' ? (
            <DepositVoucher deposit={printJob.deposit} unit={findDepositUnit(printJob.deposit, units)} />
          ) : (
            <DepositStatement
              deposits={records}
              title={selected ? selected.name : 'All tenants'}
              subtitle={selected?.unit}
              periodLabel={periodLabel}
            />
          )}
        </PrintPortal>
      )}
    </div>
  );
};
