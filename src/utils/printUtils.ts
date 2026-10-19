// Payment dates are stored as free text ("2026-09-01" or "Oct 18, 2026").
// ISO dates are parsed as local dates so they don't shift a day across time zones.
export function parsePaymentDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function formatLongDate(dateStr?: string | Date): string {
  const d = dateStr instanceof Date ? dateStr : parsePaymentDate(dateStr);
  if (!d) return typeof dateStr === 'string' ? dateStr : '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMoney(amount: number, currency: 'USD' | 'SSP'): string {
  if (currency === 'USD') {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} SSP`;
}

// "Unit G-001", "G001" and "g 001" all refer to the same unit.
export function normalizeUnitNumber(unit?: string): string {
  return (unit || '').toLowerCase().replace(/^unit\s*/, '').replace(/[^a-z0-9]/g, '');
}

export function normalizeName(name?: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
