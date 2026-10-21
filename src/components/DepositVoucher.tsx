import React from 'react';
import { Scissors } from 'lucide-react';
import { DepositRecord } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { formatLongDate, formatMoney } from '../utils/printUtils';
import { depositMonthLabels, isCreditDeposit } from '../utils/tenantAccount';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import logoImg from '../assets/logo.png';

const usd = (n: number) => formatMoney(n, 'USD');

// Pattern used behind the deposit letterhead, so deposit papers never look like rent receipts.
const GUILLOCHE: React.CSSProperties = {
  backgroundImage:
    'repeating-radial-gradient(circle at 0 0, rgba(79,70,229,0.07) 0 2px, transparent 2px 10px), repeating-radial-gradient(circle at 100% 100%, rgba(79,70,229,0.07) 0 2px, transparent 2px 10px)',
};

// Centered crest letterhead for deposit documents (receipts use the dark banner instead).
export const DepositLetterhead: React.FC = () => (
  <div className="relative text-center px-8 pt-7 pb-5 border-b-2 border-indigo-900" style={GUILLOCHE}>
    <div className="mx-auto w-20 h-20 rounded-full bg-white p-1.5 ring-2 ring-indigo-900 ring-offset-4 flex items-center justify-center">
      <img src={logoImg} alt={BUSINESS_PROFILE.name} className="w-full h-full object-contain rounded-full" />
    </div>
    <h1 className="mt-4 font-['Playfair_Display',serif] text-2xl font-extrabold tracking-[0.08em] uppercase text-indigo-950">
      {BUSINESS_PROFILE.name}
    </h1>
    <div className="flex items-center justify-center gap-3 mt-1">
      <span className="h-px w-10 bg-indigo-300" />
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-600">{BUSINESS_PROFILE.tagline}</p>
      <span className="h-px w-10 bg-indigo-300" />
    </div>
    <p className="mt-2 text-[10px] text-slate-600">
      {BUSINESS_PROFILE.address} &nbsp;|&nbsp; {BUSINESS_PROFILE.phones.join(' / ')} &nbsp;|&nbsp; {BUSINESS_PROFILE.email}
    </p>
  </div>
);

// One line of the "received from ... the sum of ..." certificate wording.
const FillLine: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-end gap-3">
    <span className="shrink-0 text-[11px] font-semibold italic text-slate-500">{label}</span>
    <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 text-sm font-bold text-slate-900">{children}</span>
  </div>
);

export const DepositVoucher: React.FC<{ deposit: DepositRecord }> = ({ deposit }) => {
  const credit = isCreditDeposit(deposit);
  const months = depositMonthLabels(deposit);
  const refunded = deposit.status === 'Refunded';
  const slip = deposit.depositSlip || deposit.id;
  const title = credit ? 'Advance Credit Voucher' : 'Security Deposit Voucher';
  const coverText = credit
    ? 'Advance rent credit (overpayment)'
    : months.length
      ? months.join(', ')
      : deposit.depositMonths ? `${deposit.depositMonths} month(s)` : 'Security deposit';
  const userNote = (deposit.notes || '').replace(/Deposit for: [^.]+\.\s*/, '').trim();

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-[3px] border-double border-indigo-900 rounded-sm overflow-hidden">
        <DepositLetterhead />

        {/* Title ribbon */}
        <div className="flex items-stretch bg-indigo-900 text-white">
          <div className="flex-1 px-6 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-indigo-300">Escrow • Refundable</p>
            <h2 className="text-xl font-black uppercase tracking-[0.12em]">{title}</h2>
          </div>
          <div className="bg-amber-400 text-indigo-950 px-5 py-3 flex flex-col justify-center text-right [clip-path:polygon(12%_0,100%_0,100%_100%,12%_100%,0_50%)] pl-8">
            <span className="text-[9px] font-black uppercase tracking-wider">Voucher No.</span>
            <span className="font-mono text-base font-black tracking-wider">{slip}</span>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Certificate wording + amount seal */}
          <div className="flex gap-6 items-center print-avoid-break">
            <div className="flex-1 space-y-3">
              <FillLine label="Date">{formatLongDate(deposit.heldSince)}</FillLine>
              <FillLine label="Received from">{deposit.tenantName}</FillLine>
              <FillLine label="For unit">{deposit.unitNumber}</FillLine>
              <FillLine label="The sum of">{numberToWords(deposit.amountUSD, 'USD')}</FillLine>
              <FillLine label="Being">{coverText}</FillLine>
            </div>
            <div className="shrink-0 w-40 text-center">
              <div className={`mx-auto w-36 h-36 rounded-full border-4 ${refunded ? 'border-slate-400' : 'border-indigo-900'} flex flex-col items-center justify-center bg-indigo-50/60 relative`}>
                <div className={`absolute inset-1.5 rounded-full border border-dashed ${refunded ? 'border-slate-300' : 'border-indigo-400'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700">Amount</span>
                <span className="font-mono text-2xl font-black text-indigo-950 leading-tight">{usd(deposit.amountUSD)}</span>
                <span className="text-[9px] font-bold text-slate-500">US Dollars</span>
              </div>
              <span className={`inline-block mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                refunded ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {refunded ? 'Refunded' : credit ? 'Credit on account' : 'Held in escrow'}
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-4 border border-indigo-200 rounded-lg overflow-hidden text-xs print-avoid-break">
            {[
              ['Months covered', credit ? '—' : String(months.length || deposit.depositMonths || '—')],
              ['Monthly rent', deposit.monthlyRentUSD ? usd(deposit.monthlyRentUSD) : '—'],
              ['Held in', deposit.bankAccount || '—'],
              ['Tenant ID', deposit.tenantId || '—'],
            ].map(([k, v], i) => (
              <div key={k} className={`px-3 py-2.5 ${i > 0 ? 'border-l border-indigo-200' : ''} ${i % 2 ? 'bg-white' : 'bg-indigo-50/50'}`}>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-indigo-600">{k}</span>
                <span className="block font-bold text-slate-900 mt-0.5 break-words">{v}</span>
              </div>
            ))}
          </div>

          {months.length > 0 && (
            <div className="flex flex-wrap gap-1.5 print-avoid-break">
              {months.map(m => (
                <span key={m} className="px-2.5 py-1 rounded-md border border-indigo-300 bg-indigo-50 text-[11px] font-bold text-indigo-900">{m}</span>
              ))}
            </div>
          )}

          {userNote && (
            <p className="text-xs text-slate-600"><strong className="text-slate-800">Note:</strong> {userNote}</p>
          )}

          <div className="rounded-lg bg-amber-50 border-l-4 border-amber-400 px-4 py-2.5 text-[10px] leading-relaxed text-slate-700 print-avoid-break">
            <strong className="text-slate-900">Terms:</strong> {credit
              ? 'This credit is applied automatically to the tenant’s next unpaid rent months.'
              : 'This deposit is held in escrow and is refundable at the end of the lease, less any unpaid rent or damage to the unit. Present this voucher when requesting a refund.'}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 pt-4 text-center print-avoid-break">
            {['Tenant', 'Cashier', 'Manager'].map(r => (
              <div key={r}>
                <div className="h-10 border-b border-slate-500" />
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{r}</p>
                {r === 'Manager' && <p className="text-[9px] text-slate-400">{BUSINESS_PROFILE.managerName}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Tear-off counterfoil */}
        <div className="relative border-t-2 border-dashed border-slate-400 mx-0">
          <Scissors className="absolute -top-2.5 left-6 w-4 h-4 text-slate-400 bg-white" />
        </div>
        <div className="px-8 py-3 flex items-center justify-between gap-4 bg-indigo-50/60 text-[11px] print-avoid-break">
          <span className="font-black uppercase tracking-widest text-indigo-900">Tenant copy</span>
          <span className="font-mono font-bold">{slip}</span>
          <span className="font-semibold truncate">{deposit.tenantName} • {deposit.unitNumber}</span>
          <span>{formatLongDate(deposit.heldSince)}</span>
          <span className="font-mono font-black text-indigo-900">{usd(deposit.amountUSD)}</span>
        </div>
      </div>
    </div>
  );
};

interface DepositStatementProps {
  deposits: DepositRecord[];
  title: string; // tenant name or "All tenants"
  subtitle?: string; // unit
  periodLabel: string;
}

// Several deposit records on one page (a tenant's bundle, or the filtered list).
export const DepositStatement: React.FC<DepositStatementProps> = ({ deposits, title, subtitle, periodLabel }) => {
  const held = deposits.filter(d => d.status !== 'Refunded').reduce((s, d) => s + d.amountUSD, 0);
  const refunded = deposits.filter(d => d.status === 'Refunded').reduce((s, d) => s + d.amountUSD, 0);
  const now = new Date();

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-[3px] border-double border-indigo-900 rounded-sm overflow-hidden">
        <DepositLetterhead />
        <div className="bg-indigo-900 text-white px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-[0.12em]">Deposit Statement</h2>
          <span className="text-[11px] font-semibold text-indigo-200">Printed {formatLongDate(now)}</span>
        </div>

        <div className="px-8 py-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border-l-4 border-indigo-900 pl-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-indigo-600">Statement for</span>
              <span className="block text-lg font-extrabold">{title}</span>
              {subtitle && <span className="text-slate-600">Unit {subtitle}</span>}
            </div>
            <div className="border-l-4 border-amber-400 pl-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-indigo-600">Period</span>
              <span className="block text-sm font-bold">{periodLabel}</span>
              <span className="text-slate-600">{deposits.length} record{deposits.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <table className="w-full text-xs border border-indigo-200">
            <thead>
              <tr className="bg-indigo-50 text-indigo-900 text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-3">Voucher</th>
                <th className="text-left py-2 px-3">Date</th>
                {!subtitle && <th className="text-left py-2 px-3">Tenant / Unit</th>}
                <th className="text-left py-2 px-3">Covers</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-100">
              {deposits.map(d => {
                const months = depositMonthLabels(d);
                return (
                  <tr key={d.id} className="print-avoid-break">
                    <td className="py-2 px-3 font-mono font-bold">{d.depositSlip || d.id}</td>
                    <td className="py-2 px-3">{formatLongDate(d.heldSince)}</td>
                    {!subtitle && <td className="py-2 px-3">{d.tenantName} • {d.unitNumber}</td>}
                    <td className="py-2 px-3">{isCreditDeposit(d) ? 'Advance credit' : months.join(', ') || (d.depositMonths ? `${d.depositMonths} month(s)` : '—')}</td>
                    <td className="py-2 px-3">{d.status === 'Held in Escrow' ? 'Held' : d.status}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{usd(d.amountUSD)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="ml-auto w-72 text-xs border border-indigo-900 print-avoid-break">
            <div className="flex justify-between px-3 py-1.5"><span>Total deposited</span><span className="font-mono font-bold">{usd(held + refunded)}</span></div>
            <div className="flex justify-between px-3 py-1.5 border-t border-indigo-100"><span>Refunded</span><span className="font-mono font-bold">{usd(refunded)}</span></div>
            <div className="flex justify-between px-3 py-2 bg-indigo-900 text-white"><span className="font-bold">Currently held</span><span className="font-mono font-black">{usd(held)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-10 pt-6 text-center print-avoid-break">
            {['Prepared by', 'Manager'].map(r => (
              <div key={r}>
                <div className="h-10 border-b border-slate-500" />
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{r}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
