import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Check, Coins, Trash2, Save, Info } from 'lucide-react';
import { DepositRecord } from '../types';
import { TenantAccount, depositMonthLabels, isAmountDeposit } from '../utils/tenantAccount';
import { depositIn } from '../utils/currency';
import { formatMoney } from '../utils/printUtils';
import { depositDateLabel, formatDepositAmount } from './DepositVoucher';
import { useConfirm } from './ConfirmDialog';

interface DepositManageModalProps {
  account: TenantAccount | null;
  onClose: () => void;
  // Keep only these months on the deposit; its money goes down by the removed months
  onSaveMonths: (deposit: DepositRecord, keep: string[]) => void;
  // Remove the deposit and its money entirely
  onClearDeposit: (deposit: DepositRecord) => void;
}


export const DepositManageModal: React.FC<DepositManageModalProps> = ({ account, onClose, onSaveMonths, onClearDeposit }) => {
  // Amounts are shown in the tenant's rent currency ($ or SSP)
  const usd = (n: number) => formatMoney(n, account?.currency || 'USD');
  const confirm = useConfirm();
  // Months still ticked, per deposit id
  const [kept, setKept] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!account) return;
    setKept(Object.fromEntries(account.securityDeposits.map(d => [d.id, depositMonthLabels(d)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.key, account?.securityDeposits.length]);

  if (!account) return null;
  const deposits = account.securityDeposits;

  const toggle = (id: string, label: string) =>
    setKept(prev => {
      const cur = prev[id] || [];
      return { ...prev, [id]: cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label] };
    });

  const clear = async (d: DepositRecord) => {
    const ok = await confirm({
      title: 'Clear this deposit?',
      subject: `${d.depositSlip || d.id} • ${formatDepositAmount(d)}`,
      message: 'The deposit and its money are removed from the tenant, the deposit list and cashflow.',
      confirmLabel: 'Clear deposit',
    });
    if (ok) onClearDeposit(d);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="flex items-start justify-between gap-3 p-6 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate">Manage Deposit — {account.tenant.name}</h2>
              <p className="text-xs text-slate-500">{account.unit.unitNumber} • {usd(account.depositHeld)} held • Rent {usd(account.monthlyRent)}/month</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {deposits.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-400">This tenant has no deposit held.</p>
          )}

          {deposits.map(d => {
            const labels = depositMonthLabels(d);
            const keep = kept[d.id] || labels;
            const removed = labels.filter(l => !keep.includes(l));
            const held = depositIn(d, account.currency);
            const perMonth = labels.length ? held / labels.length : 0;
            const newAmount = Math.round(perMonth * keep.length * 100) / 100;
            const isAmount = isAmountDeposit(d) || labels.length === 0;

            return (
              <div key={d.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-black text-orange-600">{d.depositSlip || d.id}</p>
                    <p className="text-[11px] text-slate-500">{depositDateLabel(d.heldSince)} • {isAmount ? 'Any amount — not for a month' : `${labels.length} month(s)`}</p>
                  </div>
                  <span className="text-lg font-black text-slate-900">{formatDepositAmount(d)}</span>
                </div>

                {!isAmount && (
                  <>
                    <p className="mt-3 text-[11px] font-bold text-slate-600">Untick a month to remove it from the deposit:</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {labels.map(l => {
                        const on = keep.includes(l);
                        return (
                          <button
                            key={l}
                            type="button"
                            onClick={() => toggle(d.id, l)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                              on ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-white border-dashed border-slate-300 text-slate-400 line-through'
                            }`}
                          >
                            {on ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {l}
                          </button>
                        );
                      })}
                    </div>
                    {removed.length > 0 && (
                      <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          Removes {removed.join(', ')} and <strong>{usd(held - newAmount)}</strong>. The deposit becomes <strong>{usd(newAmount)}</strong>
                          {keep.length === 0 ? ' — it will be cleared.' : '.'}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => clear(d)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer"
                  >
                    {isAmount ? <Coins className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />} Clear deposit
                  </button>
                  {!isAmount && (
                    <button
                      type="button"
                      disabled={removed.length === 0}
                      onClick={() => (keep.length === 0 ? clear(d) : onSaveMonths(d, keep))}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-extrabold shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3.5 h-3.5" /> Save changes
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
