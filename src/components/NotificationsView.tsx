import React, { useState } from 'react';
import { Bell, AlertTriangle, CalendarClock, Wrench, CreditCard, CheckCheck, X, BellOff } from 'lucide-react';
import { CommercialNotification } from '../types';
import { ClearAllButton } from './DeleteControls';

interface NotificationsViewProps {
  notifications: CommercialNotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const TYPE_STYLES: Record<CommercialNotification['type'], { icon: React.ElementType; tint: string; label: string }> = {
  arrears: { icon: AlertTriangle, tint: 'bg-rose-50 text-rose-600', label: 'Arrears' },
  lease: { icon: CalendarClock, tint: 'bg-amber-50 text-amber-600', label: 'Lease' },
  maintenance: { icon: Wrench, tint: 'bg-slate-100 text-slate-600', label: 'Units' },
  payment: { icon: CreditCard, tint: 'bg-emerald-50 text-emerald-600', label: 'Payment' },
};

type Filter = 'all' | 'unread';

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAllRead,
  onMarkRead,
  onDelete,
  onClearAll,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const unread = notifications.filter(n => !n.read).length;
  const shown = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Bell className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notifications</h1>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-black">{unread} new</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Payment alerts, lease changes and unit updates.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unread === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Mark all read</span>
          </button>
          <ClearAllButton
            count={notifications.length}
            itemLabel="notifications"
            onClear={onClearAll}
            message="All notifications are removed from this device. This cannot be undone."
          />
        </div>
      </div>

      <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
        {([['all', `All (${notifications.length})`], ['unread', `Unread (${unread})`]] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === f ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {shown.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <BellOff className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-bold text-slate-800 text-sm">{filter === 'unread' ? 'You’re all caught up' : 'No notifications'}</p>
            <p className="text-xs text-slate-400 mt-1">Payment alerts, lease changes and unit updates will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map(n => {
              const style = TYPE_STYLES[n.type] || TYPE_STYLES.maintenance;
              const Icon = style.icon;
              return (
                <li
                  key={n.id}
                  onClick={() => !n.read && onMarkRead(n.id)}
                  className={`group relative flex items-start gap-3.5 p-4 pr-14 transition-colors ${
                    n.read ? 'hover:bg-slate-50/70' : 'bg-blue-50/40 hover:bg-blue-50/70 cursor-pointer'
                  }`}
                >
                  {!n.read && <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.tint}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs ${n.read ? 'font-semibold text-slate-700' : 'font-extrabold text-slate-900'}`}>{n.title}</span>
                      {n.priority === 'high' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[9px] font-black uppercase">High</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                      <span className="font-bold uppercase tracking-wider">{style.label}</span>
                      <span>•</span>
                      <span>{n.timestamp}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onDelete(n.id); }}
                    className="absolute right-3 top-3.5 p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 transition-all cursor-pointer"
                    title="Dismiss notification"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
