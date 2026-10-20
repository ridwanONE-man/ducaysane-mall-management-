import { PaymentRecord } from '../types';
import { parsePaymentDate } from './printUtils';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type LedgerStatus = 'Paid' | 'Partial' | 'Unpaid';

export interface LedgerMonth {
  key: string; // "2026-09"
  year: number;
  month: number; // 0-11
  label: string; // "September 2026"
  due: number;
  paid: number;
  balance: number; // due - paid for this month (negative = overpaid)
  running: number; // cumulative balance up to and including this month
  status: LedgerStatus;
  payments: PaymentRecord[];
}

export interface RentLedger {
  currency: 'USD' | 'SSP';
  monthlyRent: number;
  months: LedgerMonth[];
}

export const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

const MONTH_TOKEN = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b(\d{4})\b/gi;
const MONTH_PREFIXES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Which rent month(s) a payment covers. Reads the accounting period
// ("September 2026", "September & October 2026", "Dec 2025 - Jan 2026"),
// falling back to the month of the payment date.
export function paymentRentMonths(p: PaymentRecord): { year: number; month: number }[] {
  const paidOn = parsePaymentDate(p.date);
  const result: { year: number; month: number }[] = [];
  let pending: number[] = [];

  for (const match of (p.accountingPeriod || '').matchAll(MONTH_TOKEN)) {
    if (match[2]) {
      const year = Number(match[2]);
      pending.forEach(month => result.push({ year, month }));
      pending = [];
    } else {
      pending.push(MONTH_PREFIXES.indexOf(match[1].slice(0, 3).toLowerCase()));
    }
  }
  if (pending.length && paidOn) {
    pending.forEach(month => result.push({ year: paidOn.getFullYear(), month }));
  }

  if (result.length === 0 && paidOn) {
    result.push({ year: paidOn.getFullYear(), month: paidOn.getMonth() });
  }
  return result;
}

const toIndex = (year: number, month: number) => year * 12 + month;

// Last month billed by a lease. A lease ending on the same day of the month it started
// (1 Sep → 1 Oct, 20 Oct → 20 Jan) covers whole months only: Sep; Oct, Nov, Dec.
export function lastLeaseMonthIndex(start: Date | null, end: Date): number {
  const endIdx = toIndex(end.getFullYear(), end.getMonth());
  const startDay = start ? start.getDate() : 1;
  return end.getDate() <= startDay ? endIdx - 1 : endIdx;
}

// Number of months a lease bills, e.g. 3 for a 3-month lease.
export function leaseMonthCount(leaseStart?: string, leaseEnd?: string): number {
  const start = parsePaymentDate(leaseStart);
  const end = parsePaymentDate(leaseEnd);
  if (!start || !end) return 0;
  return Math.max(0, lastLeaseMonthIndex(start, end) - toIndex(start.getFullYear(), start.getMonth()) + 1);
}

interface BuildLedgerInput {
  payments: PaymentRecord[];
  monthlyRent: number;
  currency: 'USD' | 'SSP';
  leaseStart?: string;
  leaseEnd?: string;
  isCurrent: boolean;
  today?: Date;
}

// Month-by-month rent ledger from the start of the tenancy. Payments in other
// currencies are ignored; a payment covering several months is split evenly.
export function buildRentLedger({
  payments,
  monthlyRent,
  currency,
  leaseStart,
  leaseEnd,
  isCurrent,
  today = new Date(),
}: BuildLedgerInput): RentLedger {
  const relevant = payments.filter(p => p.currency === currency);
  const allocations = new Map<number, { amount: number; payments: PaymentRecord[] }>();

  relevant.forEach(p => {
    const months = paymentRentMonths(p);
    if (!months.length) return;
    const share = p.amount / months.length;
    months.forEach(({ year, month }) => {
      const idx = toIndex(year, month);
      const slot = allocations.get(idx) || { amount: 0, payments: [] };
      slot.amount += share;
      if (!slot.payments.includes(p)) slot.payments.push(p);
      allocations.set(idx, slot);
    });
  });

  const allocated = [...allocations.keys()];
  const start = parsePaymentDate(leaseStart);
  const end = parsePaymentDate(leaseEnd);
  const todayIdx = toIndex(today.getFullYear(), today.getMonth());

  let startIdx = start ? toIndex(start.getFullYear(), start.getMonth()) : undefined;
  if (allocated.length) startIdx = Math.min(startIdx ?? Infinity, ...allocated);
  if (startIdx === undefined) startIdx = todayIdx;

  // A current tenant owes rent for every month of the lease they signed (the whole
  // duration goes on the balance up front); without an end date, up to this month.
  // Former tenants stop at their last paid month.
  let dueUntilIdx = isCurrent ? todayIdx : (allocated.length ? Math.max(...allocated) : startIdx);
  if (end) {
    const leaseLast = lastLeaseMonthIndex(start, end);
    dueUntilIdx = isCurrent ? leaseLast : Math.min(dueUntilIdx, leaseLast);
  }
  // Advance payments for future months are still listed.
  const lastIdx = Math.max(dueUntilIdx, ...allocated, startIdx);

  const months: LedgerMonth[] = [];
  let running = 0;
  for (let idx = startIdx; idx <= lastIdx; idx++) {
    const year = Math.floor(idx / 12);
    const month = idx % 12;
    const slot = allocations.get(idx);
    if (idx > dueUntilIdx && !slot) continue;
    const due = idx <= dueUntilIdx ? monthlyRent : 0;
    const paid = Math.round((slot?.amount || 0) * 100) / 100;
    running += due - paid;
    const status: LedgerStatus = paid >= due && (paid > 0 || due === 0) ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
    months.push({
      key: monthKey(year, month),
      year,
      month,
      label: `${MONTH_NAMES[month]} ${year}`,
      due,
      paid,
      balance: due - paid,
      running,
      status,
      payments: slot?.payments || [],
    });
  }

  return { currency, monthlyRent, months };
}

export function summarizeLedger(months: LedgerMonth[]) {
  const totalDue = months.reduce((s, m) => s + m.due, 0);
  const totalPaid = months.reduce((s, m) => s + m.paid, 0);
  const last = months[months.length - 1];
  return {
    totalDue,
    totalPaid,
    unpaidCount: months.filter(m => m.status === 'Unpaid').length,
    partialCount: months.filter(m => m.status === 'Partial').length,
    paidCount: months.filter(m => m.status === 'Paid' && m.paid > 0).length,
    // Balance carried to the end of these months (includes anything brought forward).
    outstanding: last ? Math.max(0, last.running) : 0,
    credit: last && last.running < 0 ? -last.running : 0,
  };
}
