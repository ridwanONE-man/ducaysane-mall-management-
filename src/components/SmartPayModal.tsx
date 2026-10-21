import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarCheck, Check, Receipt, CreditCard, Info, AlertTriangle } from 'lucide-react';
import { PaymentMethodType, PaymentRecord } from '../types';
import { AccountMonth, MonthAllocation, TenantAccount, allocatePayment } from '../utils/tenantAccount';
import { formatLongDate } from '../utils/printUtils';

export interface SmartPayRequest {
  account: TenantAccount;
  allocations: MonthAllocation[];
  cash: number;
  method: PaymentMethodType;
  remark: string;
  transferId: string;
}

interface SmartPayModalProps {
  account: TenantAccount | null;
  onClose: () => void;
  onConfirm: (request: SmartPayRequest) => void;
  onViewReceipt: (payment: PaymentRecord) => void;
  nextReceiptNumber: string;
}

const METHODS: PaymentMethodType[] = [
  'Cash (Office Management Desk)',
  'EVC Plus / Mobile Money',
  'Bank Wire Transfer',
  'Cheque / Slip',
];

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SmartPayModal: React.FC<SmartPayModalProps> = ({ account, onClose, onConfirm, onViewReceipt, nextReceiptNumber }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethodType>('Cash (Office Management Desk)');
  const [remark, setRemark] = useState('');
  const [transferId, setTransferId] = useState('');
  const [viewingMonth, setViewingMonth] = useState<AccountMonth | null>(null);

  // Fresh form for each tenant: months with a balance are pre-selected
  useEffect(() => {
    if (!account) return;
    setSelected(new Set(account.owing.map(m => m.key)));
    setAmountText('');
    setMethod('Cash (Office Management Desk)');
    setRemark('');
    setTransferId('');
    setViewingMonth(null);
    // Reset only when a different tenant is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.key]);

  const todayIdx = new Date().getFullYear() * 12 + new Date().getMonth();
  const selectedMonths = useMemo(
    () => (account ? account.months.filter(m => selected.has(m.key)) : []),
    [account, selected]
  );
  const gross = selectedMonths.reduce((s, m) => s + m.remaining, 0);
  const cashNeeded = gross;
  const cash = amountText.trim() === '' ? cashNeeded : Math.max(0, Number(amountText) || 0);
  const { allocations, excess } = allocatePayment(selectedMonths, cash);
  const shortfall = Math.max(0, cashNeeded - cash);

  if (!account) return null;

  const toggle = (m: AccountMonth) => {
    if (m.status === 'paid') {
      setViewingMonth(v => (v?.key === m.key ? null : m));
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(m.key)) next.delete(m.key); else next.add(m.key);
      return next;
    });
  };

  // Paying more than the selected months is not allowed
  const canConfirm = selectedMonths.length > 0 && cash > 0 && excess <= 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-6 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="truncate">Smart Pay — {account.tenant.name}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {account.unit.unitNumber} • {account.unit.floor} • Rent {usd(account.monthlyRent)}/month
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {account.balance > 0 ? (
                <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black">Balance {usd(account.balance)}</span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black">✓ Paid up</span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Month grid */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
              Select months — balance months are pre-selected
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {account.months.map(m => {
                const isSel = selected.has(m.key);
                const owedNow = m.contracted && m.status !== 'paid';
                const cls =
                  m.status === 'paid'
                    ? `bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 ${viewingMonth?.key === m.key ? 'ring-2 ring-emerald-400' : ''}`
                    : isSel && owedNow
                    ? 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-500/30'
                    : isSel
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                    : owedNow
                    ? 'bg-white border-rose-300 text-rose-700 hover:bg-rose-50'
                    : m.idx === todayIdx + 1
                    ? 'bg-emerald-50/60 border-emerald-200 text-slate-700 hover:bg-emerald-50'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50';
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggle(m)}
                    title={m.status === 'paid' ? 'Paid — click to see the voucher' : isSel ? 'Click to unselect' : 'Click to select'}
                    className={`relative rounded-xl border px-2 py-2.5 text-center transition-all cursor-pointer ${cls}`}
                  >
                    <span className="block text-xs font-extrabold">{m.short}</span>
                    {m.status === 'paid' ? (
                      <span className="block text-[9px] font-bold mt-0.5">✓ Paid</span>
                    ) : owedNow || m.status === 'partial' ? (
                      <span className="block text-[9px] font-bold mt-0.5 opacity-90">
                        {m.status === 'partial' ? 'Left' : 'Due'} {usd(m.remaining)}
                      </span>
                    ) : isSel ? (
                      <span className="block text-[9px] font-bold mt-0.5">Advance {usd(m.remaining)}</span>
                    ) : null}
                    {isSel && <Check className="absolute top-1 right-1 w-3 h-3" />}
                  </button>
                );
              })}
            </div>

            {/* Vouchers of a paid month */}
            {viewingMonth && (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 animate-in fade-in">
                <p className="text-xs font-bold text-emerald-900 mb-2">
                  {viewingMonth.label} — paid {usd(viewingMonth.paid)}
                </p>
                <div className="space-y-1.5">
                  {viewingMonth.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-emerald-100 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-blue-700">{p.receiptNumber}</span>
                        <span className="text-slate-400"> • {formatLongDate(p.date)} • {p.paymentMethod}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-emerald-700">{usd(p.amount)}</span>
                        <button
                          type="button"
                          onClick={() => onViewReceipt(p)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-bold cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Voucher
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Amount, method, remark */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount to pay ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={amountText}
                onChange={e => setAmountText(e.target.value)}
                placeholder={`Full: ${usd(cashNeeded)}`}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as PaymentMethodType)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Remark</label>
              <input
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="Optional note"
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {(method === 'EVC Plus / Mobile Money' || method === 'Bank Wire Transfer') && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3">
              <label className="block text-xs font-bold text-blue-900 mb-1">
                Transfer ID <span className="font-normal text-blue-600">(optional)</span>
              </label>
              <input
                value={transferId}
                onChange={e => setTransferId(e.target.value)}
                placeholder="From the transfer message, e.g. 15654768550"
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-blue-700 mt-1">Printed on the voucher so the transfer can be matched to the statement later.</p>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600"><span>Months selected</span><span className="font-bold text-slate-900">{selectedMonths.length}</span></div>
            <div className="flex justify-between text-slate-600"><span>Gross total</span><span className="font-bold text-slate-900">{usd(gross)}</span></div>
            <div className="flex justify-between items-end pt-2 mt-1 border-t border-emerald-200">
              <span className="text-sm font-extrabold text-slate-900">Total to pay</span>
              <span className="text-2xl font-black text-emerald-700">{usd(cash)}</span>
            </div>
            {shortfall > 0 && selectedMonths.length > 0 && (
              <p className="flex items-center gap-1.5 text-amber-700 font-semibold pt-1">
                <Info className="w-3.5 h-3.5" /> Partial payment — {usd(shortfall)} stays as balance (applied oldest month first).
              </p>
            )}
            {excess > 0 && (
              <p className="flex items-center gap-1.5 text-rose-700 font-semibold pt-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {usd(excess)} more than the selected months. Select more months, or take the extra as a deposit on the Deposits page.
              </p>
            )}
            <p className="text-[10px] text-slate-500 font-semibold pt-1">
              Months already paid are skipped automatically. Voucher {nextReceiptNumber} opens after payment.
            </p>
          </div>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm({ account, allocations, cash, method, remark: remark.trim(), transferId: transferId.trim() })}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CreditCard className="w-4 h-4" />
            Confirm Payment {cash > 0 ? `• ${usd(cash)}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
