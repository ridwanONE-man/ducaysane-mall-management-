import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmOptions, useConfirm } from './ConfirmDialog';

interface DeleteButtonProps {
  onDelete: () => void;
  confirm: ConfirmOptions;
  label?: string; // shown as text next to the icon; icon-only when omitted
  title?: string;
  className?: string;
}

// Row-level delete: a quiet icon that turns red on hover and asks before deleting.
export const DeleteButton: React.FC<DeleteButtonProps> = ({ onDelete, confirm: options, label, title, className = '' }) => {
  const confirm = useConfirm();
  return (
    <button data-edit
      type="button"
      onClick={async e => {
        e.stopPropagation();
        if (await confirm(options)) onDelete();
      }}
      title={title || options.title}
      aria-label={title || options.title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 transition-colors cursor-pointer align-middle ${
        label ? 'px-2.5 py-1.5 text-xs font-bold' : 'p-1.5'
      } ${className}`}
    >
      <Trash2 className="w-4 h-4" />
      {label && <span>{label}</span>}
    </button>
  );
};

interface ClearAllButtonProps {
  count: number;
  itemLabel: string; // e.g. "payments"
  onClear: () => void;
  message?: React.ReactNode;
  size?: 'sm' | 'md';
}

// Page-level "Clear All": outlined red button; the dialog asks the user to type DELETE.
export const ClearAllButton: React.FC<ClearAllButtonProps> = ({ count, itemLabel, onClear, message, size = 'md' }) => {
  const confirm = useConfirm();
  return (
    <button data-edit
      type="button"
      disabled={count === 0}
      onClick={async () => {
        const ok = await confirm({
          title: `Clear all ${itemLabel}?`,
          subject: `${count} ${itemLabel} will be deleted`,
          message: message || `Every record is removed from the database for all users. This cannot be undone.`,
          confirmLabel: `Delete ${count} ${itemLabel}`,
          requireText: 'DELETE',
        });
        if (ok) onClear();
      }}
      className={`inline-flex items-center gap-1.5 bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-600 font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white ${
        size === 'sm' ? 'px-2.5 py-1 rounded-lg text-[11px]' : 'px-3.5 py-2 rounded-xl text-xs'
      }`}
    >
      <Trash2 className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} />
      <span>Clear All</span>
      {count > 0 && (
        <span className="ml-0.5 px-1.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">{count}</span>
      )}
    </button>
  );
};
