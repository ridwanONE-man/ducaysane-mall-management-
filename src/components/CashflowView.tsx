import React, { useEffect, useState } from 'react';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Sparkles,
  Wrench,
  DollarSign,
  Wallet,
  Printer,
  Pencil,
  Eye,
  X,
  Users,
  FileText,
  Zap,
  Store,
  ShieldCheck,
  Calendar,
  CalendarRange,
} from 'lucide-react';
import { CashflowTransaction, CurrencyMode, CashflowCategory, PropertyUnit } from '../types';
import { CategorySwitch, UnitCategory, unitCategoryOf } from './CategorySwitch';
import { formatMoney, parsePaymentDate, formatLongDate } from '../utils/printUtils';
import { MONTH_NAMES } from '../utils/rentLedger';
import { DeleteButton, ClearAllButton } from './DeleteControls';
import { PrintPortal } from './PrintPortal';
import { CashflowVoucher, CashflowStatement } from './CashflowVoucher';

// New entries start with this account; the admin can type any other
const DEFAULT_ACCOUNT = 'Cash';

const CATEGORY_ICON: Partial<Record<CashflowCategory, React.ComponentType<{ className?: string }>>> = {
  'Rent Collection': Store,
  'Escrow Deposit': ShieldCheck,
  'Utilities Surcharge': Zap,
  'Electricity': Zap,
  'Security & Guards': Shield,
  'Cleaning & Waste': Sparkles,
  'Repairs & Maintenance': Wrench,
  'Taxes & Licensing': FileText,
  'Staff Payroll': Users,
};

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
type PeriodMode = 'all' | 'month' | 'year' | 'day' | 'range';

const toDisplayDate = (iso: string) => {
  const d = parsePaymentDate(iso) || new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

interface CashflowViewProps {
  currencyMode: CurrencyMode;
  transactions?: CashflowTransaction[];
  // Entries from other pages (electricity) shown as money in; managed on their own page
  linkedEntries?: CashflowTransaction[];
  units?: PropertyUnit[];
  onSaveTransaction?: (tx: CashflowTransaction) => void;
  onDeleteTransaction?: (tx: CashflowTransaction) => void;
  onClearAllTransactions?: () => void;
}

export const CashflowView: React.FC<CashflowViewProps> = ({
  transactions: propTransactions,
  linkedEntries = [],
  units = [],
  onSaveTransaction,
  onDeleteTransaction,
  onClearAllTransactions
}) => {
  const [localTransactions, setLocalTransactions] = useState<CashflowTransaction[]>([]);
  const ownTransactions = propTransactions || localTransactions;
  const transactions = linkedEntries.length ? [...ownTransactions, ...linkedEntries] : ownTransactions;
  const linkedIds = new Set(linkedEntries.map(t => t.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Inflow' | 'Outflow'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'SSP'>('ALL');

  // Period: only entries dated inside it are counted and listed
  const today = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [day, setDay] = useState(toISO(today));
  const [fromDate, setFromDate] = useState(toISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toISO(today));

  // Entry form
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'Inflow' | 'Outflow'>('Inflow');
  const [newCategory, setNewCategory] = useState<CashflowCategory>('Rent Collection');
  const [newAmount, setNewAmount] = useState('');
  const [newAccount, setNewAccount] = useState<string>(DEFAULT_ACCOUNT);
  const [newNotes, setNewNotes] = useState('');
  const [newCurrency, setNewCurrency] = useState<'USD' | 'SSP'>('USD');
  const [newDate, setNewDate] = useState(toISO(new Date()));
  // Entry being edited (null = recording a new one)
  const [editingTx, setEditingTx] = useState<CashflowTransaction | null>(null);
  const [viewingTx, setViewingTx] = useState<CashflowTransaction | null>(null);
  const [printJob, setPrintJob] = useState<CashflowTransaction | 'list' | null>(null);

  // Print once the copy is in the portal
  useEffect(() => {
    if (!printJob) return;
    const timer = setTimeout(() => { window.print(); setPrintJob(null); }, 120);
    return () => clearTimeout(timer);
  }, [printJob]);

  const openNewEntry = (type: 'Inflow' | 'Outflow') => {
    setEditingTx(null);
    setNewTitle('');
    setNewType(type);
    setNewCategory('');
    setNewAmount('');
    setNewAccount(DEFAULT_ACCOUNT);
    setNewNotes('');
    setNewCurrency('USD');
    setNewDate(toISO(new Date()));
    setIsRecordModalOpen(true);
  };

  const openEdit = (t: CashflowTransaction) => {
    setEditingTx(t);
    setNewTitle(t.title);
    setNewType(t.type);
    setNewCategory(t.category);
    setNewAmount(String(t.amount));
    setNewAccount(t.account);
    setNewNotes(t.notes || '');
    setNewCurrency(t.currency || 'USD');
    setNewDate(toISO(parsePaymentDate(t.date) || new Date()));
    setIsRecordModalOpen(true);
  };

  const closeModal = () => {
    setIsRecordModalOpen(false);
    setEditingTx(null);
  };

  const inPeriod = (t: CashflowTransaction) => {
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
  // Shop / space: taken from the unit number in the entry's title, e.g. "Rent: Ali (G001)"
  const [category, setCategory] = useState<UnitCategory>('all');
  const categoryOf = (t: CashflowTransaction) => unitCategoryOf(/\(([^()]+)\)\s*$/.exec(t.title)?.[1], units);
  const datedTransactions = transactions.filter(inPeriod);
  const categoryCounts = {
    all: datedTransactions.length,
    shop: datedTransactions.filter(t => categoryOf(t) === 'shop').length,
    space: datedTransactions.filter(t => categoryOf(t) === 'space').length,
  };
  const periodTransactions = category === 'all' ? datedTransactions : datedTransactions.filter(t => categoryOf(t) === category);
  const categoryLabel = category === 'all' ? 'All units' : category === 'shop' ? 'Shops' : 'Spaces';
  const availableYears = [...new Set([today.getFullYear(), ...transactions.map(t => parsePaymentDate(t.date)?.getFullYear()).filter((y): y is number => Boolean(y))])]
    .sort((a, b) => b - a);

  // Dollars and SSP are never added together
  const sumOf = (currency: 'USD' | 'SSP', type: 'Inflow' | 'Outflow') =>
    periodTransactions.filter(t => (t.currency || 'USD') === currency && t.type === type).reduce((sum, t) => sum + t.amount, 0);
  const totals = (['USD', 'SSP'] as const).map(currency => {
    const inflow = sumOf(currency, 'Inflow');
    const outflow = sumOf(currency, 'Outflow');
    return { currency, inflow, outflow, net: inflow - outflow, count: periodTransactions.filter(t => (t.currency || 'USD') === currency).length };
  });

  const q = searchTerm.toLowerCase();
  const filteredTransactions = periodTransactions.filter(t => {
    const matchesSearch = [t.title, t.category, t.referenceNumber, t.account].some(v => (v || '').toLowerCase().includes(q));
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesCurrency = currencyFilter === 'ALL' || (t.currency || 'USD') === currencyFilter;
    return matchesSearch && matchesType && matchesCurrency;
  });

  // Next reference in this year's sequence: CF-2026-0001, CF-2026-0002, ...
  const nextReference = () => {
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^CF-${year}-(\\d+)$`);
    const last = transactions.reduce((max, t) => {
      const m = pattern.exec(t.referenceNumber || '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    return `CF-${year}-${String(last + 1).padStart(4, '0')}`;
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const category = newCategory.trim() || (newType === 'Inflow' ? 'Money in' : 'Money out');
    const details = {
      title: newTitle.trim() || `${category} Voucher`,
      category,
      type: newType,
      amount: parseFloat(newAmount) || 0,
      currency: newCurrency,
      account: newAccount.trim() || DEFAULT_ACCOUNT,
      notes: newNotes,
      date: toDisplayDate(newDate),
    };
    const tx: CashflowTransaction = editingTx
      ? { ...editingTx, ...details }
      : {
          id: `cf-${Date.now()}`,
          referenceNumber: nextReference(),
          recordedBy: 'Mohamed Mohamoud',
          status: 'Completed',
          ...details,
        };
    if (onSaveTransaction) onSaveTransaction(tx);
    else setLocalTransactions(prev => (editingTx ? prev.map(t => (t.id === tx.id ? tx : t)) : [tx, ...prev]));
    closeModal();
  };

  const handleExportCSV = () => {
    const headers = ['Ref #', 'Date', 'Transaction Title', 'Category', 'Type', 'Amount', 'Currency', 'Account', 'Recorded By', 'Notes'];
    const rows = filteredTransactions.map(t => [
      t.referenceNumber,
      t.date,
      `"${t.title}"`,
      t.category,
      t.type,
      t.amount.toString(),
      t.currency,
      `"${t.account}"`,
      t.recordedBy,
      `"${t.notes || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `NBC_Cashflow_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
      active ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
    }`;
  const selectCls = 'px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500';
  const isOut = newType === 'Outflow';
  // Balance of the chosen currency, before and after this entry (an edited entry is taken out first)
  const balanceOf = (c: 'USD' | 'SSP') =>
    ownTransactions
      .filter(t => (t.currency || 'USD') === c && t.id !== editingTx?.id)
      .reduce((s, t) => s + (t.type === 'Inflow' ? t.amount : -t.amount), 0);
  const formBefore = balanceOf(newCurrency);
  const formAfter = formBefore + (isOut ? -1 : 1) * (parseFloat(newAmount) || 0);
  const signedMoney = (n: number, c: 'USD' | 'SSP') => `${n < 0 ? '-' : ''}${formatMoney(Math.abs(n), c)}`;

  return (
    <div id="cashflow-view" className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Cash Flow</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Money in and out — dollars and SSP kept apart.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export
            </button>
            <button
              type="button"
              disabled={filteredTransactions.length === 0}
              onClick={() => setPrintJob('list')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5 text-orange-500" /> Print list
            </button>
            {onClearAllTransactions && (
              <ClearAllButton count={ownTransactions.length} itemLabel="cashflow entries" onClear={onClearAllTransactions} />
            )}
            <button data-edit
              type="button"
              onClick={() => openNewEntry('Inflow')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-500/25 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" /> Money In
            </button>
            <button data-edit
              type="button"
              onClick={() => openNewEntry('Outflow')}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold shadow-md shadow-rose-500/25 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" /> Money Out
            </button>
          </div>
        </div>
      </div>

      {/* Shops / spaces */}
      <CategorySwitch value={category} onChange={setCategory} counts={categoryCounts} noun="entries" />

      {/* Dollar and SSP cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {totals.map(t => {
          const usd = t.currency === 'USD';
          const active = currencyFilter === t.currency;
          return (
            <button
              key={t.currency}
              type="button"
              onClick={() => setCurrencyFilter(active ? 'ALL' : t.currency)}
              title={active ? 'Show all money' : `Show only ${usd ? 'dollar' : 'SSP'} entries`}
              className={`group text-left relative overflow-hidden rounded-3xl p-5 transition-all cursor-pointer ${
                usd
                  ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white'
                  : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
              } ${active ? 'ring-4 ring-orange-300' : 'hover:shadow-lg'}`}
            >
              <div className="absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-white/10" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${usd ? 'bg-orange-500' : 'bg-white/20'}`}>
                    {usd ? <DollarSign className="w-5 h-5" /> : <span className="text-[11px]">SSP</span>}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold">{usd ? 'Dollar ($)' : 'South Sudanese Pound'}</p>
                    <p className="text-[11px] opacity-70">{t.count} entr{t.count === 1 ? 'y' : 'ies'} • {active ? 'showing only these' : 'tap to filter'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">Balance</span>
                  <span className="block text-2xl font-black">{t.net < 0 ? '-' : ''}{formatMoney(Math.abs(t.net), t.currency)}</span>
                </div>
              </div>
              <div className="relative grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-2xl bg-white/10 px-3 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold opacity-80"><TrendingUp className="w-3 h-3" /> Money in</span>
                  <span className="block text-base font-black truncate">{formatMoney(t.inflow, t.currency)}</span>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold opacity-80"><TrendingDown className="w-3 h-3" /> Money out</span>
                  <span className="block text-base font-black truncate">{formatMoney(t.outflow, t.currency)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

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
        <span className="ml-auto px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold">
          {categoryLabel} • {periodLabel} • {periodTransactions.length} entr{periodTransactions.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, reference, category, bank..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
              {(['ALL', 'USD', 'SSP'] as const).map(c => (
                <button key={c} type="button" onClick={() => setCurrencyFilter(c)} className={pill(currencyFilter === c)}>
                  {c === 'ALL' ? 'All money' : c === 'USD' ? '$ Dollar' : 'SSP'}
                </button>
              ))}
            </div>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
              {(['ALL', 'Inflow', 'Outflow'] as const).map(type => (
                <button key={type} type="button" onClick={() => setTypeFilter(type)} className={pill(typeFilter === type)}>
                  {type === 'ALL' ? 'In & Out' : type === 'Inflow' ? 'Money in' : 'Money out'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Ref / Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Account / Bank</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-14 text-center">
                    <div className="w-14 h-14 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3">
                      <Wallet className="w-7 h-7" />
                    </div>
                    <p className="font-extrabold text-slate-900 text-sm">{transactions.length && periodMode !== 'all' ? `No cashflow entries in ${periodLabel}` : 'No cashflow entries'}</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">Record money coming in or going out.</p>
                    <div className="inline-flex gap-2">
                      <button data-edit type="button" onClick={() => openNewEntry('Inflow')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Money In
                      </button>
                      <button data-edit type="button" onClick={() => openNewEntry('Outflow')} className="px-4 py-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Money Out
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t, i) => {
                  const Icon = CATEGORY_ICON[t.category] || Landmark;
                  const inflow = t.type === 'Inflow';
                  return (
                    <tr key={t.id} className={`hover:bg-orange-50/40 transition-colors ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                      <td className="py-3 px-4">
                        <span className="inline-block font-mono text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md">{t.referenceNumber}</span>
                        <span className="block font-semibold text-slate-600 mt-1">{t.date}</span>
                      </td>
                      <td className="py-3 px-4 max-w-[260px]">
                        <div className="font-bold text-slate-900 truncate">{t.title}</div>
                        {t.notes && <span className="text-[11px] text-slate-400 block truncate">{t.notes}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-700">
                          <Icon className="w-3.5 h-3.5 text-orange-500" /> {t.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600 font-medium">{t.account}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${
                          inflow ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {inflow ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {inflow ? 'In' : 'Out'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-black text-sm whitespace-nowrap ${inflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {inflow ? '+' : '-'}{formatMoney(t.amount, t.currency || 'USD')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => setViewingTx(t)} title="View voucher" className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 cursor-pointer">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setPrintJob(t)} title="Print voucher" className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 cursor-pointer">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {!inflow && !linkedIds.has(t.id) && (
                            <button data-edit
                              type="button"
                              onClick={() => openEdit(t)}
                              title="Edit this outflow"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:text-orange-700 hover:bg-orange-50 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {linkedIds.has(t.id) ? (
                            <span title="Change or delete it on the Electricity page" className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold">Electricity page</span>
                          ) : onDeleteTransaction && (
                            <DeleteButton
                              title="Delete entry"
                              onDelete={() => onDeleteTransaction(t)}
                              confirm={{ title: 'Delete this cashflow entry?', subject: `${t.referenceNumber} • ${t.title}` }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredTransactions.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
            Showing <strong className="text-slate-900">{filteredTransactions.length}</strong> of {periodTransactions.length} {categoryLabel.toLowerCase()} entries in {periodLabel}
          </div>
        )}
      </div>

      {/* Money in / out form */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-6">
            <div className={`px-6 py-5 text-white ${isOut ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-gradient-to-r from-emerald-600 to-teal-500'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    {isOut ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold">{editingTx ? `Edit ${isOut ? 'Money Out' : 'Money In'}` : isOut ? 'Money Out' : 'Money In'}</h3>
                    <p className="text-[11px] opacity-80">{editingTx ? editingTx.referenceNumber : isOut ? 'Record an expense or payment' : 'Record money received'}</p>
                  </div>
                </div>
                <button type="button" onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/20 cursor-pointer" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddTransaction} className="p-4 sm:p-6 space-y-4">
              {/* Amount first: the main thing being recorded */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Amount</label>
                  <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                    {(['USD', 'SSP'] as const).map(c => (
                      <button key={c} type="button" onClick={() => setNewCurrency(c)} className={`px-3 py-1 rounded-md text-[11px] font-extrabold cursor-pointer ${newCurrency === c ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-500'}`}>
                        {c === 'USD' ? '$ Dollar' : 'SSP'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">{newCurrency === 'USD' ? '$' : 'SSP'}</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    autoFocus
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder={newCurrency === 'USD' ? '0.00' : '0'}
                    className="w-full pl-14 pr-4 py-3 bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${
                  newCurrency === 'USD' ? 'bg-slate-900 text-white' : 'bg-orange-500 text-white'
                }`}>
                  <span>{newCurrency === 'USD' ? 'Dollar' : 'SSP'} balance: {signedMoney(formBefore, newCurrency)}</span>
                  <span className="flex items-center gap-1">
                    {isOut ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    After this: <span className="font-black">{signedMoney(formAfter, newCurrency)}</span>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isOut ? 'Paid to / for' : 'Received from'}</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isOut ? 'e.g. Plumber — water pipe repair' : 'e.g. Tenant rent'}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cf-account" className="block text-xs font-bold text-slate-700 mb-1">Bank / Account</label>
                  <input
                    id="cf-account"
                    type="text"
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="e.g. Cash, KCB Bank, Equity Bank"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full pl-8 pr-2 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="cf-category" className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <input
                  id="cf-category"
                  type="text"
                  required
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder={isOut ? 'e.g. Repairs, Staff salary, Cleaning, Generator fuel' : 'e.g. Rent, Parking, Kiosk permit'}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Note <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Receipt or invoice number"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer ${
                    isOut ? 'bg-gradient-to-r from-rose-500 to-orange-500 shadow-rose-500/25' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                  }`}
                >
                  {editingTx ? 'Save changes' : isOut ? 'Record Money Out' : 'Record Money In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher preview */}
      {viewingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setViewingTx(null)}>
          <div className="bg-slate-100 rounded-3xl max-w-3xl w-full shadow-2xl my-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-slate-200">
              <p className="text-sm font-extrabold text-slate-900 truncate">Voucher {viewingTx.referenceNumber}</p>
              <div className="flex items-center gap-2">
                {viewingTx.type === 'Outflow' && (
                  <button
                    type="button"
                    onClick={() => { const t = viewingTx; setViewingTx(null); openEdit(t); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 text-xs font-bold cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPrintJob(viewingTx)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print voucher
                </button>
                <button type="button" onClick={() => setViewingTx(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="rounded-xl shadow-lg overflow-hidden">
                <CashflowVoucher tx={transactions.find(t => t.id === viewingTx.id) || viewingTx} />
              </div>
            </div>
          </div>
        </div>
      )}

      {printJob && (
        <PrintPortal>
          {printJob === 'list' ? (
            <CashflowStatement
              transactions={filteredTransactions}
              filterLabel={[
                categoryLabel,
                periodLabel,
                currencyFilter === 'ALL' ? 'All money' : currencyFilter === 'USD' ? 'Dollar only' : 'SSP only',
                typeFilter === 'ALL' ? 'in & out' : typeFilter === 'Inflow' ? 'money in' : 'money out',
                searchTerm.trim() ? `search "${searchTerm.trim()}"` : '',
              ].filter(Boolean).join(' • ')}
            />
          ) : (
            <CashflowVoucher tx={printJob} />
          )}
        </PrintPortal>
      )}
    </div>
  );
};
