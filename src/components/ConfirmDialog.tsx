import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  // Short highlighted line, e.g. the receipt number or tenant being deleted
  subject?: string;
  confirmLabel?: string;
  // When set, the user must type this word before confirming (used for "Clear All")
  requireText?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Falls back to the browser dialog if rendered outside the provider.
export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  return ctx || (async (o: ConfirmOptions) => window.confirm(`${o.title}${o.subject ? `\n\n${o.subject}` : ''}`));
};

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback<ConfirmFn>(options => new Promise<boolean>(resolve => {
    setTyped('');
    setPending({ ...options, resolve });
  }), []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    (pending.requireText ? inputRef.current : cancelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const canConfirm = !pending?.requireText || typed.trim().toUpperCase() === pending.requireText.toUpperCase();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onMouseDown={e => { if (e.target === e.currentTarget) close(false); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="p-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 ring-8 ring-rose-50/60 text-rose-600 flex items-center justify-center shrink-0">
                  {pending.requireText ? <AlertTriangle className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 id="confirm-title" className="text-base font-extrabold text-slate-900">{pending.title}</h3>
                  {pending.subject && (
                    <p className="mt-1.5 inline-block max-w-full truncate px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold font-mono">
                      {pending.subject}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-slate-500 leading-relaxed">
                    {pending.message || 'This will be removed from the database for everyone and cannot be undone.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="p-1.5 -mt-1 -mr-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                  aria-label="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {pending.requireText && (
                <div className="mt-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Type <span className="font-mono font-black text-rose-600">{pending.requireText}</span> to confirm
                  </label>
                  <input
                    ref={inputRef}
                    value={typed}
                    onChange={e => setTyped(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && canConfirm) close(true); }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white focus:ring-3 focus:ring-rose-100"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => close(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => close(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {pending.confirmLabel || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
