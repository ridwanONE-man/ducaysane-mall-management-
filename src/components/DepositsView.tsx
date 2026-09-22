import React, { useState } from 'react';
import { 
  Lock, 
  Search, 
  Download, 
  Plus, 
  ShieldCheck, 
  Landmark, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  RefreshCw,
  Eye,
  FileText
} from 'lucide-react';
import { DepositRecord, PropertyUnit, CurrencyMode } from '../types';
import { initialDeposits } from '../data/commercialData';

interface DepositsViewProps {
  units: PropertyUnit[];
  currencyMode: CurrencyMode;
  onOpenReceiptPrint?: (deposit: DepositRecord) => void;
}

export const DepositsView: React.FC<DepositsViewProps> = ({
  units,
  currencyMode,
  onOpenReceiptPrint
}) => {
  const [deposits, setDeposits] = useState<DepositRecord[]>(initialDeposits);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Held in Escrow' | 'Under Review' | 'Refunded'>('ALL');
  
  // Modals
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedDepositForRefund, setSelectedDepositForRefund] = useState<DepositRecord | null>(null);

  // New Deposit Form State
  const [newTenantName, setNewTenantName] = useState('');
  const [newUnitNumber, setNewUnitNumber] = useState(units[0]?.unitNumber || '');
  const [newAmountUSD, setNewAmountUSD] = useState('');
  const [newAmountSSP, setNewAmountSSP] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('Stanbic Bank - Escrow Liability #8892-01');

  // Filtered deposits
  const filteredDeposits = deposits.filter(d => {
    const matchesSearch = 
      d.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.bankAccount.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregate metrics
  const totalUSD = deposits
    .filter(d => d.status === 'Held in Escrow')
    .reduce((sum, d) => sum + d.amountUSD, 0);

  const totalSSP = deposits
    .filter(d => d.status === 'Held in Escrow')
    .reduce((sum, d) => sum + d.amountSSP, 0);

  // Handlers
  const handleCollectDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const newDep: DepositRecord = {
      id: `dep-${Date.now()}`,
      depositSlip: `DEP-2024-${Math.floor(100 + Math.random() * 900)}`,
      tenantName: newTenantName || 'New Commercial Tenant',
      unitNumber: newUnitNumber,
      amountUSD: parseFloat(newAmountUSD) || 0,
      amountSSP: parseFloat(newAmountSSP) || 0,
      heldSince: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Held in Escrow',
      bankAccount: newBankAccount,
      notes: 'Initial lease security deposit held in segregation.'
    };
    setDeposits(prev => [newDep, ...prev]);
    setIsCollectModalOpen(false);
    setNewTenantName('');
  };

  const handleConfirmRefund = () => {
    if (!selectedDepositForRefund) return;
    setDeposits(prev => prev.map(d => {
      if (d.id === selectedDepositForRefund.id) {
        return { ...d, status: 'Refunded', notes: 'Deposit released upon satisfactory lease termination.' };
      }
      return d;
    }));
    setIsRefundModalOpen(false);
    setSelectedDepositForRefund(null);
  };

  const handleExportCSV = () => {
    const headers = ['Deposit ID', 'Tenant Name', 'Unit Number', 'Amount USD', 'Amount SSP', 'Held Since', 'Status', 'Escrow Account'];
    const rows = filteredDeposits.map(d => [
      d.depositSlip || d.id,
      `"${d.tenantName}"`,
      d.unitNumber,
      d.amountUSD.toFixed(2),
      d.amountSSP.toString(),
      d.heldSince,
      d.status,
      `"${d.bankAccount}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MallCore_Escrow_Deposits_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="deposits-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header - Clean & Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Escrow Deposits
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Security deposits and segregated lease escrow reserves
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
            onClick={() => setIsCollectModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Collect Deposit</span>
          </button>
        </div>
      </div>

      {/* Unified Minimalist Escrow Metric Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3 sm:gap-y-0">
        
        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Total Escrow (USD)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">${totalUSD.toLocaleString()}</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full">Segregated</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Total Escrow (SSP)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">{totalSSP.toLocaleString()}</span>
            <span className="text-[11px] text-slate-400 font-normal">SSP</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Active Guarantees</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">
              {deposits.filter(d => d.status === 'Held in Escrow').length}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Active accounts</span>
          </div>
        </div>

      </div>

      {/* Escrow Deposits Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Integrated Filter and Search Bar */}
        <div className="p-3.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tenant, unit, slip..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
            {(['ALL', 'Held in Escrow', 'Under Review', 'Refunded'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Slip / Tenant</th>
                <th className="py-3 px-4">Leased Space</th>
                <th className="py-3 px-4">Escrow Balance (USD)</th>
                <th className="py-3 px-4">Escrow Balance (SSP)</th>
                <th className="py-3 px-4">Depository Account</th>
                <th className="py-3 px-4">Held Since</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <ShieldCheck className="w-6 h-6 text-slate-400 stroke-[1.5]" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No Escrow Deposits Registered</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Record security deposits held in segregated bank escrow for commercial leases.</p>
                      <button
                        type="button"
                        onClick={() => setIsCollectModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Collect Escrow Deposit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{d.tenantName}</div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {d.depositSlip || d.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {d.unitNumber}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ${d.amountUSD.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      {d.amountSSP.toLocaleString()} SSP
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-500">
                      {d.bankAccount}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {d.heldSince}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        d.status === 'Held in Escrow'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : d.status === 'Under Review'
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          d.status === 'Held in Escrow' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {d.status === 'Held in Escrow' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDepositForRefund(d);
                            setIsRefundModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="Refund upon lease termination"
                        >
                          Release
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium italic">Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Deposit Modal */}
      {isCollectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Lock className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Collect Escrow Security Deposit</h3>
              </div>
              <button 
                onClick={() => setIsCollectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCollectDeposit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tenant Commercial Name</label>
                <input
                  type="text"
                  required
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="e.g. Nile Traders Ltd"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Leased Space</label>
                  <select
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                  >
                    {units.map(u => (
                      <option key={u.id} value={u.unitNumber}>{u.unitNumber} ({u.floor})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Escrow Bank Trust Account</label>
                  <select
                    value={newBankAccount}
                    onChange={(e) => setNewBankAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                  >
                    <option value="Stanbic Bank - Escrow Liability #8892-01">Stanbic Bank #8892-01</option>
                    <option value="Ecobank - Commercial Trust #4410-02">Ecobank Trust #4410-02</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (USD)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1850"
                    value={newAmountUSD}
                    onChange={(e) => {
                      setNewAmountUSD(e.target.value);
                      const ssp = (parseFloat(e.target.value) || 0) * 1300;
                      setNewAmountSSP(e.target.value ? ssp.toString() : '');
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (SSP equivalent)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2405000"
                    value={newAmountSSP}
                    onChange={(e) => setNewAmountSSP(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Escrow deposits are held in a legally segregated liability trust and cannot be co-mingled with mall operating revenue.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Lock Deposit into Escrow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release/Refund Modal */}
      {isRefundModalOpen && selectedDepositForRefund && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Release Escrow Security Deposit</h3>
            <p className="text-xs text-slate-500 mt-1">
              Confirm release of funds for <span className="font-bold text-slate-800">{selectedDepositForRefund.tenantName}</span> ({selectedDepositForRefund.unitNumber}).
            </p>

            <div className="my-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Amount (USD):</span>
                <span className="font-bold text-slate-900">${selectedDepositForRefund.amountUSD.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Amount (SSP):</span>
                <span className="font-bold text-slate-900">{selectedDepositForRefund.amountSSP.toLocaleString()} SSP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Held Since:</span>
                <span className="font-semibold text-slate-700">{selectedDepositForRefund.heldSince}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Confirm Release & Issue Voucher
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
