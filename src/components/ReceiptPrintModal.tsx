import React from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { PaymentRecord } from '../types';
import { ReceiptDocument } from './ReceiptDocument';
import { PrintPortal } from './PrintPortal';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
  allPayments?: PaymentRecord[];
}

// Rows recorded together (same receipt, tenant and day) are one voucher.
function receiptGroup(payment: PaymentRecord, all: PaymentRecord[]) {
  const rows = all.filter(p =>
    p.receiptNumber === payment.receiptNumber && p.tenantName === payment.tenantName && p.date === payment.date
  );
  if (rows.length <= 1) return { combined: payment, items: [] as PaymentRecord[] };
  const sum = (f: (p: PaymentRecord) => number) => rows.reduce((s, p) => s + f(p), 0);
  const methods = [...new Set(rows.map(p => p.paymentMethod))];
  const combined: PaymentRecord = {
    ...payment,
    accountingPeriod: rows.map(p => p.accountingPeriod).join(', '),
    amount: sum(p => p.amount),
    monthlyBaseRent: payment.monthlyBaseRent,
    previousArrears: 0,
    totalDue: sum(p => p.totalDue),
    remainingBalance: Math.max(0, sum(p => p.remainingBalance)),
    advanceBalance: Math.max(...rows.map(p => p.advanceBalance || 0)),
    paymentMethod: methods.length === 1 ? methods[0] : payment.paymentMethod,
    status: rows.every(p => p.status === 'Paid') ? 'Paid' : 'Partially Paid',
    notes: rows.find(p => p.notes)?.notes,
  };
  return { combined, items: rows };
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  payment,
  allPayments = []
}) => {
  if (!isOpen || !payment) return null;
  const { combined, items } = receiptGroup(payment, allPayments);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Modal Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Official Receipt Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-orange-500/20 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ReceiptDocument payment={combined} items={items} />
      </div>

      {/* Print copy, rendered outside the app so only the receipt is printed */}
      <PrintPortal>
        <ReceiptDocument payment={combined} items={items} />
      </PrintPortal>
    </div>
  );
};
