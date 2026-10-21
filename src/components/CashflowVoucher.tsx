import React from 'react';
import { CashflowTransaction } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { formatMoney, formatLongDate } from '../utils/printUtils';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import logoImg from '../assets/logo.png';

const ADMIN = `${BUSINESS_PROFILE.managerName} (Admin)`;

// Business strip used on cashflow papers: logo and name on the left, contacts on the right.
const CashflowHeader: React.FC<{ title: string; subtitle: string; tone: string }> = ({ title, subtitle, tone }) => (
  <div className="flex items-stretch border-b-2 border-slate-900">
    <div className={`w-3 ${tone}`} />
    <div className="flex-1 flex items-center gap-4 px-6 py-4">
      <img src={logoImg} alt={BUSINESS_PROFILE.name} className="w-14 h-14 object-contain rounded-xl border border-slate-200 p-1" />
      <div className="min-w-0 flex-1">
        <p className="font-['Playfair_Display',serif] text-lg font-extrabold uppercase leading-tight text-slate-900">{BUSINESS_PROFILE.name}</p>
        <p className="text-[9px] text-slate-500">{BUSINESS_PROFILE.address}</p>
        <p className="text-[9px] text-slate-500">Tel: {BUSINESS_PROFILE.phones.join(' / ')} • {BUSINESS_PROFILE.email}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-600">{subtitle}</p>
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">{title}</h2>
      </div>
    </div>
  </div>
);

const Line: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-end gap-3">
    <span className="w-32 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
    <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 text-sm font-semibold text-slate-900">{value}</span>
  </div>
);

// One cashflow entry: a Payment Voucher for money out, a Cash Receipt Voucher for money in.
export const CashflowVoucher: React.FC<{ tx: CashflowTransaction }> = ({ tx }) => {
  const isOut = tx.type === 'Outflow';
  const currency = tx.currency || 'USD';
  const tone = isOut ? 'bg-gradient-to-b from-rose-500 to-orange-500' : 'bg-gradient-to-b from-emerald-500 to-teal-500';

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
        <CashflowHeader title={isOut ? 'Payment Voucher' : 'Cash Receipt Voucher'} subtitle={isOut ? 'Money out' : 'Money in'} tone={tone} />

        <div className="px-8 py-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-mono font-black">{tx.referenceNumber}</span>
              <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase ${isOut ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {tx.type} • {currency}
              </span>
            </div>
            <p className="text-xs text-slate-500">Date: <strong className="text-slate-900">{formatLongDate(tx.date)}</strong></p>
          </div>

          <div className="space-y-3 print-avoid-break">
            <Line label={isOut ? 'Paid to / for' : 'Received from'} value={tx.title} />
            <Line label="Category" value={tx.category} />
            <Line label={isOut ? 'Paid from' : 'Deposited to'} value={tx.account} />
            <Line label="Amount in words" value={<span className="italic">{numberToWords(tx.amount, currency)}</span>} />
            {tx.notes && <Line label="Notes" value={tx.notes} />}
          </div>

          <table className="w-full text-xs border border-slate-300 print-avoid-break">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-3">Particulars</th>
                <th className="text-right py-2 px-3 w-48">Amount ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-3 px-3">{tx.title}<span className="block text-[10px] text-slate-500">{tx.category}</span></td>
                <td className="py-3 px-3 text-right font-mono font-bold">{formatMoney(tx.amount, currency)}</td>
              </tr>
              <tr className={isOut ? 'bg-rose-50' : 'bg-emerald-50'}>
                <td className="py-2.5 px-3 font-black uppercase text-[11px]">Total {isOut ? 'paid out' : 'received'}</td>
                <td className={`py-2.5 px-3 text-right font-mono text-lg font-black ${isOut ? 'text-rose-700' : 'text-emerald-700'}`}>{formatMoney(tx.amount, currency)}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-6 pt-6 text-center print-avoid-break">
            {[
              ['Prepared by', tx.recordedBy || ADMIN],
              ['Approved by', ADMIN],
              [isOut ? 'Received by (payee)' : 'Paid by', ''],
            ].map(([role, name]) => (
              <div key={role}>
                <div className="h-10 border-b border-slate-500" />
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{role}</p>
                {name && <p className="text-[10px] text-slate-500">{name}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className={`h-1.5 ${isOut ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} />
      </div>
    </div>
  );
};

// A list of cashflow entries with dollar and SSP totals kept apart.
export const CashflowStatement: React.FC<{ transactions: CashflowTransaction[]; filterLabel: string }> = ({ transactions, filterLabel }) => {
  const totals = (['USD', 'SSP'] as const).map(currency => {
    const list = transactions.filter(t => (t.currency || 'USD') === currency);
    const inflow = list.filter(t => t.type === 'Inflow').reduce((s, t) => s + t.amount, 0);
    const outflow = list.filter(t => t.type === 'Outflow').reduce((s, t) => s + t.amount, 0);
    return { currency, count: list.length, inflow, outflow, net: inflow - outflow };
  }).filter(t => t.count > 0);

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
        <CashflowHeader title="Cashflow Statement" subtitle="Money in & out" tone="bg-gradient-to-b from-orange-500 to-amber-400" />
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Showing: <strong className="text-slate-900">{filterLabel}</strong> • {transactions.length} entr{transactions.length === 1 ? 'y' : 'ies'}</span>
            <span>Printed {formatLongDate(new Date())} • {ADMIN}</span>
          </div>

          <div className={`grid gap-3 print-avoid-break ${totals.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {totals.map(t => (
              <div key={t.currency} className="rounded-xl border border-slate-300 overflow-hidden">
                <div className="bg-slate-900 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider">{t.currency === 'USD' ? 'Dollar ($)' : 'SSP'}</div>
                <div className="grid grid-cols-3 text-center text-[10px]">
                  <div className="py-2"><span className="block text-slate-500">In</span><strong className="text-emerald-700">{formatMoney(t.inflow, t.currency)}</strong></div>
                  <div className="py-2 border-x border-slate-200"><span className="block text-slate-500">Out</span><strong className="text-rose-700">{formatMoney(t.outflow, t.currency)}</strong></div>
                  <div className="py-2"><span className="block text-slate-500">Net</span><strong>{t.net < 0 ? '-' : ''}{formatMoney(Math.abs(t.net), t.currency)}</strong></div>
                </div>
              </div>
            ))}
          </div>

          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-y-2 border-slate-900 text-left uppercase tracking-wider">
                <th className="py-1.5">Date</th>
                <th className="py-1.5">Ref</th>
                <th className="py-1.5">Description</th>
                <th className="py-1.5">Category</th>
                <th className="py-1.5">Account / Bank</th>
                <th className="py-1.5 text-right">In</th>
                <th className="py-1.5 text-right">Out</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-slate-200 print-avoid-break">
                  <td className="py-1.5">{formatLongDate(t.date)}</td>
                  <td className="py-1.5 font-mono">{t.referenceNumber}</td>
                  <td className="py-1.5 font-semibold">{t.title}</td>
                  <td className="py-1.5">{t.category}</td>
                  <td className="py-1.5">{t.account}</td>
                  <td className="py-1.5 text-right font-mono text-emerald-700">{t.type === 'Inflow' ? formatMoney(t.amount, t.currency || 'USD') : ''}</td>
                  <td className="py-1.5 text-right font-mono text-rose-700">{t.type === 'Outflow' ? formatMoney(t.amount, t.currency || 'USD') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-10 pt-6 print-avoid-break">
            {['Prepared by', 'Approved by'].map(r => (
              <div key={r} className={r === 'Approved by' ? 'text-right' : ''}>
                <div className="h-10 border-b border-slate-500" />
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">{r}</p>
                <p className="text-[10px] font-bold">{ADMIN}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
