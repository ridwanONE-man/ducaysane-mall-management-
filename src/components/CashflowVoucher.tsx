import React from 'react';
import { CashflowTransaction } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { formatMoney, formatLongDate, parsePaymentDate } from '../utils/printUtils';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import logoImg from '../assets/logo.png';

const ADMIN = `${BUSINESS_PROFILE.managerName} (Admin)`;

// Business strip used on cashflow papers: logo and name on the left, contacts on the right.
export const CashflowHeader: React.FC<{ title: string; subtitle: string; tone: string }> = ({ title, subtitle, tone }) => (
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

// A list of cashflow entries: one amount column, each line marked IN or OUT,
// grouped by day; dollar and SSP totals kept apart.
export const CashflowStatement: React.FC<{ transactions: CashflowTransaction[]; filterLabel: string }> = ({ transactions, filterLabel }) => {
  type Cur = 'USD' | 'SSP';
  const cur = (t: CashflowTransaction): Cur => (t.currency || 'USD') as Cur;
  const sum = (list: CashflowTransaction[], c: Cur, type: 'Inflow' | 'Outflow') =>
    list.filter(t => cur(t) === c && t.type === type).reduce((s, t) => s + t.amount, 0);
  const net = (list: CashflowTransaction[], c: Cur) => sum(list, c, 'Inflow') - sum(list, c, 'Outflow');
  const signed = (n: number, c: Cur) => `${n < 0 ? '-' : ''}${formatMoney(Math.abs(n), c)}`;

  const currencies = (['USD', 'SSP'] as const).filter(c => transactions.some(t => cur(t) === c));
  const shown: Cur[] = currencies.length ? [...currencies] : ['USD', 'SSP'];

  // Grouped by day, oldest first, so the statement reads in order
  const toKey = (t: CashflowTransaction) => {
    const d = parsePaymentDate(t.date);
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '0000';
  };
  const groups = [...transactions.reduce((m, t) => {
    const k = toKey(t);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(t);
    return m;
  }, new Map<string, CashflowTransaction[]>()).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const first = groups[0]?.[1][0];
  const last = groups[groups.length - 1]?.[1][0];
  const covering = !first ? '—' : groups.length === 1 ? formatLongDate(first.date) : `${formatLongDate(first.date)} – ${formatLongDate(last!.date)}`;
  const inCount = transactions.filter(t => t.type === 'Inflow').length;
  const outCount = transactions.length - inCount;
  const reportNo = `CFS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

  const Meta: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 text-[11px] font-semibold text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
        <CashflowHeader title="Cashflow Statement" subtitle="Money in & out" tone="bg-gradient-to-b from-orange-500 to-amber-400" />
        <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

        <div className="px-7 py-6 space-y-5">
          {/* Statement details */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-2">
            <Meta label="Statement no." value={<span className="font-mono">{reportNo}</span>} />
            <Meta label="Printed on" value={formatLongDate(new Date())} />
            <Meta label="Covering" value={covering} />
            <Meta label="Showing" value={filterLabel} />
            <Meta label="Entries" value={`${inCount} money in • ${outCount} money out`} />
            <Meta label="Prepared by" value={ADMIN} />
          </div>

          {/* Entries: one amount column, IN or OUT on every line */}
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-left uppercase tracking-wider text-[9px]">
                <th className="py-2 px-2 font-bold">Ref</th>
                <th className="py-2 px-2 font-bold text-center">In / Out</th>
                <th className="py-2 px-2 font-bold">Description</th>
                <th className="py-2 px-2 font-bold">Category</th>
                <th className="py-2 px-2 font-bold">Account / Bank</th>
                <th className="py-2 px-2 font-bold text-right">Amount</th>
              </tr>
            </thead>
            {groups.map(([key, items]) => (
              <tbody key={key} className="print-avoid-break">
                <tr className="border-b border-slate-300">
                  <td colSpan={5} className="pt-3 pb-1 px-2 text-[10px] font-black uppercase tracking-wider text-orange-700">
                    {(parsePaymentDate(items[0].date) || new Date()).toLocaleDateString('en-US', { weekday: 'long' })}, {formatLongDate(items[0].date)}
                  </td>
                  <td className="pt-3 pb-1 px-2 text-right font-mono font-bold text-slate-500 whitespace-nowrap">
                    {(['USD', 'SSP'] as const).filter(c => items.some(t => cur(t) === c)).map(c => signed(net(items, c), c)).join(' • ')}
                  </td>
                </tr>
                {items.map((t, i) => {
                  const out = t.type === 'Outflow';
                  return (
                    <tr key={t.id} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/70' : ''}`}>
                      <td className="py-1.5 px-2 font-mono text-slate-600">{t.referenceNumber}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={`inline-block w-9 rounded text-[9px] font-black ${out ? 'text-rose-700 border border-rose-300' : 'text-emerald-700 border border-emerald-300'}`}>
                          {out ? 'OUT' : 'IN'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-semibold">{t.title}{t.notes && <span className="block text-[9px] font-normal text-slate-500">{t.notes}</span>}</td>
                      <td className="py-1.5 px-2 text-slate-600">{t.category}</td>
                      <td className="py-1.5 px-2 text-slate-600">{t.account}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap ${out ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {out ? '-' : '+'}{formatMoney(t.amount, cur(t))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>

          {/* Summary + balance in words */}
          <div className="flex items-start justify-between gap-8 print-avoid-break">
            <div className="flex-1 space-y-2 pt-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Balance in words</p>
              {shown.map(c => {
                const b = net(transactions, c);
                return (
                  <p key={c} className="text-[11px] italic text-slate-800 border-l-2 border-orange-500 pl-2">
                    <span className="not-italic font-bold mr-1">{c === 'USD' ? 'Dollar:' : 'SSP:'}</span>
                    {b < 0 ? 'Minus ' : ''}{numberToWords(Math.abs(b), c)}
                  </p>
                );
              })}
            </div>
            <table className="w-72 text-[11px] border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[9px] uppercase tracking-wider text-slate-500">
                  <th className="py-1.5 text-left font-bold">Summary</th>
                  {shown.map(c => <th key={c} className="py-1.5 text-right font-bold">{c === 'USD' ? 'Dollar ($)' : 'SSP'}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5">Total money in</td>
                  {shown.map(c => <td key={c} className="py-1.5 text-right font-mono">+{formatMoney(sum(transactions, c, 'Inflow'), c)}</td>)}
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5">Total money out</td>
                  {shown.map(c => <td key={c} className="py-1.5 text-right font-mono">-{formatMoney(sum(transactions, c, 'Outflow'), c)}</td>)}
                </tr>
                <tr className="bg-slate-900 text-white font-black">
                  <td className="py-2 px-2 uppercase tracking-wider text-[10px]">Balance</td>
                  {shown.map(c => <td key={c} className="py-2 px-2 text-right font-mono">{signed(net(transactions, c), c)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 pt-8 print-avoid-break">
            {[['Prepared by', ADMIN], ['Checked by', ''], ['Approved by', '']].map(([role, name]) => (
              <div key={role} className="text-center">
                <div className="h-10 border-b border-slate-500" />
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">{role}</p>
                <p className="text-[10px] font-semibold text-slate-800 min-h-[14px]">{name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-7 py-2 border-t border-slate-300 bg-slate-50 flex items-center justify-between text-[9px] text-slate-500">
          <span>{BUSINESS_PROFILE.name} • Cash flow records</span>
          <span>+ money in • - money out • Dollar and SSP are never added together</span>
        </div>
      </div>
    </div>
  );
};
