import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Check, Landmark, Info, CalendarCheck, Coins } from 'lucide-react';
import { AccountMonth, TenantAccount } from '../utils/tenantAccount';

export type DepositMode = 'months' | 'amount';

export interface TenantDepositRequest {
  account: TenantAccount;
  mode: DepositMode;
  months: AccountMonth[];
  amount: number;
  bankAccount: string;
  notes: string;
}

interface TenantDepositModalProps {
  account: TenantAccount | null;
  nextSlip: string;
  onClose: () => void;
  onConfirm: (request: TenantDepositRequest) => void;
}

const BANKS = [
  'Stanbic Bank - Escrow Liability #8892-01',
  'Ecobank Commercial Escrow #4410-09',
  'Central Vault Cash Float',
];

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TenantDepositModal: React.FC<TenantDepositModalProps> = ({ account, nextSlip, onClose, onConfirm }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amountText, setAmountText] = useState('');
  const [bankAccount, setBankAccount] = useState(BANKS[0]);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<DepositMode>('months');

  const todayIdx = new Date().getFullYear() * 12 + new Date().getMonth();
  // A deposit covers months from now on that no other deposit covers yet
  const months = account ? account.months.filter(m => m.idx >= todayIdx) : [];
  const isCovered = (m: AccountMonth) => Boolean(account?.depositMonthKeys.has(m.key));

  useEffect(() => {
    if (!account) return;
    const first = account.months.find(m => m.idx >= todayIdx && !account.depositMonthKeys.has(m.key));
    setSelected(new Set(first ? [first.key] : []));
    setAmountText('');
    setBankAccount(BANKS[0]);
    setNotes('');
    setMode('months');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.key]);

  if (!account) return null;

  const chosen = mode === 'months' ? months.filter(m => selected.has(m.key)) : [];
  const suggested = chosen.length * account.monthlyRent;
  const amount = amountText.trim() === '' ? (mode === 'months' ? suggested : 0) : Math.max(0, Number(amountText) || 0);
  const canSave = amount > 0 && (mode === 'amount' || chosen.length > 0);

  const toggle = (m: AccountMonth) => {
    if (isCovered(m)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(m.key)) next.delete(m.key); else next.add(m.key);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        <div className="flex items-start justify-between gap-3 p-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate">Add Deposit — {account.tenant.name}</h2>
              <p className="text-xs text-slate-500">
                {account.unit.unitNumber} • Rent {usd(account.monthlyRent)}/month • Slip <span className="font-mono font-bold">{nextSlip}</span>
              </p>
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                <Check className="w-3 h-3" /> Rent paid up to date
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Deposit type */}
          <div className="grid grid-cols-2 gap-2">
            {([
              ['months', CalendarCheck, 'By months', 'Pick months • rent × months'],
              ['amount', Coins, 'Any amount', 'Free amount • not for a month'],
            ] as const).map(([m, Icon, title, sub]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setAmountText(''); }}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all cursor-pointer ${
                  mode === m ? 'border-orange-500 bg-orange-50/70 shadow-sm' : 'border-slate-200 hover:border-orange-200'
                }`}
              >
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${mode === m ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold text-slate-900">{title}</span>
                  <span className="block text-[10px] text-slate-500">{sub}</span>
                </span>
              </button>
            ))}
          </div>

          {mode === 'months' ? (
          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">Select the months this deposit covers</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {months.map(m => {
                const covered = isCovered(m);
                const isSel = selected.has(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={covered}
                    onClick={() => toggle(m)}
                    className={`relative rounded-xl border px-2 py-2.5 text-center transition-all ${
                      covered
                        ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-not-allowed'
                        : isSel
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30 cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer'
                    }`}
                  >
                    <span className="block text-xs font-extrabold">{m.short}</span>
                    <span className="block text-[9px] font-bold mt-0.5 opacity-90">
                      {covered ? 'Deposit held' : m.status === 'paid' ? 'Rent paid' : usd(account.monthlyRent)}
                    </span>
                    {isSel && <Check className="absolute top-1 right-1 w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[11px] text-amber-900 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This deposit is <strong>not for a specific month</strong>. When a rent month falls due and is unpaid, the rent is taken from this money automatically until it runs out.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deposit amount ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={amountText}
                onChange={e => setAmountText(e.target.value)}
                placeholder={mode === 'months' ? `${chosen.length} × ${usd(account.monthlyRent)} = ${usd(suggested)}` : 'Enter any amount, e.g. 250'}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Held in</label>
              <div className="relative">
                <Landmark className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. refundable at end of lease"
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{mode === 'months' ? 'Months covered' : 'Type'}</span>
              <span className="font-bold text-slate-900">{mode === 'amount' ? 'Any amount — not for a month' : chosen.length ? chosen.map(m => m.short).join(', ') : '—'}</span>
            </div>
            {account.depositHeld > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Deposit already held</span>
                <span className="font-bold text-slate-900">{usd(account.depositHeld)}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-2 mt-1 border-t border-blue-200">
              <span className="text-sm font-extrabold text-slate-900">Deposit to hold</span>
              <span className="text-2xl font-black text-blue-700">{usd(amount)}</span>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold pt-1">
              <Info className="w-3 h-3" /> When the month falls due, its rent is paid from this deposit automatically.
            </p>
          </div>

          <button
            type="button"
            disabled={!canSave}
            onClick={() => onConfirm({ account, mode, months: chosen, amount, bankAccount, notes: notes.trim() })}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4" />
            Hold Deposit {amount > 0 ? `• ${usd(amount)}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
