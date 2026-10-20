import { DepositRecord, PaymentRecord, PropertyUnit, TenantInfo } from '../types';
import { buildRentLedger, MONTH_NAMES, monthKey } from './rentLedger';
import { normalizeName, normalizeUnitNumber, parsePaymentDate } from './printUtils';

export type AccountMonthStatus = 'paid' | 'partial' | 'due' | 'upcoming';

export interface AccountMonth {
  key: string; // "2026-09"
  idx: number; // year * 12 + month, for ordering
  label: string; // "September 2026" (stored as the payment's accounting period)
  short: string; // "Sep 2026"
  due: number; // rent owed for the month (USD)
  paid: number;
  remaining: number;
  status: AccountMonthStatus;
  contracted: boolean; // part of the signed lease, so it counts in the balance
  payments: PaymentRecord[];
}

export interface TenantAccount {
  key: string;
  unit: PropertyUnit;
  tenant: TenantInfo;
  monthlyRent: number;
  months: AccountMonth[]; // lease start → a year ahead
  owing: AccountMonth[]; // due or partly paid, oldest first
  balance: number; // total owed now
  credit: number; // advance credit held (overpayments)
  creditDeposits: DepositRecord[];
  paidCount: number;
  lastPayment?: PaymentRecord;
}

// Overpayments are kept as deposit records whose slip starts with "CR-".
export const CREDIT_SLIP_PREFIX = 'CR-';
export const CREDIT_BANK_LABEL = 'Advance Credit (Overpayment)';
export const isCreditDeposit = (d: DepositRecord) =>
  (d.depositSlip || '').startsWith(CREDIT_SLIP_PREFIX) && d.status !== 'Refunded';

const MONTHS_AHEAD = 11;

export const accountKey = (name: string, unitNumber: string) =>
  `${normalizeName(name)}|${normalizeUnitNumber(unitNumber)}`;

export function buildTenantAccount(
  unit: PropertyUnit,
  payments: PaymentRecord[],
  deposits: DepositRecord[],
  today = new Date()
): TenantAccount | null {
  const tenant = unit.currentTenant;
  if (!tenant) return null;
  const key = accountKey(tenant.name, unit.unitNumber);
  const own = payments.filter(p => accountKey(p.tenantName, p.unitNumber) === key);
  const monthlyRent = unit.monthlyRateUSD || 0;

  const ledger = buildRentLedger({
    payments: own,
    monthlyRent,
    currency: 'USD',
    leaseStart: unit.leaseStart,
    leaseEnd: unit.leaseEnd,
    isCurrent: true,
    today,
  });
  const byIdx = new Map(ledger.months.map(m => [m.year * 12 + m.month, m]));

  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const startIdx = ledger.months.length ? ledger.months[0].year * 12 + ledger.months[0].month : todayIdx;
  const lastLedgerIdx = ledger.months.length
    ? ledger.months[ledger.months.length - 1].year * 12 + ledger.months[ledger.months.length - 1].month
    : todayIdx;
  const endIdx = Math.max(todayIdx + MONTHS_AHEAD, lastLedgerIdx);

  const months: AccountMonth[] = [];
  for (let idx = startIdx; idx <= endIdx; idx++) {
    const year = Math.floor(idx / 12);
    const month = idx % 12;
    const m = byIdx.get(idx);
    // Months after the lease aren't owed but are what an advance payment covers.
    const due = m && m.due > 0 ? m.due : monthlyRent;
    const paid = m?.paid || 0;
    const remaining = Math.max(0, Math.round((due - paid) * 100) / 100);
    const owedNow = Boolean(m && m.due > 0);
    let status: AccountMonthStatus;
    if (paid > 0 && remaining <= 0) status = 'paid';
    else if (owedNow && paid > 0) status = 'partial';
    else if (owedNow) status = 'due';
    else status = paid > 0 ? 'partial' : 'upcoming';
    months.push({
      key: monthKey(year, month),
      idx,
      label: `${MONTH_NAMES[month]} ${year}`,
      short: `${MONTH_NAMES[month].slice(0, 3)} ${year}`,
      due,
      paid,
      remaining,
      status,
      contracted: owedNow,
      payments: m?.payments || [],
    });
  }

  const owing = months.filter(m => m.contracted && (m.status === 'due' || m.status === 'partial'));
  const creditDeposits = deposits.filter(d => isCreditDeposit(d) && accountKey(d.tenantName, d.unitNumber) === key);
  const lastPayment = [...own].sort(
    (a, b) => (parsePaymentDate(b.date)?.getTime() || 0) - (parsePaymentDate(a.date)?.getTime() || 0)
  )[0];

  return {
    key,
    unit,
    tenant,
    monthlyRent,
    months,
    owing,
    balance: Math.round(owing.reduce((s, m) => s + m.remaining, 0) * 100) / 100,
    credit: Math.round(creditDeposits.reduce((s, d) => s + d.amountUSD, 0) * 100) / 100,
    creditDeposits,
    paidCount: months.filter(m => m.status === 'paid').length,
    lastPayment,
  };
}

export function buildTenantAccounts(units: PropertyUnit[], payments: PaymentRecord[], deposits: DepositRecord[]) {
  const today = new Date();
  return units
    .map(u => buildTenantAccount(u, payments, deposits, today))
    .filter((a): a is TenantAccount => a !== null)
    .sort((a, b) => a.tenant.name.localeCompare(b.tenant.name));
}

// ---------------------------------------------------------------------------
// Turning a Smart Pay selection into payment rows
// ---------------------------------------------------------------------------

export interface MonthAllocation {
  month: AccountMonth;
  fromCredit: number;
  fromCash: number;
}

// Applies credit first, then cash, to the selected months oldest-first.
// Whatever cash is left over becomes new advance credit.
export function allocatePayment(selected: AccountMonth[], cash: number, creditToUse: number) {
  const ordered = [...selected].sort((a, b) => a.idx - b.idx);
  let credit = Math.max(0, creditToUse);
  let money = Math.max(0, cash);
  const allocations: MonthAllocation[] = ordered.map(month => {
    let need = month.remaining;
    const fromCredit = Math.min(credit, need);
    credit -= fromCredit;
    need -= fromCredit;
    const fromCash = Math.min(money, need);
    money -= fromCash;
    return { month, fromCredit: round(fromCredit), fromCash: round(fromCash) };
  });
  return {
    allocations,
    creditUsed: round(Math.max(0, creditToUse) - credit),
    excess: round(money),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
