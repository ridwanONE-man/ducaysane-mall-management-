import { PaymentRecord, PropertyUnit } from '../types';
import { buildRentLedger, MONTH_NAMES } from './rentLedger';
import { normalizeName, normalizeUnitNumber } from './printUtils';

export type PeriodStatus = 'Not paid' | 'Partial' | 'Paid' | 'Advance' | 'Outside lease' | 'Open';

export interface RentPeriodOption {
  value: string; // "October 2026", stored as the payment's accounting period
  status: PeriodStatus;
  remaining: number; // USD still owed for that month (rent for advance months)
}

const ADVANCE_MONTHS = 3;

// Months a tenant can pay for: from the start of the lease to a few months ahead,
// each marked from their payment history (same rules as the Reports rent ledger).
export function buildRentPeriodOptions(unit: PropertyUnit | null, payments: PaymentRecord[], today = new Date()) {
  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const rent = unit?.monthlyRateUSD || 0;
  const ledgerByIdx = new Map<number, { due: number; paid: number; status: string }>();
  let startIdx = todayIdx - 11;
  let lastIdx = todayIdx;

  if (unit?.currentTenant) {
    const tenant = normalizeName(unit.currentTenant.name);
    const unitNo = normalizeUnitNumber(unit.unitNumber);
    const ledger = buildRentLedger({
      payments: payments.filter(p => normalizeName(p.tenantName) === tenant && normalizeUnitNumber(p.unitNumber) === unitNo),
      monthlyRent: rent,
      currency: 'USD',
      leaseStart: unit.leaseStart,
      leaseEnd: unit.leaseEnd,
      isCurrent: true,
      today,
    });
    ledger.months.forEach(m => ledgerByIdx.set(m.year * 12 + m.month, m));
    if (ledger.months.length) {
      startIdx = ledger.months[0].year * 12 + ledger.months[0].month;
      const last = ledger.months[ledger.months.length - 1];
      lastIdx = Math.max(lastIdx, last.year * 12 + last.month);
    } else {
      startIdx = todayIdx; // lease starts in the future, or no lease dates yet
    }
  }

  const options: RentPeriodOption[] = [];
  for (let idx = startIdx; idx <= lastIdx + ADVANCE_MONTHS; idx++) {
    const value = `${MONTH_NAMES[idx % 12]} ${Math.floor(idx / 12)}`;
    const m = ledgerByIdx.get(idx);
    if (m && m.due > 0) {
      const remaining = Math.max(0, m.due - m.paid);
      options.push({ value, status: m.status === 'Paid' ? 'Paid' : m.status === 'Partial' ? 'Partial' : 'Not paid', remaining });
    } else if (m && m.paid > 0) {
      options.push({ value, status: 'Paid', remaining: 0 }); // paid in advance
    } else if (!unit?.currentTenant) {
      options.push({ value, status: 'Open', remaining: rent }); // walk-in / vacant unit: no history to check
    } else if (idx > todayIdx) {
      options.push({ value, status: 'Advance', remaining: rent });
    } else {
      options.push({ value, status: 'Outside lease', remaining: rent });
    }
  }

  // Suggest the oldest month still owed; otherwise the first month not yet paid from now on.
  const suggested =
    (!unit?.currentTenant ? options[todayIdx - startIdx] : undefined) ||
    options.find(o => o.status === 'Not paid' || o.status === 'Partial') ||
    options.find((o, i) => startIdx + i >= todayIdx && o.status !== 'Paid') ||
    options[options.length - 1];

  return {
    options,
    suggested,
    owing: options.filter(o => o.status === 'Not paid' || o.status === 'Partial'),
  };
}
