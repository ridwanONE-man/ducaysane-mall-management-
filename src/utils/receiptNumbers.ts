// Next number in this year's receipt sequence: #REC-2026-0001, #REC-2026-0002, ...
export function nextReceiptNumber(existing: string[], year = new Date().getFullYear()): string {
  const pattern = new RegExp(`REC-${year}-(\\d+)`);
  const last = existing.reduce((max, r) => {
    const m = pattern.exec(r || '');
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `#REC-${year}-${String(last + 1).padStart(4, '0')}`;
}
