import React, { useState } from 'react';
import { 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Download, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Fuel, 
  Shield, 
  Sparkles, 
  Wrench, 
  FileSpreadsheet, 
  CheckCircle2,
  DollarSign,
  Wallet
} from 'lucide-react';
import { CashflowTransaction, CurrencyMode, CashflowCategory } from '../types';
import { initialCashflowTransactions } from '../data/commercialData';

interface CashflowViewProps {
  currencyMode: CurrencyMode;
  transactions?: CashflowTransaction[];
  onSaveTransaction?: (tx: CashflowTransaction) => void;
}

export const CashflowView: React.FC<CashflowViewProps> = ({ 
  currencyMode,
  transactions: propTransactions,
  onSaveTransaction
}) => {
  const [localTransactions, setLocalTransactions] = useState<CashflowTransaction[]>(initialCashflowTransactions);
  const transactions = propTransactions || localTransactions;
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Inflow' | 'Outflow'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'SSP'>('ALL');

  // Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'Inflow' | 'Outflow'>('Inflow');
  const [newCategory, setNewCategory] = useState<CashflowCategory>('Rent Collection');
  const [newAmount, setNewAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState<'USD' | 'SSP'>('USD');
  const [newAccount, setNewAccount] = useState<'Central Vault Cash Float' | 'Stanbic Bank Operating' | 'Ecobank Operating'>('Central Vault Cash Float');
  const [newNotes, setNewNotes] = useState('');

  // Calculations
  const totalInflowUSD = transactions
    .filter(t => t.type === 'Inflow' && t.currency === 'USD')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflowUSD = transactions
    .filter(t => t.type === 'Outflow' && t.currency === 'USD')
    .reduce((sum, t) => sum + t.amount, 0);

  const netUSD = totalInflowUSD - totalOutflowUSD;

  const totalInflowSSP = transactions
    .filter(t => t.type === 'Inflow' && t.currency === 'SSP')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflowSSP = transactions
    .filter(t => t.type === 'Outflow' && t.currency === 'SSP')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSSP = totalInflowSSP - totalOutflowSSP;

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.account.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesCurrency = currencyFilter === 'ALL' || t.currency === currencyFilter;
    return matchesSearch && matchesType && matchesCurrency;
  });

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
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
      case 'Diesel & Generator':
        return <Fuel className="w-3.5 h-3.5 text-amber-600" />;
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
            Operational expenses, generator fuel, and treasury float reconciliation
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
            onClick={() => setIsRecordModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Entry</span>
          </button>
        </div>
      </div>

      {/* Unified Minimalist Cashflow Metric Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3 sm:gap-y-0">
        
        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Reserve Float</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">$58,420</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full">Vault</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Net USD</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-2xl font-bold ${netUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {netUSD >= 0 ? `+$${netUSD.toLocaleString()}` : `-$${Math.abs(netUSD).toLocaleString()}`}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">USD</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Net SSP</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-2xl font-bold ${netSSP >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {netSSP >= 0 ? `+${netSSP.toLocaleString()}` : `-${Math.abs(netSSP).toLocaleString()}`}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">SSP</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Diesel Fuel</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-amber-600">$3,250</span>
            <span className="text-[11px] text-amber-700 font-medium">2,500 L</span>
          </div>
        </div>

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

            {/* Currency Filter */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              {(['ALL', 'USD', 'SSP'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrencyFilter(curr)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    currencyFilter === curr ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {curr}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <Wallet className="w-6 h-6 text-slate-400 stroke-[1.5]" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No Cashflow Records Found</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Record revenue inflows or operating expense disbursements to track liquidity.</p>
                      <button
                        type="button"
                        onClick={() => setIsRecordModalOpen(true)}
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
                        {t.currency === 'USD' ? `$${t.amount.toLocaleString()}` : `${t.amount.toLocaleString()} SSP`}
                      </span>
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
              <h3 className="text-base font-bold text-slate-900">Record Cashflow Transaction</h3>
              <button 
                onClick={() => setIsRecordModalOpen(false)}
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
                  placeholder="e.g. Generator Fuel delivery 2,000L or Tenant Rent"
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
                    <option value="Diesel & Generator">Diesel & Generator</option>
                    <option value="Security & Guards">Security & Guards</option>
                    <option value="Cleaning & Waste">Cleaning & Waste</option>
                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                    <option value="Taxes & Licensing">Taxes & Licensing</option>
                    <option value="Staff Payroll">Staff Payroll</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Disbursement Account</label>
                  <select
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="Central Vault Cash Float">Central Vault Cash Float</option>
                    <option value="Stanbic Bank Operating">Stanbic Bank Operating</option>
                    <option value="Ecobank Operating">Ecobank Operating</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as 'USD' | 'SSP')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="SSP">SSP (South Sudanese Pound)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="e.g. 1500"
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Confirm & Post to Float
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
