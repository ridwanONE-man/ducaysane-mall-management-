import React from 'react';
import { Scissors } from 'lucide-react';
import { DepositRecord, PropertyUnit } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { formatMoney, normalizeUnitNumber } from '../utils/printUtils';
import { depositMonthLabels, isCreditDeposit } from '../utils/tenantAccount';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import logoImg from '../assets/logo.png';

export const DEPOSIT_RECEIVED_BY = `${BUSINESS_PROFILE.managerName} (Admin)`;

// Deposit dates are saved as "Oct 20, 2026", "2026-10-20" or day-first "01/09/2026".
export function parseDepositDate(value?: string): Date | null {
  if (!value) return null;
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function depositDateLabel(value?: string): string {
  const d = parseDepositDate(value);
  return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : value || '—';
}

// Amount in the currency it was actually paid in (some old deposits are SSP only)
export function depositMoney(d: DepositRecord): { value: number; currency: 'USD' | 'SSP' } {
  return d.amountUSD > 0 || !(d.amountSSP && d.amountSSP > 0)
    ? { value: d.amountUSD, currency: 'USD' }
    : { value: d.amountSSP, currency: 'SSP' };
}

export function formatDepositAmount(d: DepositRecord): string {
  const { value, currency } = depositMoney(d);
  return formatMoney(value, currency);
}

// Months the deposit covers: "Deposit for: Jan 2027, ..." or the older "... of 2 month(s) rent ..."
export function depositMonthCount(d: DepositRecord): number {
  const labels = depositMonthLabels(d);
  if (labels.length) return labels.length;
  const m = /(\d+)\s*month/i.exec(d.notes || '');
  return m ? Number(m[1]) : d.depositMonths || 0;
}

export function findDepositUnit(d: DepositRecord, units: PropertyUnit[]): PropertyUnit | undefined {
  const key = normalizeUnitNumber(d.unitNumber);
  return units.find(u => normalizeUnitNumber(u.unitNumber) === key);
}

// Centered crest letterhead for deposit documents (rent receipts use a left-aligned dark banner).
export const DepositLetterhead: React.FC = () => (
  <div
    className="relative text-center px-8 pt-7 pb-5 bg-white"
    style={{
      backgroundImage:
        'repeating-radial-gradient(circle at 0 0, rgba(249,115,22,0.06) 0 2px, transparent 2px 11px), repeating-radial-gradient(circle at 100% 100%, rgba(249,115,22,0.06) 0 2px, transparent 2px 11px)',
    }}
  >
    <div className="mx-auto w-20 h-20 rounded-full bg-white p-1.5 ring-[3px] ring-orange-500 ring-offset-4 flex items-center justify-center shadow-sm">
      <img src={logoImg} alt={BUSINESS_PROFILE.name} className="w-full h-full object-contain rounded-full" />
    </div>
    <h1 className="mt-4 font-['Playfair_Display',serif] text-2xl font-extrabold tracking-[0.06em] uppercase text-slate-900">
      {BUSINESS_PROFILE.name}
    </h1>
    <div className="flex items-center justify-center gap-3 mt-1">
      <span className="h-px w-10 bg-orange-300" />
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-600">{BUSINESS_PROFILE.tagline}</p>
      <span className="h-px w-10 bg-orange-300" />
    </div>
    <p className="mt-2 text-[10px] text-slate-600">{BUSINESS_PROFILE.address}</p>
    <p className="text-[10px] text-slate-600">
      Tel: {BUSINESS_PROFILE.phones.join('  •  ')} &nbsp;|&nbsp; {BUSINESS_PROFILE.email}
    </p>
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-dashed border-slate-200 last:border-0">
    <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
    <span className={`text-right text-xs ${strong ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>{value}</span>
  </div>
);

export const DepositVoucher: React.FC<{ deposit: DepositRecord; unit?: PropertyUnit }> = ({ deposit, unit }) => {
  const credit = isCreditDeposit(deposit);
  const months = depositMonthLabels(deposit);
  const monthCount = depositMonthCount(deposit);
  const { value, currency } = depositMoney(deposit);
  const amount = formatMoney(value, currency);
  const refunded = deposit.status === 'Refunded';
  const slip = deposit.depositSlip || deposit.id;
  const tenant = unit?.currentTenant;
  const sameTenant = tenant && tenant.name.trim().toLowerCase() === deposit.tenantName.trim().toLowerCase();
  const rent = deposit.monthlyRentUSD || unit?.monthlyRateUSD || 0;
  const title = credit ? 'Advance Credit Voucher' : 'Security Deposit Voucher';
  const covers = credit
    ? 'Advance rent credit (overpayment)'
    : months.length ? months.join(', ') : monthCount ? `${monthCount} month${monthCount === 1 ? '' : 's'} of rent` : 'Security deposit';
  const userNote = (deposit.notes || '').replace(/Deposit for: [^.]+\.\s*/, '').trim();
  const status = refunded ? 'Refunded to tenant' : credit ? 'Credit on account' : 'Held in escrow';

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="relative border-2 border-slate-900 rounded-lg overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <DepositLetterhead />

        {/* Title ribbon */}
        <div className="flex items-stretch bg-slate-900 text-white">
          <div className="flex-1 px-6 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-orange-300">{credit ? 'Advance payment' : 'Refundable deposit'}</p>
            <h2 className="text-xl font-black uppercase tracking-[0.1em]">{title}</h2>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 flex flex-col justify-center text-right [clip-path:polygon(14%_0,100%_0,100%_100%,14%_100%,0_50%)] pl-10">
            <span className="text-[9px] font-black uppercase tracking-wider text-orange-50">Voucher No.</span>
            <span className="font-mono text-base font-black tracking-wider">{slip}</span>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Date line */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Date deposited: <strong className="text-slate-900 text-sm">{depositDateLabel(deposit.heldSince)}</strong></span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              refunded ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
            }`}>{status}</span>
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-4 print-avoid-break">
            {/* Tenant */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-600 mb-1">Deposited by</p>
              <p className="text-lg font-extrabold leading-tight">{deposit.tenantName}</p>
              <div className="mt-2">
                <Row label="Unit" value={deposit.unitNumber} />
                {unit && <Row label="Location" value={`${unit.floor} • ${unit.type}`} />}
                {sameTenant && tenant?.phone && <Row label="Phone" value={tenant.phone} />}
                {rent > 0 && <Row label="Monthly rent" value={formatMoney(rent, 'USD')} />}
              </div>
            </div>

            {/* Deposit */}
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-600 mb-1">Deposit details</p>
              <Row label="Covers" value={covers} />
              {!credit && monthCount > 0 && <Row label="No. of months" value={monthCount} />}
              <Row label="Held in" value={deposit.bankAccount || '—'} />
              <Row label="Received by" value={DEPOSIT_RECEIVED_BY} strong />
            </div>

            {/* Amount seal */}
            <div className="w-40 flex items-center justify-center">
              <div className={`relative w-36 h-36 rounded-full border-4 ${refunded ? 'border-slate-400' : 'border-orange-500'} bg-orange-50/70 flex flex-col items-center justify-center`}>
                <div className={`absolute inset-1.5 rounded-full border border-dashed ${refunded ? 'border-slate-300' : 'border-orange-300'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-700">Amount</span>
                <span className="font-mono text-xl font-black text-slate-900 leading-tight px-2 text-center">{amount}</span>
                <span className="text-[9px] font-bold text-slate-500">{currency === 'USD' ? 'US Dollars' : 'S. Sudanese Pounds'}</span>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div className="rounded-xl bg-slate-900 text-white px-5 py-3 flex items-center justify-between gap-4 print-avoid-break">
            <div className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-orange-300">Amount in words</span>
              <span className="block text-xs italic">{numberToWords(value, currency)}</span>
            </div>
            <span className="font-mono text-2xl font-black text-orange-400 shrink-0">{amount}</span>
          </div>

          {months.length > 0 && (
            <div className="print-avoid-break">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Months covered</p>
              <div className="flex flex-wrap gap-1.5">
                {months.map(m => (
                  <span key={m} className="px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-[11px] font-bold text-orange-800">{m}</span>
                ))}
              </div>
            </div>
          )}

          {userNote && (
            <p className="text-xs text-slate-600"><strong className="text-slate-800">Note:</strong> {userNote}</p>
          )}

          <div className="rounded-lg bg-amber-50 border-l-4 border-orange-500 px-4 py-2.5 text-[10px] leading-relaxed text-slate-700 print-avoid-break">
            <strong className="text-slate-900">Terms:</strong> {credit
              ? 'This credit is applied automatically to the tenant’s next unpaid rent months.'
              : 'This deposit is held in escrow and is refundable at the end of the lease, less any unpaid rent or damage to the unit. Present this voucher when requesting a refund.'}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 pt-4 print-avoid-break">
            <div>
              <div className="h-10 border-b border-slate-500" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Tenant's signature</p>
              <p className="text-[10px] text-slate-400">{deposit.tenantName}</p>
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-slate-500" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Received by (Admin)</p>
              <p className="text-[10px] font-bold text-slate-800">{BUSINESS_PROFILE.managerName}</p>
              <p className="text-[9px] text-slate-400">For {BUSINESS_PROFILE.name}</p>
            </div>
          </div>
        </div>

        {/* Tear-off counterfoil */}
        <div className="relative border-t-2 border-dashed border-slate-400">
          <Scissors className="absolute -top-2.5 left-6 w-4 h-4 text-slate-400 bg-white" />
        </div>
        <div className="px-8 py-3 grid grid-cols-5 items-center gap-3 bg-orange-50/60 text-[11px] print-avoid-break">
          <span className="font-black uppercase tracking-widest text-orange-700">Tenant copy</span>
          <span className="font-mono font-bold">{slip}</span>
          <span className="font-semibold truncate">{deposit.tenantName} • {deposit.unitNumber}</span>
          <span>{depositDateLabel(deposit.heldSince)}</span>
          <span className="font-mono font-black text-slate-900 text-right">{amount}</span>
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
  const sum = (list: DepositRecord[], cur: 'USD' | 'SSP') =>
    list.reduce((s, d) => { const m = depositMoney(d); return m.currency === cur ? s + m.value : s; }, 0);
  const held = deposits.filter(d => d.status !== 'Refunded');
  const refunded = deposits.filter(d => d.status === 'Refunded');
  const both = (list: DepositRecord[]) => {
    const ssp = sum(list, 'SSP');
    return `${formatMoney(sum(list, 'USD'), 'USD')}${ssp ? ` + ${formatMoney(ssp, 'SSP')}` : ''}`;
  };

  return (
    <div className="bg-white text-slate-900 font-sans p-3">
      <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <DepositLetterhead />
        <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-[0.12em]">Deposit Statement</h2>
          <span className="text-[11px] font-semibold text-orange-300">Printed {depositDateLabel(new Date().toISOString().slice(0, 10))}</span>
        </div>

        <div className="px-8 py-6 space-y-5">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="border-l-4 border-orange-500 pl-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-orange-600">Statement for</span>
              <span className="block text-lg font-extrabold">{title}</span>
              {subtitle && <span className="text-slate-600">Unit {subtitle}</span>}
            </div>
            <div className="border-l-4 border-slate-900 pl-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-orange-600">Period</span>
              <span className="block text-sm font-bold">{periodLabel}</span>
              <span className="text-slate-600">{deposits.length} record{deposits.length === 1 ? '' : 's'}</span>
            </div>
            <div className="border-l-4 border-slate-300 pl-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-orange-600">Prepared by</span>
              <span className="block text-sm font-bold">{DEPOSIT_RECEIVED_BY}</span>
            </div>
          </div>

          <table className="w-full text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-3">Voucher</th>
                <th className="text-left py-2 px-3">Date deposited</th>
                {!subtitle && <th className="text-left py-2 px-3">Tenant / Unit</th>}
                <th className="text-left py-2 px-3">Covers</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deposits.map((d, i) => {
                const months = depositMonthLabels(d);
                const count = depositMonthCount(d);
                return (
                  <tr key={d.id} className={`print-avoid-break ${i % 2 ? 'bg-orange-50/40' : ''}`}>
                    <td className="py-2 px-3 font-mono font-bold">{d.depositSlip || d.id}</td>
                    <td className="py-2 px-3">{depositDateLabel(d.heldSince)}</td>
                    {!subtitle && <td className="py-2 px-3">{d.tenantName} • {d.unitNumber}</td>}
                    <td className="py-2 px-3">{isCreditDeposit(d) ? 'Advance credit' : months.join(', ') || (count ? `${count} month(s)` : '—')}</td>
                    <td className="py-2 px-3">{d.status === 'Held in Escrow' ? 'Held' : d.status}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{formatDepositAmount(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="ml-auto w-80 text-xs border-2 border-slate-900 rounded-lg overflow-hidden print-avoid-break">
            <div className="flex justify-between px-3 py-1.5"><span>Total deposited</span><span className="font-mono font-bold">{both(deposits)}</span></div>
            <div className="flex justify-between px-3 py-1.5 border-t border-slate-200"><span>Refunded</span><span className="font-mono font-bold">{both(refunded)}</span></div>
            <div className="flex justify-between px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white"><span className="font-bold">Currently held</span><span className="font-mono font-black">{both(held)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-12 pt-6 print-avoid-break">
            <div>
              <div className="h-10 border-b border-slate-500" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Checked by</p>
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-slate-500" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Admin</p>
              <p className="text-[10px] font-bold text-slate-800">{BUSINESS_PROFILE.managerName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
