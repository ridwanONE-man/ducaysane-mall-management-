import React, { useState } from 'react';
import { 
  CreditCard, 
  Download, 
  Printer, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Search,
  Receipt
} from 'lucide-react';
import { PaymentRecord, CurrencyMode, PropertyUnit } from '../types';
import { exportPaymentsToCSV } from '../utils/exportUtils';

interface PaymentsViewProps {
  payments: PaymentRecord[];
  units?: PropertyUnit[];
  currencyMode: CurrencyMode;
  onOpenRecordPayment: () => void;
  onSelectReceiptForPrint: (payment: PaymentRecord) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments,
  units = [],
  currencyMode,
  onOpenRecordPayment,
  onSelectReceiptForPrint
}) => {
  const [search, setSearch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('All');

  // Dynamic calculations
  const totalClearedUSD = payments
    .filter(p => p.currency === 'USD')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalClearedSSP = payments
    .filter(p => p.currency === 'SSP')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalArrearsUSD = units.reduce((sum, u) => sum + (u.arrearsUSD || 0), 0);
  const totalArrearsSSP = units.reduce((sum, u) => sum + (u.arrearsSSP || 0), 0);
  const arrearsCount = units.filter(u => (u.arrearsUSD || 0) > 0 || (u.arrearsSSP || 0) > 0).length;

  const totalExpectedUSD = totalClearedUSD + totalArrearsUSD;
  const collectionRate = totalExpectedUSD > 0 
    ? Math.min(100, Math.round((totalClearedUSD / totalExpectedUSD) * 1000) / 10)
    : (payments.length > 0 ? 100 : 0);

  const filtered = payments.filter(p => {
    const matchesSearch = 
      p.tenantName.toLowerCase().includes(search.toLowerCase()) ||
      p.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.receiptNumber.toLowerCase().includes(search.toLowerCase());
    
    const matchesPeriod = filterPeriod === 'All' || p.accountingPeriod.includes(filterPeriod);
    return matchesSearch && matchesPeriod;
  });

  return (
    <div id="payments-ledger-container" className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header - Clean & Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Payments & Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rental collections, transaction vouchers, and settlement records
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportPaymentsToCSV(payments)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (payments.length > 0) onSelectReceiptForPrint(payments[0]);
            }}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={onOpenRecordPayment}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Unified Minimalist Financial Metric Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3 sm:gap-y-0">
        
        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Collection Rate</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">{collectionRate}%</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full">Target 95%</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Cleared (USD)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-emerald-600">
              ${totalClearedUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">USD</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Cleared (SSP)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">
              {totalClearedSSP.toLocaleString('en-US')}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">SSP</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Arrears</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-rose-600">
              ${totalArrearsUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-rose-500 font-normal">{arrearsCount} units</span>
          </div>
        </div>

      </div>

      {/* Ledger Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Search & Filter Bar */}
        <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt, tenant, unit..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="All">All Periods</option>
              <option value="October 2024">October 2024</option>
              <option value="September 2024">September 2024</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/90 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4">Receipt #</th>
                <th className="p-4">Date & Period</th>
                <th className="p-4">Tenant & Space</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Amount Cleared</th>
                <th className="p-4">Remaining Balance</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Receipt Voucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <Receipt className="w-6 h-6 text-slate-400 stroke-[1.5]" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No Payment Transactions Recorded</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Record rent, partial settlements, or advance payments to build your revenue ledger.</p>
                      <button
                        type="button"
                        onClick={onOpenRecordPayment}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record First Payment</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-700">
                      {item.receiptNumber}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-800">{item.date}</p>
                      <p className="text-[11px] text-slate-400">{item.accountingPeriod}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{item.tenantName}</p>
                      <p className="text-[11px] text-slate-500">{item.unitNumber}</p>
                    </td>
                    <td className="p-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {item.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-900 text-sm">
                      {item.currency === 'USD' ? `$${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `${item.amount.toLocaleString()} SSP`} {item.currency}
                    </td>
                    <td className="p-4 font-semibold">
                      {item.remainingBalance > 0 ? (
                        <span className="text-amber-700">
                          {item.currency === 'USD' ? `$${item.remainingBalance.toFixed(2)}` : `${item.remainingBalance.toLocaleString()} SSP`}
                        </span>
                      ) : (
                        <span className="text-emerald-700">$0.00 (Cleared)</span>
                      )}
                    </td>
                    <td className="p-4">
                      {item.status === 'Paid' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          <CheckCircle className="w-3 h-3" />
                          <span>Paid in Full</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                          <Clock className="w-3 h-3" />
                          <span>Partially Paid</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectReceiptForPrint(item)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Print Voucher</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
