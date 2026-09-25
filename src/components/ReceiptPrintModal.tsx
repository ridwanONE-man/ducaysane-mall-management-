import React from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { PaymentRecord } from '../types';
import { numberToWords } from '../utils/numberToWords';
import logoImg from '../assets/logo.png';

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

  const amountInWords = numberToWords(payment.amount, payment.currency);

  // Format date to DD/MM/YYYY if possible
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div 
        id="printable-receipt-container"
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8 print:shadow-none print:border-none print:my-0 print:max-w-none print:w-full print:rounded-none"
      >
        {/* Top Modal Controls (hidden when printed) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 print:hidden bg-slate-50/70">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Official Commercial Receipt Voucher</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-orange-500/20 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body (Physical Booklet Replication) */}
        <div className="p-8 sm:p-10 space-y-6 text-slate-900 print:p-8 font-sans">
          
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
            {/* Logo */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-2 ring-orange-500/40 p-1 flex items-center justify-center shrink-0">
              <img
                src={logoImg}
                alt="Nyakuron Business Centre"
                className="w-full h-full object-contain rounded-full"
              />
            </div>

            {/* Centre Title & Details */}
            <div className="text-center flex-1">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                NYAKURON BUSINESS CENTRE
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">
                Located at: Nyakuron East, Juba - South Sudan
              </p>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium mt-0.5">
                Tel: +211 928 223 154 / +211 924 991 131 / +211 921 515 150
              </p>
            </div>

            {/* Receipt Number & Date Box */}
            <div className="text-right shrink-0">
              <div className="border-2 border-rose-600 rounded-xl px-3 py-1.5 bg-rose-50/50 inline-block text-left mb-2">
                <span className="text-[10px] uppercase font-bold text-rose-700 block leading-tight">Receipt No.</span>
                <span className="text-base font-black text-rose-700 font-mono tracking-wider">{payment.receiptNumber}</span>
              </div>
              <div className="text-xs font-semibold text-slate-700">
                <span className="text-slate-500 mr-1">Date:</span>
                <span className="font-bold underline decoration-slate-400 decoration-1 underline-offset-4">
                  {formatDate(payment.date)}
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields Ruled Like Official Booklet */}
          <div className="space-y-4 pt-2 text-sm">
            
            {/* Received from */}
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-slate-800 uppercase tracking-wide text-xs shrink-0 w-32">
                Received From:
              </span>
              <div className="flex-1 border-b border-dotted border-slate-700 pb-1 font-bold text-slate-900 text-base">
                {payment.tenantName} {payment.tenantId ? `(${payment.tenantId})` : ''}
              </div>
            </div>

            {/* Amount in words */}
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-slate-800 uppercase tracking-wide text-xs shrink-0 w-32">
                Amount in Words:
              </span>
              <div className="flex-1 border-b border-dotted border-slate-700 pb-1 italic font-semibold text-slate-800 text-xs sm:text-sm leading-relaxed">
                {amountInWords}
              </div>
            </div>

            {/* Being payment of */}
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-slate-800 uppercase tracking-wide text-xs shrink-0 w-32">
                Being Payment of:
              </span>
              <div className="flex-1 border-b border-dotted border-slate-700 pb-1 font-medium text-slate-800 text-xs sm:text-sm">
                Rent for <strong className="text-slate-950 font-bold">{payment.accountingPeriod}</strong> • Unit <strong className="text-slate-950 font-bold">{payment.unitNumber}</strong> {payment.unitSpace ? `(${payment.unitSpace})` : ''}
              </div>
            </div>

            {/* Payment Channel & Received By */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-slate-800 uppercase tracking-wide text-xs shrink-0 w-32">
                  Payment Method:
                </span>
                <div className="flex-1 border-b border-dotted border-slate-700 pb-1 font-semibold text-slate-800 text-xs truncate">
                  {payment.paymentMethod}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-slate-800 uppercase tracking-wide text-xs shrink-0 w-24">
                  Received By:
                </span>
                <div className="flex-1 border-b border-dotted border-slate-700 pb-1 font-bold text-slate-900 text-xs">
                  {payment.receivedBy || 'Mohamed Mohamoud'}
                </div>
              </div>
            </div>

            {/* Outstanding Balance */}
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-extrabold text-slate-800 uppercase tracking-wide text-xs shrink-0 w-32">
                Balance Remaining:
              </span>
              <div className="flex-1 border-b border-dotted border-slate-700 pb-1 font-bold text-slate-800 text-xs sm:text-sm">
                {payment.remainingBalance > 0 ? (
                  <span className="text-amber-700 font-bold">
                    {payment.currency === 'USD' ? `$${payment.remainingBalance.toFixed(2)}` : `${payment.remainingBalance.toLocaleString()} SSP`} ({payment.status})
                  </span>
                ) : (
                  <span className="text-emerald-700 font-bold">NIL (Paid in Full)</span>
                )}
              </div>
            </div>

          </div>

          {/* Amount In Currency Boxes (Replicating the SSP / USD printed boxes) */}
          <div className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              
              {/* SSP Box */}
              <div className={`border-2 rounded-2xl p-3.5 flex items-center justify-between ${
                payment.currency === 'SSP' 
                  ? 'border-orange-500 bg-orange-50/60 shadow-xs' 
                  : 'border-slate-300 bg-slate-50/60 opacity-60'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">SSP</span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                    {payment.currency === 'SSP' ? payment.amount.toLocaleString() : '—'}
                  </span>
                </div>
              </div>

              {/* USD Box */}
              <div className={`border-2 rounded-2xl p-3.5 flex items-center justify-between ${
                payment.currency === 'USD' 
                  ? 'border-emerald-600 bg-emerald-50/60 shadow-xs' 
                  : 'border-slate-300 bg-slate-50/60 opacity-60'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">USD</span>
                </div>
                <div className="text-right">
                  <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                    {payment.currency === 'USD' ? `$${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Notes (if any) */}
          {payment.notes && (
            <div className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-600 italic">
              <strong>Note:</strong> {payment.notes}
            </div>
          )}

          {/* Signatures & Seal Section */}
          <div className="pt-8 border-t-2 border-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-extrabold text-sm uppercase tracking-widest text-slate-900">
                  WITH THANKS
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                  For: NYAKURON BUSINESS CENTRE
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
              <div>
                <div className="h-10 border-b border-dashed border-slate-400 flex items-end">
                  <span className="text-slate-400 text-[11px] italic font-mono">Authorized Signature</span>
                </div>
                <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">Receiver's Signature</p>
              </div>

              <div>
                <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-end">
                  <div className="px-3 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-800 text-[10px] font-bold">
                    MANAGEMENT STAMP
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold text-right">Office Manager In-Charge</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
