import React from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { PaymentRecord } from '../types';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  payment
}) => {
  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      <div 
        id="printable-receipt-container"
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8 print:shadow-none print:border-none print:my-0"
      >
        {/* Top Modal Controls (hidden when printed) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 print:hidden bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Official Commercial Receipt Voucher</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 space-y-6 print:p-6 text-slate-800">
          
          {/* Header */}
          <div className="flex items-start justify-between pb-5 border-b-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-sm flex items-center justify-center">
                  M
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">MallCore CRE</span>
              </div>
              <p className="text-xs font-semibold text-slate-600">Juba Central Mall Management Office</p>
              <p className="text-[11px] text-slate-400">Plot 14, Commercial District, Juba • Tel: +211 922 400 888</p>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase font-bold tracking-widest text-slate-400 block">Official Receipt</span>
              <span className="text-base font-black text-blue-700">{payment.receiptNumber}</span>
              <p className="text-xs text-slate-500 mt-1">{payment.date}</p>
            </div>
          </div>

          {/* Tenant & Space Details */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Received From</span>
              <p className="font-bold text-slate-900 text-sm">{payment.tenantName}</p>
              <p className="text-slate-500">Tenant ID: {payment.tenantId}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Leased Space / Unit</span>
              <p className="font-bold text-slate-900 text-sm">{payment.unitNumber}</p>
              <p className="text-slate-500">{payment.unitSpace}</p>
            </div>
          </div>

          {/* Allocation Breakdown Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Description & Period</th>
                  <th className="p-3 text-right">Base Rent</th>
                  <th className="p-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="p-3">
                    <p className="font-semibold text-slate-900">Commercial Space Rental</p>
                    <p className="text-[11px] text-slate-500">Billing Period: {payment.accountingPeriod}</p>
                    <p className="text-[11px] text-slate-500">Channel: {payment.paymentMethod}</p>
                  </td>
                  <td className="p-3 text-right font-medium">
                    {payment.currency === 'USD' ? `$${payment.monthlyBaseRent.toFixed(2)}` : `${payment.monthlyBaseRent.toLocaleString()} SSP`}
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-600">
                    {payment.currency === 'USD' ? `$${payment.amount.toFixed(2)}` : `${payment.amount.toLocaleString()} SSP`}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total / Balance Box */}
            <div className="p-4 bg-slate-50/90 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between font-medium text-slate-600">
                <span>Total Due for {payment.accountingPeriod}:</span>
                <span>{payment.currency === 'USD' ? `$${payment.totalDue.toFixed(2)}` : `${payment.totalDue.toLocaleString()} SSP`}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                <span>Total Amount Cleared:</span>
                <span className="text-blue-700">
                  {payment.currency === 'USD' ? `$${payment.amount.toFixed(2)}` : `${payment.amount.toLocaleString()} SSP`} {payment.currency}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-slate-600">Remaining Balance:</span>
                <span className={`font-bold ${payment.remainingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {payment.currency === 'USD' ? `$${payment.remainingBalance.toFixed(2)}` : `${payment.remainingBalance.toLocaleString()} SSP`} ({payment.status})
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div className="text-xs bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-slate-700">
              <span className="font-bold text-blue-900 block mb-0.5">Audit Note:</span>
              <p className="italic text-slate-600">{payment.notes}</p>
            </div>
          )}

          {/* Signatures & Stamp */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 flex items-end">
                <span className="text-[11px] font-mono text-slate-400">{payment.receivedBy || 'D. Deng Bol (Admin)'}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Authorized Officer Signature</p>
            </div>

            <div>
              <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-end">
                <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  OFFICIALLY CLEARED & AUDITED
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold text-right">Mall Corporate Seal</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
