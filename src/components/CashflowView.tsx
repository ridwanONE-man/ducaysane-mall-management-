import React, { useEffect, useState } from 'react';
import { 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Download, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Shield, 
  Sparkles, 
  Wrench, 
  FileSpreadsheet, 
  CheckCircle2,
  DollarSign,
  Wallet,
  Printer,
  Pencil,
  Eye,
  X,
} from 'lucide-react';
import { CashflowTransaction, CurrencyMode, CashflowCategory } from '../types';
import { formatMoney } from '../utils/printUtils';
import { DeleteButton, ClearAllButton } from './DeleteControls';
import { PrintPortal } from './PrintPortal';
import { CashflowVoucher, CashflowStatement } from './CashflowVoucher';

const ACCOUNTS: CashflowTransaction['account'][] = ['Central Vault Cash Float', 'Stanbic Bank Operating', 'Ecobank Operating', 'Escrow Trust Account'];

interface CashflowViewProps {
  currencyMode: CurrencyMode;
  transactions?: CashflowTransaction[];
  onSaveTransaction?: (tx: CashflowTransaction) => void;
  onDeleteTransaction?: (tx: CashflowTransaction) => void;
  onClearAllTransactions?: () => void;
}

export const CashflowView: React.FC<CashflowViewProps> = ({ 
  currencyMode,
  transactions: propTransactions,
  onSaveTransaction,
  onDeleteTransaction,
  onClearAllTransactions
}) => {
  const [localTransactions, setLocalTransactions] = useState<CashflowTransaction[]>([]);
  const transactions = propTransactions || localTransactions;
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Inflow' | 'Outflow'>('ALL');

  // Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'Inflow' | 'Outflow'>('Inflow');
  const [newCategory, setNewCategory] = useState<CashflowCategory>('Rent Collection');
  const [newAmount, setNewAmount] = useState('');
  const [newAccount, setNewAccount] = useState<CashflowTransaction['account']>('Central Vault Cash Float');
  const [newNotes, setNewNotes] = useState('');
  const [newCurrency, setNewCurrency] = useState<'USD' | 'SSP'>('USD');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'SSP'>('ALL');
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

  const openNewEntry = () => {
    setEditingTx(null);
    setNewTitle('');
    setNewType('Inflow');
    setNewCategory('Rent Collection');
    setNewAmount('');
    setNewAccount('Central Vault Cash Float');
    setNewNotes('');
    setNewCurrency('USD');
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
    setIsRecordModalOpen(true);
  };

  // Calculations
  // Dollars and SSP are never added together
  const sumOf = (currency: 'USD' | 'SSP', type: 'Inflow' | 'Outflow') =>
    transactions.filter(t => (t.currency || 'USD') === currency && t.type === type).reduce((sum, t) => sum + t.amount, 0);
  const totals = (['USD', 'SSP'] as const).map(currency => {
    const inflow = sumOf(currency, 'Inflow');
    const outflow = sumOf(currency, 'Outflow');
    return { currency, inflow, outflow, net: inflow - outflow, count: transactions.filter(t => (t.currency || 'USD') === currency).length };
  });

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.account.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesCurrency = currencyFilter === 'ALL' || (t.currency || 'USD') === currencyFilter;
    return matchesSearch && matchesType && matchesCurrency;
  });

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTx) {
      // Same voucher (id, reference, date), new details
      const updated: CashflowTransaction = {
        ...editingTx,
        title: newTitle.trim() || editingTx.title,
        category: newCategory,
        type: newType,
        amount: parseFloat(newAmount) || 0,
        currency: newCurrency,
        account: newAccount,
        notes: newNotes,
      };
      if (onSaveTransaction) onSaveTransaction(updated);
      else setLocalTransactions(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setIsRecordModalOpen(false);
      setEditingTx(null);
      return;
    }
    const newTx: CashflowTransaction = {
      id: `cf-${Date.now()}`,
      referenceNumber: `CF-2024-${Math.floor(200 + Math.random() * 800)}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      title: newTitle || `${newCategory} Voucher`,
      category: newCategory,
      type: newType,
      amount: parseFloat(newAmount) || 0,
      currency: newCurrency,
      account: newAccount,
      recordedBy: 'Mohamed Mohamoud',
      status: 'Completed',
      notes: newNotes
    };
    if (onSaveTransaction) {
      onSaveTransaction(newTx);
    } else {
      setLocalTransactions(prev => [newTx, ...prev]);
    }
    setIsRecordModalOpen(false);
    setNewTitle('');
    setNewAmount('');
    setNewNotes('');
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
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NBC_Cashflow_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryIcon = (category: CashflowCategory) => {
    switch (category) {
      case 'Security & Guards':
        return <Shield className="w-3.5 h-3.5 text-blue-600" />;
      case 'Cleaning & Waste':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Repairs & Maintenance':
        return <Wrench className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <Landmark className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  return (
    <div id="cashflow-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header - Clean & Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Cash Flow & Reserves
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Money in and out, kept separately in dollars and SSP
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            type="button"
            disabled={filteredTransactions.length === 0}
            onClick={() => setPrintJob('list')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-200 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-3.5 h-3.5 text-orange-500" />
            <span>Print list</span>
          </button>

          {onClearAllTransactions && (
            <ClearAllButton count={transactions.length} itemLabel="cashflow entries" onClear={onClearAllTransactions} />
          )}

          <button
            type="button"
            onClick={openNewEntry}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-orange-500/25 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Entry</span>
          </button>
        </div>
      </div>

      {/* Dollar and SSP shown separately */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {totals.map(t => (
          <div key={t.currency} className="relative overflow-hidden bg-white rounded-3xl border border-slate-200/80 shadow-xs">
            <div className={`h-1.5 ${t.currency === 'USD' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`} />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center font-black shadow-md ${
                    t.currency === 'USD' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30' : 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/30 text-[11px]'
                  }`}>
                    {t.currency === 'USD' ? <DollarSign className="w-5 h-5" /> : 'SSP'}
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.currency === 'USD' ? 'Dollar ($)' : 'South Sudanese Pound (SSP)'}</p>
                    <p className="text-[11px] text-slate-400">{t.count} entr{t.count === 1 ? 'y' : 'ies'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrencyFilter(currencyFilter === t.currency ? 'ALL' : t.currency)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                    currencyFilter === t.currency ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {currencyFilter === t.currency ? 'Showing only' : 'Show only'} {t.currency === 'USD' ? '$' : 'SSP'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="rounded-2xl bg-emerald-50 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700"><TrendingUp className="w-3 h-3" /> Collected</span>
                  <span className="block text-base font-black text-emerald-700 truncate">{formatMoney(t.inflow, t.currency)}</span>
                </div>
                <div className="rounded-2xl bg-rose-50 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700"><TrendingDown className="w-3 h-3" /> Spent</span>
                  <span className="block text-base font-black text-rose-700 truncate">{formatMoney(t.outflow, t.currency)}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600"><Wallet className="w-3 h-3" /> Net</span>
                  <span className={`block text-base font-black truncate ${t.net >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    {t.net < 0 ? '-' : ''}{formatMoney(Math.abs(t.net), t.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cashflow Ledger Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Integrated Filter Bar */}
        <div className="p-3.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description, ref #, category..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Filter */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              {(['ALL', 'USD', 'SSP'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrencyFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    currencyFilter === c ? 'bg-white text-orange-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c === 'ALL' ? 'All money' : c === 'USD' ? '$ Dollar' : 'SSP'}
                </button>
              ))}
            </div>
            {/* Type Filter */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              {(['ALL', 'Inflow', 'Outflow'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    typeFilter === type ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'ALL' ? 'All' : type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Ref / Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Account / Facility</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <Wallet className="w-6 h-6 text-slate-400 stroke-[1.5]" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No Cashflow Records Found</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Record revenue inflows or operating expense disbursements to track liquidity.</p>
                      <button
                        type="button"
                        onClick={openNewEntry}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record Inflow / Expense</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-400 block text-[10px]">{t.referenceNumber}</span>
                      <span className="font-semibold text-slate-700">{t.date}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{t.title}</div>
                      {t.notes && <span className="text-[11px] text-slate-400 block mt-0.5">{t.notes}</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-700">
                        {getCategoryIcon(t.category)}
                        <span>{t.category}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-600 font-medium">
                      {t.account}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        t.type === 'Inflow' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {t.type === 'Inflow' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black">
                      <span className={t.type === 'Inflow' ? 'text-emerald-600' : 'text-slate-900'}>
                        {t.type === 'Inflow' ? '+' : '-'}
                        {formatMoney(t.amount, t.currency || 'USD')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingTx(t)}
                          title="View voucher"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintJob(t)}
                          title="Print voucher"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {t.type === 'Outflow' && (
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            title="Edit this outflow"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:text-orange-700 hover:bg-orange-50 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {onDeleteTransaction && (
                          <DeleteButton
                            title="Delete entry"
                            onDelete={() => onDeleteTransaction(t)}
                            confirm={{
                              title: 'Delete this cashflow entry?',
                              subject: `${t.referenceNumber} • ${t.title}`,
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
      </div>

      {/* Record Inflow/Outflow Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingTx ? `Edit ${editingTx.type} — ${editingTx.referenceNumber}` : 'Record Cashflow Transaction'}
              </h3>
              <button
                type="button"
                onClick={() => { setIsRecordModalOpen(false); setEditingTx(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="mt-4 space-y-4">
              
              {/* Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Flow</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('Inflow')}
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newType === 'Inflow'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Inflow (Revenue)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('Outflow')}
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newType === 'Outflow'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Outflow (Expense)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Payee</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Tenant rent or cleaning supplies"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CashflowCategory)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="Rent Collection">Rent Collection</option>
                    <option value="Escrow Deposit">Escrow Deposit</option>
                    <option value="Utilities Surcharge">Utilities Surcharge</option>
                    <option value="Kiosk Permit">Kiosk Permit</option>
                    <option value="Security & Guards">Security & Guards</option>
                    <option value="Cleaning & Waste">Cleaning & Waste</option>
                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                    <option value="Taxes & Licensing">Taxes & Licensing</option>
                    <option value="Staff Payroll">Staff Payroll</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank / Account</label>
                  <select
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value as CashflowTransaction['account'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    {[...ACCOUNTS, ...(ACCOUNTS.includes(newAccount) ? [] : [newAccount])].map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-xl">
                    {(['USD', 'SSP'] as const).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCurrency(c)}
                        className={`py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                          newCurrency === c ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {c === 'USD' ? '$ Dollar' : 'SSP'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount ({newCurrency === 'USD' ? '$' : 'SSP'})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder={newCurrency === 'USD' ? 'e.g. 1500' : 'e.g. 650000'}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Audit Notes / Supplier Voucher</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Receipt # or invoice identifier"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {editingTx ? 'Save changes' : 'Confirm & Post to Float'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Voucher preview */}
      {viewingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto" onClick={() => setViewingTx(null)}>
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
                currencyFilter === 'ALL' ? 'All money' : currencyFilter === 'USD' ? 'Dollar only' : 'SSP only',
                typeFilter === 'ALL' ? 'in & out' : typeFilter,
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
