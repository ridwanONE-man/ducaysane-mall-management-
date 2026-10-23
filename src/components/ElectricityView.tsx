import React, { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Plus,
  Search,
  Printer,
  Pencil,
  X,
  CalendarRange,
  CalendarDays,
  Store,
  LayoutGrid,
  Check,
  CheckSquare,
  Square,
  Gauge,
  Building2,
  Database,
} from 'lucide-react';
import { CashflowTransaction, ElectricityEntry, PropertyUnit } from '../types';
import { CategorySwitch, UnitCategory, unitCategoryOf } from './CategorySwitch';
import { DeleteButton } from './DeleteControls';
import { PrintPortal } from './PrintPortal';
import { CashflowVoucher, CashflowHeader } from './CashflowVoucher';
import { formatMoney, parsePaymentDate, formatLongDate } from '../utils/printUtils';
import { MONTH_NAMES } from '../utils/rentLedger';
import { unitCurrency } from '../utils/currency';
import { BUSINESS_PROFILE } from '../data/businessProfile';

// Electricity has its own table. The Cash Flow page lists these entries read-only
// (as money in) through electricityToCashflow; they are never saved to cashflow.
export const electricityToCashflow = (e: ElectricityEntry): CashflowTransaction => ({
  id: e.id,
  referenceNumber: e.referenceNumber,
  date: toDisplayDate(e.date),
  title: e.unitNumber === DAILY_SPACES ? 'Electricity: Daily space electricity (Spaces)' : `Electricity: ${e.tenantName || 'No tenant'} (${e.unitNumber})`,
  category: 'Electricity',
  type: 'Inflow',
  amount: e.amount,
  currency: e.currency,
  account: 'Central Vault Cash Float',
  recordedBy: e.recordedBy || BUSINESS_PROFILE.managerName,
  status: 'Completed',
  notes: [e.kwh ? `${e.kwh} kWh` : '', e.notes || ''].filter(Boolean).join(' • ') || undefined,
});

type Currency = 'USD' | 'SSP';
type PeriodMode = 'all' | 'day' | 'month' | 'year' | 'range';
type PrintJob = ElectricityEntry | 'report' | null;

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDisplayDate = (iso: string) =>
  (parsePaymentDate(iso) || new Date()).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

// Spaces are recorded as one amount per day, stored under this unit number
export const DAILY_SPACES = 'ALL SPACES';
const DAILY_SPACES_LABEL = 'Daily space electricity';
const isDailySpaces = (e: ElectricityEntry) => e.unitNumber === DAILY_SPACES;

const unitOfEntry = (e: ElectricityEntry) => e.unitNumber;
const tenantOfEntry = (e: ElectricityEntry) => (isDailySpaces(e) ? DAILY_SPACES_LABEL : e.tenantName || 'No tenant');
const kwhOfEntry = (e: ElectricityEntry) => e.kwh || 0;
const noteOfEntry = (e: ElectricityEntry) => e.notes || '';

const dayHeading = (d: Date) => {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

const sumBy = (list: ElectricityEntry[], currency: Currency) =>
  list.filter(t => t.currency === currency).reduce((s, t) => s + t.amount, 0);

// Entries grouped by day, newest day first
function groupByDay(list: ElectricityEntry[]) {
  const groups = new Map<string, { date: Date; items: ElectricityEntry[] }>();
  for (const t of list) {
    const d = parsePaymentDate(t.date) || new Date(0);
    const key = toISO(d);
    if (!groups.has(key)) groups.set(key, { date: d, items: [] });
    groups.get(key)!.items.push(t);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, g]) => ({ key, ...g }));
}

interface ElectricityViewProps {
  entries: ElectricityEntry[];
  units: PropertyUnit[];
  dbReady: boolean; // false until the electricity table exists
  onSave: (entry: ElectricityEntry) => void;
  onDelete: (entry: ElectricityEntry) => void;
}

export const ElectricityView: React.FC<ElectricityViewProps> = ({ entries: allEntries, units, dbReady, onSave, onDelete }) => {
  const entries = useMemo(
    () => [...allEntries].sort((a, b) => b.date.localeCompare(a.date) || b.referenceNumber.localeCompare(a.referenceNumber)),
    [allEntries]
  );

  const today = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [day, setDay] = useState(toISO(today));
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [fromDate, setFromDate] = useState(toISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toISO(today));
  const [category, setCategory] = useState<UnitCategory>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | Currency>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ editing: ElectricityEntry | null } | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob>(null);
  const [printList, setPrintList] = useState<ElectricityEntry[]>([]);

  useEffect(() => {
    if (!printJob) return;
    const timer = setTimeout(() => { window.print(); setPrintJob(null); }, 120);
    return () => clearTimeout(timer);
  }, [printJob]);

  const inPeriod = (t: ElectricityEntry) => {
    if (periodMode === 'all') return true;
    const d = parsePaymentDate(t.date);
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

  const categoryOf = (t: ElectricityEntry) => unitCategoryOf(t.unitNumber, units) || (t.unitType === 'Space' ? 'space' : 'shop');
  const dated = entries.filter(inPeriod);
  const categoryCounts = {
    all: dated.length,
    shop: dated.filter(t => categoryOf(t) === 'shop').length,
    space: dated.filter(t => categoryOf(t) === 'space').length,
  };
  const periodEntries = category === 'all' ? dated : dated.filter(t => categoryOf(t) === category);
  const categoryLabel = category === 'all' ? 'Shops & spaces' : category === 'shop' ? 'Shops' : 'Spaces';

  const q = search.trim().toLowerCase();
  const shown = periodEntries.filter(t =>
    (currencyFilter === 'ALL' || t.currency === currencyFilter) &&
    (!q || [t.tenantName, t.unitNumber, t.referenceNumber, t.notes].some(v => (v || '').toLowerCase().includes(q)))
  );
  const groups = groupByDay(shown);

  const todays = entries.filter(t => parsePaymentDate(t.date)?.toDateString() === today.toDateString());
  const kwhTotal = periodEntries.reduce((s, t) => s + kwhOfEntry(t), 0);
  const unitsCharged = new Set(periodEntries.map(unitOfEntry)).size;
  const availableYears = [...new Set([today.getFullYear(), ...entries.map(t => parsePaymentDate(t.date)?.getFullYear()).filter((y): y is number => Boolean(y))])]
    .sort((a, b) => b - a);

  const selectedShown = shown.filter(t => selected.has(t.id));
  const allShownSelected = shown.length > 0 && selectedShown.length === shown.length;
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map(t => t.id)));

  const filterLabel = [
    categoryLabel,
    periodLabel,
    currencyFilter === 'ALL' ? '' : currencyFilter === 'USD' ? 'Dollar only' : 'SSP only',
    q ? `search "${search.trim()}"` : '',
  ].filter(Boolean).join(' • ');

  const printReport = (list: ElectricityEntry[]) => {
    setPrintList(list);
    setPrintJob('report');
  };

  // Next numbers in this year's electricity sequence: EL-2026-0001, ...
  const nextReferences = (count: number) => {
    const y = new Date().getFullYear();
    const pattern = new RegExp(`^EL-${y}-(\\d+)$`);
    const last = entries.reduce((max, t) => {
      const m = pattern.exec(t.referenceNumber || '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    return Array.from({ length: count }, (_, i) => `EL-${y}-${String(last + 1 + i).padStart(4, '0')}`);
  };

  const handleSubmit = (rows: FormRow[], date: string) => {
    const details = (r: FormRow) => ({
      date,
      unitNumber: r.unit.unitNumber,
      unitType: (r.unit.unitNumber === DAILY_SPACES || unitCategoryOf(r.unit.unitNumber, units) === 'space' ? 'Space' : 'Shop') as ElectricityEntry['unitType'],
      tenantName: r.tenant,
      amount: Number(r.amount) || 0,
      currency: r.currency,
      kwh: Number(r.kwh) > 0 ? Number(r.kwh) : undefined,
      notes: r.note.trim() || undefined,
    });
    const editing = form?.editing;
    if (editing) {
      onSave({ ...editing, ...details(rows[0]) });
    } else {
      const refs = nextReferences(rows.length);
      const stamp = Date.now();
      rows.forEach((r, i) => onSave({
        id: `el-${stamp}-${i}`,
        referenceNumber: refs[i],
        recordedBy: BUSINESS_PROFILE.managerName,
        createdAt: new Date().toISOString(),
        ...details(r),
      }));
    }
    setForm(null);
  };

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
      active ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
    }`;
  const selectCls = 'px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500';

  const cards = [
    {
      key: 'USD' as const,
      label: 'Dollar collected',
      value: formatMoney(sumBy(periodEntries, 'USD'), 'USD'),
      sub: `${periodEntries.filter(t => t.currency === 'USD').length} entries`,
      cls: 'bg-gradient-to-br from-slate-900 to-slate-800 text-white',
      icon: 'bg-white/10 text-amber-300',
    },
    {
      key: 'SSP' as const,
      label: 'SSP collected',
      value: formatMoney(sumBy(periodEntries, 'SSP'), 'SSP'),
      sub: `${periodEntries.filter(t => t.currency === 'SSP').length} entries`,
      cls: 'bg-gradient-to-br from-orange-500 to-amber-500 text-white',
      icon: 'bg-white/20 text-white',
    },
  ];

  return (
    <div id="electricity-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber-100/60" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Zap className="w-7 h-7 fill-white/30" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Daily Electricity Report</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Electricity money from shops and spaces. Also listed in Cash Flow as money in.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={shown.length === 0}
              onClick={() => printReport(shown)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5 text-orange-500" /> Print all ({shown.length})
            </button>
            <button
              type="button"
              disabled={selectedShown.length === 0}
              onClick={() => printReport(selectedShown)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckSquare className="w-3.5 h-3.5 text-orange-500" /> Print selected ({selectedShown.length})
            </button>
            <button
              type="button"
              onClick={() => setForm({ editing: null })}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-sm font-extrabold shadow-md shadow-orange-500/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Electricity
            </button>
          </div>
        </div>
      </div>

      {!dbReady && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-bold">The electricity table is not in the database yet.</p>
            <p className="text-xs mt-0.5">Run <span className="font-mono font-bold">supabase/electricity.sql</span> in Supabase → SQL Editor. Until then, entries are kept on this device and upload automatically afterwards.</p>
          </div>
        </div>
      )}

      {/* Shops / spaces */}
      <CategorySwitch value={category} onChange={setCategory} counts={categoryCounts} noun="entries" />

      {/* Money boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(c => {
          const active = currencyFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCurrencyFilter(active ? 'ALL' : c.key)}
              title={active ? 'Show all money' : `Show only ${c.key === 'USD' ? 'dollar' : 'SSP'} entries`}
              className={`relative overflow-hidden text-left rounded-3xl p-5 shadow-md transition-all cursor-pointer hover:-translate-y-0.5 ${c.cls} ${active ? 'ring-4 ring-orange-300' : ''}`}
            >
              <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-white/10" />
              <div className="relative flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider opacity-80">{c.label}</span>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon}`}><Zap className="w-4.5 h-4.5" /></span>
              </div>
              <p className="relative mt-3 text-2xl sm:text-3xl font-black tracking-tight">{c.value}</p>
              <p className="relative mt-1 text-xs opacity-75">{c.sub} • {periodLabel}</p>
            </button>
          );
        })}

        <div className="relative overflow-hidden rounded-3xl p-5 bg-white border border-emerald-200 shadow-xs">
          <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-emerald-50" />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Today</span>
            <span className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center"><CalendarDays className="w-4.5 h-4.5" /></span>
          </div>
          <p className="relative mt-3 text-xl font-black text-slate-900">{formatMoney(sumBy(todays, 'USD'), 'USD')}</p>
          <p className="relative text-xl font-black text-orange-600">{formatMoney(sumBy(todays, 'SSP'), 'SSP')}</p>
          <p className="relative mt-1 text-xs text-slate-500">{todays.length} entr{todays.length === 1 ? 'y' : 'ies'} • {formatLongDate(today)}</p>
        </div>

        <div className="relative overflow-hidden rounded-3xl p-5 bg-white border border-blue-200 shadow-xs">
          <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-blue-50" />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">Units charged</span>
            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Building2 className="w-4.5 h-4.5" /></span>
          </div>
          <p className="relative mt-3 text-3xl font-black text-slate-900">{unitsCharged}</p>
          <p className="relative mt-1 text-xs text-slate-500 flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-blue-500" /> {kwhTotal ? `${kwhTotal.toLocaleString()} kWh used` : 'No kWh recorded'} • {periodLabel}
          </p>
        </div>
      </div>

      {/* Period */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700"><CalendarRange className="w-4 h-4 text-orange-500" /> Show</span>
        <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
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
          <span className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={selectCls} />
            <span className="text-xs font-bold text-slate-400">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={selectCls} />
          </span>
        )}
        <span className="ml-auto px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold">
          {categoryLabel} • {periodLabel} • {periodEntries.length} entr{periodEntries.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tenant, unit, reference..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
              {(['ALL', 'USD', 'SSP'] as const).map(c => (
                <button key={c} type="button" onClick={() => setCurrencyFilter(c)} className={pill(currencyFilter === c)}>
                  {c === 'ALL' ? 'All money' : c === 'USD' ? '$ Dollar' : 'SSP'}
                </button>
              ))}
            </div>
            {shown.length > 0 && (
              <button type="button" onClick={toggleAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-orange-300 text-xs font-bold text-slate-700 cursor-pointer">
                {allShownSelected ? <CheckSquare className="w-4 h-4 text-orange-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                {allShownSelected ? 'Unselect all' : 'Select all'}
              </button>
            )}
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center"><Zap className="w-7 h-7" /></div>
            <p className="mt-3 text-sm font-bold text-slate-700">{entries.length === 0 ? 'No electricity recorded yet' : 'Nothing matches this period or search'}</p>
            <p className="text-xs text-slate-400 mt-1">Press “Add Electricity”, choose the shops or spaces and type the money.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map(g => (
              <div key={g.key}>
                {/* Day header with that day's totals */}
                <div className="px-4 py-2.5 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                    <CalendarDays className="w-4 h-4 text-orange-500" />
                    {dayHeading(g.date)} • {formatLongDate(g.date)}
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] text-slate-500">{g.items.length} unit{g.items.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs font-black">
                    {sumBy(g.items, 'USD') > 0 && <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white">{formatMoney(sumBy(g.items, 'USD'), 'USD')}</span>}
                    {sumBy(g.items, 'SSP') > 0 && <span className="px-2 py-0.5 rounded-lg bg-orange-500 text-white">{formatMoney(sumBy(g.items, 'SSP'), 'SSP')}</span>}
                    <button
                      type="button"
                      onClick={() => printReport(g.items)}
                      title="Print this day"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-white cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>

                {g.items.map(t => {
                  const unitNo = unitOfEntry(t);
                  const isSpace = categoryOf(t) === 'space';
                  const isSel = selected.has(t.id);
                  const kwh = kwhOfEntry(t);
                  const note = noteOfEntry(t);
                  const daily = isDailySpaces(t);
                  return (
                    <div key={t.id} className={`px-4 py-3 flex items-center gap-3 transition-colors ${isSel ? 'bg-orange-50/60' : daily ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50/70'}`}>
                      <button type="button" onClick={() => toggleOne(t.id)} className="shrink-0 cursor-pointer" title={isSel ? 'Unselect' : 'Select to print'}>
                        {isSel ? <CheckSquare className="w-5 h-5 text-orange-500" /> : <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />}
                      </button>
                      <span className={`shrink-0 w-16 py-1.5 rounded-xl text-center text-xs font-black text-white bg-gradient-to-br ${isSpace ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-amber-500'}`}>
                        {daily ? <LayoutGrid className="w-4 h-4 mx-auto" /> : unitNo || '—'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold truncate ${daily ? 'text-blue-900' : 'text-slate-900'}`}>
                          {tenantOfEntry(t)}
                          {daily && <span className="ml-2 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black align-middle">{formatLongDate(t.date)}</span>}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          <span className="font-mono">{t.referenceNumber}</span>
                          {kwh > 0 && <> • <Gauge className="inline w-3 h-3 -mt-0.5 text-blue-500" /> {kwh.toLocaleString()} kWh</>}
                          {note && <> • {note}</>}
                        </p>
                      </div>
                      <span className={`shrink-0 text-base font-black ${t.currency === 'SSP' ? 'text-orange-600' : 'text-slate-900'}`}>
                        {formatMoney(t.amount, t.currency)}
                      </span>
                      <div className="shrink-0 flex items-center gap-1">
                        <button type="button" onClick={() => setPrintJob(t)} title="Print voucher" className="p-2 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 cursor-pointer">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setForm({ editing: t })} title="Modify" className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <DeleteButton
                          title="Delete"
                          onDelete={() => onDelete(t)}
                          confirm={{
                            title: 'Delete this electricity entry?',
                            subject: `${tenantOfEntry(t)} • ${unitNo} • ${formatMoney(t.amount, t.currency)}`,
                            message: 'It is removed from the electricity records and the Cash Flow list.',
                            confirmLabel: 'Delete entry',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <ElectricityForm
          units={units}
          editing={form.editing}
          onClose={() => setForm(null)}
          onSubmit={handleSubmit}
        />
      )}

      {printJob && (
        <PrintPortal>
          {printJob === 'report'
            ? <ElectricityReport entries={printList} filterLabel={filterLabel} units={units} />
            : <CashflowVoucher tx={electricityToCashflow(printJob)} />}
        </PrintPortal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Add / modify form: shops one by one, spaces as one daily amount
// ---------------------------------------------------------------------------

interface FormRow {
  unit: PropertyUnit;
  tenant: string;
  amount: string;
  currency: Currency;
  kwh: string;
  note: string;
}

const dailySpacesUnit = { id: 'daily-spaces', unitNumber: DAILY_SPACES } as PropertyUnit;

const ElectricityForm: React.FC<{
  units: PropertyUnit[];
  editing: ElectricityEntry | null;
  onClose: () => void;
  onSubmit: (rows: FormRow[], dateIso: string) => void;
}> = ({ units, editing, onClose, onSubmit }) => {
  const isSpaceUnit = (u: PropertyUnit) => unitCategoryOf(u.unitNumber, units) === 'space';
  const editingDaily = Boolean(editing && isDailySpaces(editing));
  const rowFor = (u: PropertyUnit): FormRow => ({
    unit: u,
    tenant: u.currentTenant?.name || 'No tenant',
    amount: '',
    currency: unitCurrency(u),
    kwh: '',
    note: '',
  });

  const [date, setDate] = useState(() => editing?.date || toISO(new Date()));
  const [tab, setTab] = useState<'shop' | 'space'>(editingDaily ? 'space' : 'shop');
  const [find, setFind] = useState('');

  // Shops, each with its own money
  const [rows, setRows] = useState<FormRow[]>(() => {
    if (!editing || editingDaily) return [];
    const unitNo = editing.unitNumber;
    const unit = units.find(u => u.unitNumber === unitNo) || ({ id: `missing-${unitNo}`, unitNumber: unitNo } as PropertyUnit);
    return [{
      unit,
      tenant: tenantOfEntry(editing),
      amount: String(editing.amount),
      currency: editing.currency,
      kwh: kwhOfEntry(editing) ? String(kwhOfEntry(editing)) : '',
      note: noteOfEntry(editing),
    }];
  });

  // Spaces: one amount for the whole day
  const firstSpace = units.find(isSpaceUnit);
  const [daily, setDaily] = useState(() => ({
    amount: editingDaily ? String(editing!.amount) : '',
    currency: (editingDaily ? editing!.currency : firstSpace ? unitCurrency(firstSpace) : 'SSP') as Currency,
    note: editingDaily ? noteOfEntry(editing!) : '',
  }));
  const dailyAmount = Number(daily.amount) || 0;
  const spaceCount = units.filter(isSpaceUnit).length;

  const f = find.trim().toLowerCase();
  const pickable = units
    .filter(u => !isSpaceUnit(u))
    .filter(u => !f || u.unitNumber.toLowerCase().includes(f) || (u.currentTenant?.name || '').toLowerCase().includes(f))
    .sort((a, b) => Number(Boolean(b.currentTenant)) - Number(Boolean(a.currentTenant)) || a.unitNumber.localeCompare(b.unitNumber));

  const isPicked = (u: PropertyUnit) => rows.some(r => r.unit.id === u.id);
  const pick = (u: PropertyUnit) => {
    if (editing) {
      // A modified entry stays one shop: picking another swaps it
      setRows(prev => [{ ...prev[0], unit: u, tenant: u.currentTenant?.name || 'No tenant' }]);
      return;
    }
    setRows(prev => (prev.some(r => r.unit.id === u.id) ? prev.filter(r => r.unit.id !== u.id) : [...prev, rowFor(u)]));
  };
  const pickAllShown = () => setRows(prev => [...prev, ...pickable.filter(u => u.currentTenant && !prev.some(r => r.unit.id === u.id)).map(rowFor)]);
  const update = (id: string, patch: Partial<FormRow>) => setRows(prev => prev.map(r => (r.unit.id === id ? { ...r, ...patch } : r)));

  const dailyRow: FormRow | null = dailyAmount > 0
    ? { unit: dailySpacesUnit, tenant: DAILY_SPACES_LABEL, amount: daily.amount, currency: daily.currency, kwh: '', note: daily.note }
    : null;
  const allRows = editingDaily ? (dailyRow ? [dailyRow] : []) : [...rows, ...(editing ? [] : dailyRow ? [dailyRow] : [])];
  const ready = allRows.length > 0 && allRows.every(r => Number(r.amount) > 0);
  const total = (c: Currency) => allRows.filter(r => r.currency === c).reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const tabs: { key: 'shop' | 'space'; label: string; icon: typeof Store; badge: string }[] = [
    { key: 'shop', label: 'Shops', icon: Store, badge: rows.length ? String(rows.length) : '' },
    { key: 'space', label: 'Daily space electricity', icon: LayoutGrid, badge: dailyAmount > 0 ? '✓' : '' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Title */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center"><Zap className="w-6 h-6" /></span>
            <div>
              <h2 className="text-xl font-black">{editing ? 'Modify electricity' : 'Add electricity'}</h2>
              <p className="text-xs text-white/85">{editing ? editing.referenceNumber : 'Shops one by one, spaces as one daily amount'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/20 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Date */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
            <CalendarDays className="w-5 h-5 text-orange-500" />
            <label htmlFor="el-date" className="text-sm font-bold text-slate-800">Date</label>
            <input
              id="el-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <span className="text-xs text-amber-800">{date === toISO(new Date()) ? 'Today, set automatically' : formatLongDate(date)}</span>
          </div>

          {/* Shops / daily spaces */}
          {!editing && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              {tabs.map(t => {
                const on = tab === t.key;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`relative flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-extrabold transition-all cursor-pointer ${
                      on
                        ? t.key === 'space' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                    {t.badge && (
                      <span className={`min-w-5 h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center ${on ? 'bg-white/25 text-white' : 'bg-white text-slate-700'}`}>{t.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'space' ? (
            /* Daily space electricity: one amount for the day */
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 text-white p-6 shadow-lg shadow-blue-500/25">
              <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10" />
              <div className="absolute right-16 -bottom-16 w-40 h-40 rounded-full bg-white/5" />
              <div className="relative flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center"><Zap className="w-6 h-6 fill-white/30" /></span>
                <div>
                  <p className="text-lg font-black">Daily space electricity</p>
                  <p className="text-xs text-white/80">{formatLongDate(date)} • all spaces together{spaceCount ? ` (${spaceCount} space${spaceCount === 1 ? '' : 's'})` : ''}</p>
                </div>
              </div>

              <div className="relative mt-5 flex flex-col sm:flex-row gap-3">
                <div className="inline-flex self-start bg-white/15 p-1 rounded-2xl">
                  {(['USD', 'SSP'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDaily(d => ({ ...d, currency: c }))}
                      className={`px-5 py-3 rounded-xl text-sm font-black cursor-pointer transition-all ${daily.currency === c ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/80 hover:text-white'}`}
                    >
                      {c === 'USD' ? '$ Dollar' : 'SSP'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  autoFocus
                  value={daily.amount}
                  onChange={e => setDaily(d => ({ ...d, amount: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && ready) onSubmit(allRows, date); }}
                  placeholder="Total money collected today"
                  className="flex-1 min-w-0 h-14 px-5 bg-white rounded-2xl text-2xl font-black text-slate-900 placeholder:text-base placeholder:font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-white/40"
                />
              </div>
              <input
                value={daily.note}
                onChange={e => setDaily(d => ({ ...d, note: e.target.value }))}
                placeholder="Note (optional)"
                className="relative mt-3 w-full h-11 px-4 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 focus:border-white/40"
              />
              <p className="relative mt-4 text-sm text-white/85">
                {dailyAmount > 0
                  ? <>Saved as <strong className="text-white">{DAILY_SPACES_LABEL}</strong> • {formatMoney(dailyAmount, daily.currency)}</>
                  : 'Type the money, then press Save.'}
              </p>
            </div>
          ) : (
            <>
              {/* Shop picker */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-extrabold text-slate-800">1. {editing ? 'Shop' : 'Choose shops'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        value={find}
                        onChange={e => setFind(e.target.value)}
                        placeholder="Find shop or tenant"
                        className="w-48 pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    {!editing && (
                      <button type="button" onClick={pickAllShown} className="px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold cursor-pointer">
                        Select all with tenants
                      </button>
                    )}
                  </div>
                </div>
                {pickable.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">No shops found.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                    {pickable.map(u => {
                      const on = isPicked(u);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => pick(u)}
                          className={`relative rounded-xl border-2 px-2 py-2 text-left transition-all cursor-pointer ${
                            on ? 'border-orange-500 bg-orange-500 text-white shadow-md' : 'border-slate-200 bg-white hover:border-orange-300 text-slate-800'
                          }`}
                        >
                          {on && <Check className="absolute top-1 right-1 w-3.5 h-3.5" />}
                          <span className="block text-xs font-black">{u.unitNumber}</span>
                          <span className={`block text-[10px] truncate ${on ? 'text-white/85' : u.currentTenant ? 'text-slate-500' : 'text-slate-300'}`}>
                            {u.currentTenant?.name || 'No tenant'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Money per shop */}
              <div>
                <p className="text-sm font-extrabold text-slate-800 mb-2">2. Electricity money {rows.length > 0 && <span className="text-slate-400 font-bold">({rows.length})</span>}</p>
                {rows.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Choose at least one shop above.</p>
                ) : (
                  <div className="space-y-2">
                    {rows.map(r => (
                      <div key={r.unit.id} className="rounded-2xl border border-slate-200 p-3 flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex items-center gap-3 md:w-52 shrink-0">
                          <span className="w-14 py-1.5 rounded-xl text-center text-xs font-black text-white bg-gradient-to-br from-orange-500 to-amber-500">{r.unit.unitNumber}</span>
                          <span className="text-sm font-bold text-slate-900 truncate">{r.tenant}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl shrink-0">
                            {(['USD', 'SSP'] as const).map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => update(r.unit.id, { currency: c })}
                                className={`px-2.5 py-2 rounded-lg text-xs font-black cursor-pointer ${r.currency === c ? (c === 'USD' ? 'bg-slate-900 text-white' : 'bg-orange-500 text-white') : 'text-slate-500'}`}
                              >
                                {c === 'USD' ? '$' : 'SSP'}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            value={r.amount}
                            onChange={e => update(r.unit.id, { amount: e.target.value })}
                            placeholder="Amount"
                            autoFocus={rows.length === 1}
                            className="w-full min-w-0 h-11 px-3 bg-white border-2 border-slate-200 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                          />
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={r.kwh}
                            onChange={e => update(r.unit.id, { kwh: e.target.value })}
                            placeholder="kWh"
                            title="Units used (optional)"
                            className="w-20 shrink-0 h-11 px-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <input
                          value={r.note}
                          onChange={e => update(r.unit.id, { note: e.target.value })}
                          placeholder="Note (optional)"
                          className="md:w-40 h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-orange-500"
                        />
                        {!editing && (
                          <button type="button" onClick={() => pick(r.unit)} title="Remove" className="self-end md:self-auto p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Totals + save */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black">
            <span className="text-slate-500 font-bold">Total</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white">{formatMoney(total('USD'), 'USD')}</span>
            <span className="px-2.5 py-1 rounded-lg bg-orange-500 text-white">{formatMoney(total('SSP'), 'SSP')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => onSubmit(allRows, date)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-extrabold shadow-md shadow-orange-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editing ? 'Save changes' : allRows.length > 1 ? `Save ${allRows.length} entries` : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Printed report: grouped by day, dollar and SSP totals kept apart
// ---------------------------------------------------------------------------

const ElectricityReport: React.FC<{ entries: ElectricityEntry[]; filterLabel: string; units: PropertyUnit[] }> = ({ entries, filterLabel, units }) => {
  const groups = groupByDay(entries);
  const usd = sumBy(entries, 'USD');
  const ssp = sumBy(entries, 'SSP');
  const kwh = entries.reduce((s, t) => s + kwhOfEntry(t), 0);
  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
        <CashflowHeader title="Electricity Report" subtitle="Daily collection" tone="bg-gradient-to-b from-amber-400 to-orange-500" />
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Showing: <strong className="text-slate-900">{filterLabel}</strong> • {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
            <span>Printed {formatLongDate(new Date())} • {BUSINESS_PROFILE.managerName} (Admin)</span>
          </div>

          <div className="grid grid-cols-3 gap-3 print-avoid-break text-center">
            <div className="rounded-xl border border-slate-300 py-2"><span className="block text-[10px] uppercase text-slate-500 font-bold">Dollar</span><strong className="text-base">{formatMoney(usd, 'USD')}</strong></div>
            <div className="rounded-xl border border-slate-300 py-2"><span className="block text-[10px] uppercase text-slate-500 font-bold">SSP</span><strong className="text-base">{formatMoney(ssp, 'SSP')}</strong></div>
            <div className="rounded-xl border border-slate-300 py-2"><span className="block text-[10px] uppercase text-slate-500 font-bold">kWh</span><strong className="text-base">{kwh ? kwh.toLocaleString() : '—'}</strong></div>
          </div>

          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-y-2 border-slate-900 text-left uppercase tracking-wider">
                <th className="py-1.5">Ref</th>
                <th className="py-1.5">Unit</th>
                <th className="py-1.5">Type</th>
                <th className="py-1.5">Tenant</th>
                <th className="py-1.5 text-right">kWh</th>
                <th className="py-1.5 text-right">Dollar</th>
                <th className="py-1.5 text-right">SSP</th>
              </tr>
            </thead>
            {groups.map(g => (
              <tbody key={g.key} className="print-avoid-break">
                <tr className="bg-slate-100">
                  <td colSpan={5} className="py-1.5 px-1 font-black">{formatLongDate(g.date)}</td>
                  <td className="py-1.5 text-right font-black font-mono">{sumBy(g.items, 'USD') ? formatMoney(sumBy(g.items, 'USD'), 'USD') : ''}</td>
                  <td className="py-1.5 text-right font-black font-mono">{sumBy(g.items, 'SSP') ? formatMoney(sumBy(g.items, 'SSP'), 'SSP') : ''}</td>
                </tr>
                {g.items.map(t => (
                  <tr key={t.id} className="border-b border-slate-200">
                    <td className="py-1.5 font-mono">{t.referenceNumber}</td>
                    <td className="py-1.5 font-bold">{isDailySpaces(t) ? 'All spaces' : unitOfEntry(t)}</td>
                    <td className="py-1.5">{(unitCategoryOf(t.unitNumber, units) || t.unitType.toLowerCase()) === 'space' ? 'Space' : 'Shop'}</td>
                    <td className="py-1.5">{tenantOfEntry(t)}</td>
                    <td className="py-1.5 text-right">{kwhOfEntry(t) || ''}</td>
                    <td className="py-1.5 text-right font-mono">{t.currency === 'USD' ? formatMoney(t.amount, 'USD') : ''}</td>
                    <td className="py-1.5 text-right font-mono">{t.currency === 'SSP' ? formatMoney(t.amount, 'SSP') : ''}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-black">
                <td colSpan={5} className="py-2 uppercase">Total</td>
                <td className="py-2 text-right font-mono">{formatMoney(usd, 'USD')}</td>
                <td className="py-2 text-right font-mono">{formatMoney(ssp, 'SSP')}</td>
              </tr>
            </tfoot>
          </table>

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
