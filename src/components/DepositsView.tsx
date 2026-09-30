import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Download, 
  Plus, 
  Landmark, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  RefreshCw,
  Eye,
  FileText,
  Store,
  DollarSign,
  Calendar,
  X
} from 'lucide-react';
import { DepositRecord, PropertyUnit } from '../types';
import { initialDeposits } from '../data/commercialData';

interface DepositsViewProps {
  units: PropertyUnit[];
  deposits?: DepositRecord[];
  onSaveDeposit?: (deposit: DepositRecord) => void;
  onSaveUnit?: (unit: PropertyUnit) => void;
  onOpenReceiptPrint?: (deposit: DepositRecord) => void;
}

export const DepositsView: React.FC<DepositsViewProps> = ({
  units,
  deposits: propDeposits,
  onSaveDeposit,
  onSaveUnit
}) => {
  const [localDeposits, setLocalDeposits] = useState<DepositRecord[]>(initialDeposits);
  const deposits = propDeposits || localDeposits;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Held in Escrow' | 'Under Review' | 'Refunded'>('ALL');
  
  // Modals
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedDepositForRefund, setSelectedDepositForRefund] = useState<DepositRecord | null>(null);

  // New Deposit Form State
  const [selectedUnitId, setSelectedUnitId] = useState<string>(units[0]?.id || '');
  const [depositMonthsOption, setDepositMonthsOption] = useState<number>(2);
  const [isCustomAmount, setIsCustomAmount] = useState<boolean>(false);
  const [customAmountUSD, setCustomAmountUSD] = useState<string>('');
  const [depositSlipNumber, setDepositSlipNumber] = useState<string>(`DEP-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [bankAccount, setBankAccount] = useState('Stanbic Bank - Escrow Liability #8892-01');
  const [notes, setNotes] = useState('');

  // Selected unit for form
  const selectedUnit = units.find(u => u.id === selectedUnitId) || units[0] || null;
  const unitRent = selectedUnit?.monthlyRateUSD || 500;
  const calculatedAmount = isCustomAmount 
    ? (parseFloat(customAmountUSD) || 0) 
    : unitRent * depositMonthsOption;

  // Filtered deposits
  const filteredDeposits = deposits.filter(d => {
    const matchesSearch = 
      d.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.bankAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.depositSlip && d.depositSlip.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregate metrics
  const activeDeposits = deposits.filter(d => d.status === 'Held in Escrow');
  const totalUSD = activeDeposits.reduce((sum, d) => sum + d.amountUSD, 0);
  const refundedUSD = deposits
    .filter(d => d.status === 'Refunded')
    .reduce((sum, d) => sum + d.amountUSD, 0);

  // Handlers
  const handleCollectDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    const tenantName = selectedUnit.currentTenant?.name || 'Commercial Tenant';
    const effectiveMonths = isCustomAmount 
      ? Math.max(1, Math.round(calculatedAmount / (unitRent || 1))) 
      : depositMonthsOption;

    const newDep: DepositRecord = {
      id: `dep-${Date.now()}`,
      depositSlip: depositSlipNumber || `DEP-2026-${Math.floor(100 + Math.random() * 900)}`,
      tenantName,
      tenantId: selectedUnit.currentTenant?.id,
      unitNumber: selectedUnit.unitNumber,
      amountUSD: calculatedAmount,
      amountSSP: 0,
      depositMonths: effectiveMonths,
      monthlyRentUSD: unitRent,
      heldSince: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Held in Escrow',
      bankAccount,
      notes: notes.trim() || `Security deposit of ${effectiveMonths} month(s) rent ($${calculatedAmount.toLocaleString()}) held in segregated escrow.`
    };

    if (onSaveDeposit) {
      onSaveDeposit(newDep);
    } else {
      setLocalDeposits(prev => [newDep, ...prev]);
    }

    // Also update corresponding unit so deposit status is connected everywhere
    if (onSaveUnit) {
      const updatedUnit: PropertyUnit = {
        ...selectedUnit,
        escrowDepositUSD: calculatedAmount,
        depositMonths: effectiveMonths
      };
      onSaveUnit(updatedUnit);
    }

    setIsCollectModalOpen(false);
    setDepositSlipNumber(`DEP-2026-${Math.floor(100 + Math.random() * 900)}`);
    setNotes('');
  };

  const handleConfirmRefund = () => {
    if (!selectedDepositForRefund) return;
    const updated: DepositRecord = { 
      ...selectedDepositForRefund, 
      status: 'Refunded', 
      notes: 'Security deposit released and refunded upon satisfactory lease clearance.' 
    };

    if (onSaveDeposit) {
      onSaveDeposit(updated);
    } else {
      setLocalDeposits(prev => prev.map(d => d.id === updated.id ? updated : d));
    }

    // Reset escrow deposit on the unit if it matches
    const unitMatch = units.find(u => u.unitNumber === selectedDepositForRefund.unitNumber);
    if (unitMatch && onSaveUnit) {
      onSaveUnit({
        ...unitMatch,
        escrowDepositUSD: 0,
        depositMonths: 0
      });
    }

    setIsRefundModalOpen(false);
    setSelectedDepositForRefund(null);
  };

  const handleExportCSV = () => {
    const headers = ['Deposit ID', 'Tenant Name', 'Unit Number', 'Amount USD', 'Months Covered', 'Held Since', 'Status', 'Escrow Account'];
    const rows = filteredDeposits.map(d => [
      d.depositSlip || d.id,
      `"${d.tenantName}"`,
      d.unitNumber,
      d.amountUSD.toFixed(2),
      d.depositMonths ? `${d.depositMonths} mo` : 'N/A',
      d.heldSince,
      d.status,
      `"${d.bankAccount}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NBC_Escrow_Deposits_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="deposits-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <span>Nyakuron Business Centre</span>
            <span>›</span>
            <span className="text-blue-600">Escrow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Security & Escrow Deposits
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administer multi-month lease security deposits, segregated trust reserves, and return vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollectModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tenant Deposit</span>
          </button>
        </div>
      </div>

      {/* Escrow Metric Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3 sm:gap-y-0">
        
        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Total Escrow Reserve (USD)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">${totalUSD.toLocaleString()} USD</span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Segregated
            </span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Protected Leases</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-blue-600">
              {activeDeposits.length}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Active Tenancies</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Refunded / Settled Reserves</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-600">
              ${refundedUSD.toLocaleString()} USD
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Released</span>
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
                <th className="py-3 px-4">Security Deposit (USD)</th>
                <th className="py-3 px-4">Coverage</th>
                <th className="py-3 px-4">Depository Bank</th>
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
                      <p className="font-bold text-slate-800 text-sm">No Escrow Deposits Found</p>
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
                filteredDeposits.map((d) => {
                  const unitMatch = units.find(u => u.unitNumber === d.unitNumber);
                  const isShop = unitMatch?.type === 'Shop' || unitMatch?.categoryType === 'Shop' || d.unitNumber.startsWith('G');
                  const mos = d.depositMonths || (d.monthlyRentUSD && d.amountUSD ? Math.max(1, Math.round(d.amountUSD / d.monthlyRentUSD)) : 2);

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{d.tenantName}</div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {d.depositSlip || d.id}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isShop ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {d.unitNumber}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {isShop ? 'Shop' : 'Space'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        ${d.amountUSD.toLocaleString()} USD
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {mos} Month(s) Rent
                        </span>
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
                            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title="Refund upon lease termination"
                          >
                            Release
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect / Add Escrow Deposit Modal */}
      {isCollectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add Security Deposit
                  </h3>
                  <p className="text-xs text-slate-500">Hold multi-month security deposit in segregated escrow</p>
                </div>
              </div>
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCollectDeposit} className="p-6 space-y-4 text-xs">
              
              {/* Select Tenant / Leased Unit (Shop or Space) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Leased Space & Tenant <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber} ({u.categoryType || u.type}) — {u.currentTenant?.name || 'Available Space'} (${u.monthlyRateUSD}/mo)
                    </option>
                  ))}
                </select>
              </div>

              {/* Monthly Base Rent Info */}
              {selectedUnit && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Tenant</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {selectedUnit.currentTenant?.name || 'Walk-in / New Tenant'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Monthly Base Rent</span>
                    <span className="font-bold text-blue-600 text-xs">
                      ${unitRent.toLocaleString()} USD
                    </span>
                  </div>
                </div>
              )}

              {/* Months to Deposit Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deposit Coverage (Months of Rent) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3].map(months => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => {
                        setIsCustomAmount(false);
                        setDepositMonthsOption(months);
                      }}
                      className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                        !isCustomAmount && depositMonthsOption === months
                          ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {months} Mo
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomAmount(true);
                      setCustomAmountUSD(String(unitRent * 2));
                    }}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                      isCustomAmount
                        ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {isCustomAmount && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custom Deposit Amount (USD $)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={customAmountUSD}
                      onChange={(e) => setCustomAmountUSD(e.target.value)}
                      placeholder="Enter amount in USD"
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* Real-time deposit total card */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-800 block">Total Deposit Required</span>
                  <span className="text-lg font-black text-blue-900">
                    ${calculatedAmount.toLocaleString()} USD
                  </span>
                </div>
                <div className="text-right text-[11px] text-blue-700 font-semibold">
                  {isCustomAmount ? 'Custom Amount' : `${depositMonthsOption} × $${unitRent} / mo`}
                </div>
              </div>

              {/* Deposit Slip & Bank */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deposit Slip / Receipt #</label>
                  <input
                    type="text"
                    value={depositSlipNumber}
                    onChange={(e) => setDepositSlipNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Depository Trust Bank</label>
                  <select
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600 truncate"
                  >
                    <option value="Stanbic Bank - Escrow Liability #8892-01">Stanbic Bank (Escrow)</option>
                    <option value="Central Vault Cash Float - Nyakuron">Central Vault Cash Float</option>
                    <option value="Ecobank Commercial Escrow #4410-09">Ecobank Escrow</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes & Lease Reference</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Security deposit terms, condition of return, receipt notes..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record & Hold Escrow Deposit</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Refund / Release Confirmation Modal */}
      {isRefundModalOpen && selectedDepositForRefund && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Release & Refund Escrow Deposit?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Release security deposit of <strong>${selectedDepositForRefund.amountUSD.toLocaleString()} USD</strong> for <strong>{selectedDepositForRefund.tenantName}</strong> ({selectedDepositForRefund.unitNumber}).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Confirm Release & Settle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
