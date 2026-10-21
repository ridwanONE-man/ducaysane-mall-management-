import React from 'react';
import { PaymentRecord } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { formatLongDate, formatMoney } from '../utils/printUtils';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import logoImg from '../assets/logo.png';

// Business letterhead shared by receipts and tenant statements.
export const Letterhead: React.FC = () => (
  <>
    <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-8 py-6">
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-white p-1.5 ring-4 ring-orange-500/70 shrink-0 flex items-center justify-center">
          <img src={logoImg} alt={BUSINESS_PROFILE.name} className="w-full h-full object-contain rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-['Playfair_Display',serif] text-2xl sm:text-3xl font-extrabold tracking-tight uppercase leading-tight">
            {BUSINESS_PROFILE.name}
          </h1>
          <p className="text-orange-300 text-[11px] font-bold uppercase tracking-[0.25em] mt-0.5">
            {BUSINESS_PROFILE.tagline}
          </p>
          <div className="mt-2 text-[11px] text-slate-300 space-y-0.5">
            <p>{BUSINESS_PROFILE.address}</p>
            <p>Tel: {BUSINESS_PROFILE.phones.join('  •  ')}</p>
            <p>Email: {BUSINESS_PROFILE.email}</p>
          </div>
        </div>
      </div>
    </div>
    <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
  </>
);

interface ReceiptDocumentProps {
  payment: PaymentRecord;
  // All rows booked on this receipt (one per rent month) when it covers several months
  items?: PaymentRecord[];
}

// The printable receipt itself. Used both for the on-screen preview and the print copy.
export const ReceiptDocument: React.FC<ReceiptDocumentProps> = ({ payment, items = [] }) => {
  const money = (n: number) => formatMoney(n, payment.currency);
  const isPaidInFull = payment.remainingBalance <= 0 && payment.status === 'Paid';
  const stampLabel = isPaidInFull ? 'PAID' : payment.status === 'Partially Paid' ? 'PARTIAL' : 'PENDING';
  const stampColor = isPaidInFull
    ? 'border-emerald-600 text-emerald-600'
    : payment.status === 'Partially Paid'
      ? 'border-amber-600 text-amber-600'
      : 'border-slate-500 text-slate-500';

  const breakdown: { label: string; value: number; strong?: boolean; tone?: string }[] = [
    { label: 'Monthly Base Rent', value: payment.monthlyBaseRent },
    { label: 'Previous Arrears Brought Forward', value: payment.previousArrears },
    { label: 'Total Amount Due', value: payment.totalDue, strong: true },
    { label: 'Amount Received (This Receipt)', value: payment.amount, strong: true, tone: 'text-emerald-700' },
    { label: 'Balance Remaining', value: Math.max(0, payment.remainingBalance), tone: payment.remainingBalance > 0 ? 'text-rose-600' : 'text-slate-900' },
  ];

  return (
    <div className="relative bg-white text-slate-900 font-sans overflow-hidden">
      {/* Watermark logo */}
      <img
        src={logoImg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] opacity-[0.04]"
      />

      <Letterhead />

      <div className="relative px-8 py-7 space-y-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Official Document</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">RENT PAYMENT RECEIPT</h2>
          </div>
          <div className="text-right space-y-1.5">
            <div className="inline-block rounded-xl border-2 border-rose-600 bg-rose-50 px-3 py-1.5 text-left">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-rose-700">Receipt No.</span>
              <span className="font-mono text-base font-black tracking-wider text-rose-700">{payment.receiptNumber}</span>
            </div>
            <p className="text-xs text-slate-500">
              Date: <span className="font-bold text-slate-900">{formatLongDate(payment.date)}</span>
            </p>
          </div>
        </div>

        {/* Parties & details */}
        <div className="grid grid-cols-2 gap-4 print-avoid-break">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Received From</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 leading-tight">{payment.tenantName}</p>
            {payment.tenantId && (
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">Tenant ID: {payment.tenantId}</p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              Unit: <span className="font-bold text-slate-900">{payment.unitNumber}</span>
            </p>
            {payment.unitSpace && payment.unitSpace !== payment.unitNumber && (
              <p className="text-[11px] text-slate-500">{payment.unitSpace}</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Rent Period</span>
              <span className="font-bold text-slate-900 text-right">{payment.accountingPeriod}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Payment Method</span>
              <span className="font-bold text-slate-900 text-right">{payment.paymentMethod}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Currency</span>
              <span className="font-bold text-slate-900">{payment.currency}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Received By</span>
              <span className="font-bold text-slate-900 text-right">{payment.receivedBy || BUSINESS_PROFILE.managerName}</span>
            </div>
          </div>
        </div>

        {/* Months covered by this receipt */}
        {items.length > 1 && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden print-avoid-break">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-left py-2.5 px-4 font-bold uppercase tracking-wider text-[10px]">Rent Month</th>
                  <th className="text-left py-2.5 px-4 font-bold uppercase tracking-wider text-[10px]">Paid By</th>
                  <th className="text-right py-2.5 px-4 font-bold uppercase tracking-wider text-[10px]">Rent</th>
                  <th className="text-right py-2.5 px-4 font-bold uppercase tracking-wider text-[10px]">Paid</th>
                  <th className="text-right py-2.5 px-4 font-bold uppercase tracking-wider text-[10px]">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2 px-4 font-bold text-slate-900">{item.accountingPeriod}</td>
                    <td className="py-2 px-4 text-slate-600">{item.paymentMethod}</td>
                    <td className="py-2 px-4 text-right font-mono">{money(item.monthlyBaseRent)}</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-emerald-700">{money(item.amount)}</td>
                    <td className={`py-2 px-4 text-right font-mono ${item.remainingBalance > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {item.remainingBalance > 0 ? money(item.remainingBalance) : 'Cleared'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Breakdown table */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden print-avoid-break">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="text-left py-2.5 px-4 font-bold uppercase tracking-wider text-[10px]">Description</th>
                <th className="text-right py-2.5 px-4 font-bold uppercase tracking-wider text-[10px]">Amount ({payment.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {breakdown.map(row => (
                <tr key={row.label} className={row.strong ? 'bg-slate-50' : ''}>
                  <td className={`py-2.5 px-4 ${row.strong ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{row.label}</td>
                  <td className={`py-2.5 px-4 text-right font-mono ${row.strong ? 'font-black' : 'font-semibold'} ${row.tone || 'text-slate-900'}`}>
                    {money(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Amount box with stamp */}
        <div className="relative rounded-2xl border-2 border-slate-900 bg-gradient-to-br from-emerald-50 to-white p-5 print-avoid-break">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Amount Received</p>
          <p className="font-mono text-3xl font-black text-emerald-700 mt-0.5">
            {money(payment.amount)} <span className="text-base text-slate-500">{payment.currency === 'USD' ? 'USD' : ''}</span>
          </p>
          <p className="mt-2 text-xs italic text-slate-700">
            <span className="not-italic font-bold text-slate-500 uppercase text-[10px] tracking-wider mr-1">In words:</span>
            {numberToWords(payment.amount, payment.currency)}
          </p>
          <div
            className={`absolute right-6 top-1/2 -translate-y-1/2 -rotate-12 rounded-full border-4 border-double ${stampColor} w-24 h-24 flex flex-col items-center justify-center bg-white/70`}
          >
            <span className="text-[8px] font-bold tracking-widest">{BUSINESS_PROFILE.shortName}</span>
            <span className="text-lg font-black tracking-wider leading-none">{stampLabel}</span>
            <span className="text-[8px] font-bold">{formatLongDate(payment.date)}</span>
          </div>
        </div>

        {payment.notes && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            <strong className="text-slate-800">Note:</strong> {payment.notes}
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-10 pt-6 print-avoid-break">
          <div>
            <div className="h-12 border-b-2 border-dotted border-slate-400" />
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">Tenant's Signature</p>
          </div>
          <div className="text-right">
            <div className="h-12 border-b-2 border-dotted border-slate-400" />
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Authorized Signature & Stamp
            </p>
            <p className="text-[10px] text-slate-400">For {BUSINESS_PROFILE.name}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative border-t border-slate-200 bg-slate-50 px-8 py-3 flex items-center justify-between text-[10px] text-slate-500">
        <span className="font-bold uppercase tracking-widest text-slate-700">Thank you for your business</span>
        <span>This receipt is computer generated • Keep it for your records</span>
      </div>
    </div>
  );
};
