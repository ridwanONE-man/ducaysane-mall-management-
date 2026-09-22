import React, { useState } from 'react';
import { 
  Printer, 
  Search, 
  Download, 
  CreditCard, 
  FileCheck, 
  CheckCircle2, 
  ArrowUpRight, 
  ExternalLink,
  Filter,
  Eye,
  Receipt,
  Plus
} from 'lucide-react';
import { PaymentRecord, CurrencyMode } from '../types';

interface ReceiptsViewProps {
  payments: PaymentRecord[];
  currencyMode: CurrencyMode;
  onSelectReceiptForPrint: (payment: PaymentRecord) => void;
  onOpenRecordPayment: () => void;
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({
  payments,
  currencyMode,
  onSelectReceiptForPrint,
  onOpenRecordPayment
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'SSP'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Paid' | 'Partially Paid'>('ALL');

  // Filter receipts
  const filteredReceipts = payments.filter(p => {
    const matchesSearch = 
      p.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.accountingPeriod.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCurrency = currencyFilter === 'ALL' || p.currency === currencyFilter;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesCurrency && matchesStatus;
  });

  const totalReceiptsUSD = payments
    .filter(p => p.currency === 'USD')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalReceiptsSSP = payments
    .filter(p => p.currency === 'SSP')
    .reduce((sum, p) => sum + p.amount, 0);

  const handleExportCSV = () => {
    const headers = [
      'Receipt #', 'Tenant Name', 'Unit Number', 'Leased Space', 'Date', 
      'Period', 'Currency', 'Amount Paid', 'Base Rent', 'Remaining Balance', 
      'Payment Channel', 'Received By'
    ];
    const rows = filteredReceipts.map(p => [
      p.receiptNumber,
      `"${p.tenantName}"`,
      p.unitNumber,
      `"${p.unitSpace}"`,
      p.date,
      p.accountingPeriod,
      p.currency,
      p.amount.toFixed(2),
      p.monthlyBaseRent.toFixed(2),
      p.remainingBalance.toFixed(2),
      `"${p.paymentMethod}"`,
      `"${p.receivedBy || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MallCore_Receipts_Registry_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSingleReceipt = (p: PaymentRecord) => {
    const text = `
=====================================================
          JUBA CENTRAL COMMERCIAL MALL
            OFFICIAL RENT RECEIPT VOUCHER
=====================================================
Receipt Number: ${p.receiptNumber}
Date Issued:    ${p.date}
Tenant Name:    ${p.tenantName} (ID: ${p.tenantId})
Space Leased:   ${p.unitNumber} - ${p.unitSpace}
Billing Period: ${p.accountingPeriod}

Financial Breakdown:
-----------------------------------------------------
Monthly Base Rent:     ${p.currency === 'USD' ? `$${p.monthlyBaseRent.toFixed(2)}` : `${p.monthlyBaseRent.toLocaleString()} SSP`}
Arrears Brought Fwd:   ${p.currency === 'USD' ? `$${p.previousArrears.toFixed(2)}` : `${p.previousArrears.toLocaleString()} SSP`}
Total Gross Due:       ${p.currency === 'USD' ? `$${p.totalDue.toFixed(2)}` : `${p.totalDue.toLocaleString()} SSP`}

AMOUNT CLEARED & PAID: ${p.currency === 'USD' ? `$${p.amount.toFixed(2)} USD` : `${p.amount.toLocaleString()} SSP`}
Remaining Balance:     ${p.currency === 'USD' ? `$${p.remainingBalance.toFixed(2)}` : `${p.remainingBalance.toLocaleString()} SSP`}
Advance Credit:        ${p.currency === 'USD' ? `$${p.advanceBalance.toFixed(2)}` : `${p.advanceBalance.toLocaleString()} SSP`}

Payment Method: ${p.paymentMethod}
Authorized By:  ${p.receivedBy || 'Management Desk'}
Status:         ${p.status.toUpperCase()}
=====================================================
Generated electronically by MallCore Enterprise CRE.
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.receiptNumber}_Receipt.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="receipts-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header - Clean & Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Receipt Vouchers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequential payment vouchers and printable audit slips
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
            onClick={onOpenRecordPayment}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Issue Receipt</span>
          </button>
        </div>
      </div>

      {/* Unified Minimalist Metric Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3 sm:gap-y-0">
        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Total Issued</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">{payments.length}</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full">Audited</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Total (USD)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-emerald-600">${totalReceiptsUSD.toLocaleString()}</span>
            <span className="text-[11px] text-slate-400 font-normal">USD</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Total (SSP)</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">{totalReceiptsSSP.toLocaleString()}</span>
            <span className="text-[11px] text-slate-400 font-normal">SSP</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Integrated Filter and Search Bar */}
        <div className="p-3.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search receipt #, tenant, unit..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Filter */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              {(['ALL', 'USD', 'SSP'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrencyFilter(curr)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    currencyFilter === curr ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              {(['ALL', 'Paid', 'Partially Paid'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    statusFilter === st ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Receipt Number</th>
                <th className="py-3 px-4">Tenant / Space</th>
                <th className="py-3 px-4">Date Issued</th>
                <th className="py-3 px-4">Accounting Period</th>
                <th className="py-3 px-4">Payment Channel</th>
                <th className="py-3 px-4">Amount Paid</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <Receipt className="w-6 h-6 text-slate-400 stroke-[1.5]" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No Payment Receipts Generated</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Official receipts are automatically generated whenever rent or fees are collected.</p>
                      <button
                        type="button"
                        onClick={onOpenRecordPayment}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Issue First Receipt</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {p.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.tenantName}</div>
                      <span className="text-[10px] text-slate-400">{p.unitSpace}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {p.date}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {p.accountingPeriod}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-500 max-w-[150px] truncate">
                      {p.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      {p.currency === 'USD' ? `$${p.amount.toFixed(2)}` : `${p.amount.toLocaleString()} SSP`}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectReceiptForPrint(p)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                          title="Print / View Receipt Voucher"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleReceipt(p)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Download Text Receipt"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
