import React, { useState } from 'react';
import { Printer, Search, Download, CheckCircle2, Receipt, Plus, DollarSign, Wallet, CircleDashed, CalendarRange } from 'lucide-react';
import { PaymentRecord, CurrencyMode } from '../types';
import { DeleteButton, ClearAllButton } from './DeleteControls';
import { formatMoney, formatLongDate, parsePaymentDate } from '../utils/printUtils';
import { MONTH_NAMES } from '../utils/rentLedger';

type PeriodMode = 'all' | 'month' | 'year' | 'day' | 'range';
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface ReceiptsViewProps {
  payments: PaymentRecord[];
  currencyMode: CurrencyMode;
  onSelectReceiptForPrint: (payment: PaymentRecord) => void;
  onOpenRecordPayment: () => void;
  onDeletePayment?: (payment: PaymentRecord) => void;
  onClearAllPayments?: () => void;
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({
  payments,
  currencyMode,
  onSelectReceiptForPrint,
  onOpenRecordPayment,
  onDeletePayment,
  onClearAllPayments
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Paid' | 'Partially Paid'>('ALL');

  // Period: only receipts issued inside it are counted and listed
  const today = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [day, setDay] = useState(toISO(today));
  const [fromDate, setFromDate] = useState(toISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toISO(today));

  const inPeriod = (p: PaymentRecord) => {
    if (periodMode === 'all') return true;
    const d = parsePaymentDate(p.date);
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
  const periodReceipts = payments.filter(inPeriod);
  const availableYears = [...new Set([today.getFullYear(), ...payments.map(p => parsePaymentDate(p.date)?.getFullYear()).filter((y): y is number => Boolean(y))])]
    .sort((a, b) => b - a);

  // Filter receipts
  const filteredReceipts = periodReceipts.filter(p => {
    const matchesSearch = 
      p.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.accountingPeriod.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalReceiptsUSD = periodReceipts
    .filter(p => p.currency === 'USD')
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
    link.setAttribute('download', `NBC_Receipts_Registry_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSingleReceipt = (p: PaymentRecord) => {
    const text = `
=====================================================
            NYAKURON BUSINESS CENTRE
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

Payment Method: ${p.paymentMethod}
Authorized By:  ${p.receivedBy || 'Mohamed Mohamoud'}
Status:         ${p.status.toUpperCase()}
=====================================================
Generated electronically by Nyakuron Business Centre Management.
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

  const totalSSP = periodReceipts.filter(p => p.currency === 'SSP').reduce((sum, p) => sum + p.amount, 0);
  const partialCount = periodReceipts.filter(p => p.status === 'Partially Paid').length;
  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const selectCls = 'px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500';

  const metrics = [
    { label: 'Receipts issued', value: String(periodReceipts.length), icon: Receipt, tone: 'from-orange-500 to-amber-500 shadow-orange-500/30' },
    { label: 'Collected in dollars', value: formatMoney(totalReceiptsUSD, 'USD'), icon: DollarSign, tone: 'from-emerald-500 to-teal-500 shadow-emerald-500/30' },
    { label: 'Collected in SSP', value: formatMoney(totalSSP, 'SSP'), icon: Wallet, tone: 'from-sky-500 to-blue-500 shadow-sky-500/30' },
    { label: 'Partly paid', value: String(partialCount), icon: CircleDashed, tone: 'from-slate-600 to-slate-800 shadow-slate-500/30' },
  ];

  return (
    <div id="receipts-view" className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Receipt className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Receipt Vouchers</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Every rent receipt in order — view, print or download.</p>
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
            {onClearAllPayments && (
              <ClearAllButton
                count={payments.length}
                itemLabel="receipts"
                onClear={onClearAllPayments}
                message="Every receipt is a payment record, so all payments are removed from the database. This cannot be undone."
              />
            )}
            <button data-edit
              type="button"
              onClick={onOpenRecordPayment}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-extrabold shadow-md shadow-orange-500/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Issue Receipt
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3">
            <span className={`w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br ${m.tone} text-white flex items-center justify-center shadow-md`}>
              <m.icon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold text-slate-500">{m.label}</span>
              <span className="block text-lg font-black text-slate-900 truncate">{m.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search receipt #, tenant, unit, month..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          {/* Period */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="w-4 h-4 text-orange-500" />
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
              {([['all', 'All'], ['month', 'Month'], ['year', 'Year'], ['day', 'Day'], ['range', 'Custom']] as [PeriodMode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPeriodMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            {periodMode === 'day' && <input type="date" value={day} onChange={e => setDay(e.target.value)} className={selectCls} />}
            {periodMode === 'range' && (
              <span className="flex items-center gap-1.5">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={selectCls} />
                <span className="text-xs font-bold text-slate-400">to</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={selectCls} />
              </span>
            )}
          </div>
          </div>
          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl self-start xl:self-auto">
            {(['ALL', 'Paid', 'Partially Paid'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'Paid' ? 'Paid' : 'Partly paid'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Receipt Number</th>
                <th className="py-3 px-4">Tenant / Space</th>
                <th className="py-3 px-4">Date Issued</th>
                <th className="py-3 px-4">Accounting Period</th>
                <th className="py-3 px-4">Payment Channel</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-14 text-center">
                    <div className="w-14 h-14 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3">
                      <Receipt className="w-7 h-7" />
                    </div>
                    <p className="font-extrabold text-slate-900 text-sm">{payments.length === 0 ? 'No receipts yet' : periodReceipts.length === 0 ? `No receipts in ${periodLabel}` : 'No matching receipts'}</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">Receipts are created automatically whenever rent is paid.</p>
                    <button data-edit
                      type="button"
                      onClick={onOpenRecordPayment}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Issue Receipt
                    </button>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((p, i) => (
                  <tr key={p.id} className={`hover:bg-orange-50/40 transition-colors ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectReceiptForPrint(p)}
                        title="Open receipt"
                        className="font-mono text-[11px] font-black text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-lg cursor-pointer"
                      >
                        {p.receiptNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 shrink-0 rounded-xl bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">{initials(p.tenantName)}</span>
                        <div className="min-w-0 max-w-[200px]">
                          <div className="font-bold text-slate-900 truncate">{p.tenantName}</div>
                          <span className="text-[10px] text-slate-400 truncate block">{p.unitSpace}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{p.date}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">{p.accountingPeriod}</span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 max-w-[150px] truncate">{p.paymentMethod}</td>
                    <td className="py-3 px-4 text-right font-black text-sm text-slate-900 whitespace-nowrap">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${
                        p.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status === 'Paid' ? <CheckCircle2 className="w-3 h-3" /> : <CircleDashed className="w-3 h-3" />}
                        {p.status === 'Paid' ? 'Paid' : 'Partly paid'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectReceiptForPrint(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                          title="View / print receipt"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleReceipt(p)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 cursor-pointer"
                          title="Download text receipt"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {onDeletePayment && (
                          <DeleteButton
                            title="Delete receipt"
                            onDelete={() => onDeletePayment(p)}
                            confirm={{
                              title: 'Delete this receipt?',
                              subject: `${p.receiptNumber} • ${p.tenantName}`,
                              message: 'The receipt and its payment record are removed from the database. This cannot be undone.',
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
        {filteredReceipts.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
            Showing <strong className="text-slate-900">{filteredReceipts.length}</strong> of {periodReceipts.length} receipts in {periodLabel}
          </div>
        )}
      </div>
    </div>
  );
};
