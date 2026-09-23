import React from 'react';
import { Search, X, Wifi, WifiOff } from 'lucide-react';
import { CurrencyMode, NavigationTab, AdminUser, CommercialNotification } from '../types';
import { RealtimeStatus } from '../lib/supabaseService';

export interface HeaderProps {
  currentTab?: NavigationTab;
  currencyMode?: CurrencyMode;
  onCurrencyChange?: (mode: CurrencyMode) => void;
  onOpenRecordPayment?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  adminUser: AdminUser;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigate?: (tab: NavigationTab) => void;
  onLogout?: () => void;
  notifications?: CommercialNotification[];
  onMarkNotificationsRead?: () => void;
  realtimeStatus?: RealtimeStatus;
}

export const Header: React.FC<HeaderProps> = ({
  adminUser,
  searchQuery,
  onSearchChange,
  realtimeStatus = 'connected'
}) => {
  return (
    <header 
      id="mallcore-appbar" 
      className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-5 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 transition-all"
    >
      {/* Search Bar */}
      <div className="flex items-center flex-1 max-w-lg">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Quick search units, tenants, receipts..."
            className="w-full pl-10 pr-10 py-2 bg-slate-100/70 hover:bg-slate-100 border border-slate-200/70 hover:border-slate-300 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all"
          />
          {searchQuery ? (
            <button 
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-block absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Right Controls: Realtime Live Sync Status Badge + Admin Profile */}
      <div className="flex items-center gap-3 select-none shrink-0">
        
        {/* Real-time Multi-User Status Pill */}
        <div 
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            realtimeStatus === 'connected' 
              ? 'bg-emerald-50/80 border-emerald-200/90 text-emerald-800 shadow-2xs' 
              : realtimeStatus === 'connecting'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
          title={
            realtimeStatus === 'connected'
              ? 'Multi-user real-time synchronization active. Changes are synced instantly with Supabase.'
              : realtimeStatus === 'connecting'
              ? 'Connecting to live Supabase synchronization channel...'
              : 'Disconnected. Trying to reconnect to Supabase...'
          }
        >
          {realtimeStatus === 'connected' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold tracking-tight">Live Sync</span>
            </>
          )}

          {realtimeStatus === 'connecting' && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-medium tracking-tight">Connecting...</span>
            </>
          )}

          {(realtimeStatus === 'error' || realtimeStatus === 'disconnected') && (
            <>
              <WifiOff className="w-3 h-3 text-rose-500" />
              <span className="text-[11px] font-semibold text-rose-600">Offline</span>
            </>
          )}
        </div>

        {/* Admin Profile: Name and Email */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-default">
          <img 
            src={adminUser.avatar} 
            alt={adminUser.name} 
            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
          />
          <div className="flex flex-col text-left min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate leading-snug">
              {adminUser.name}
            </span>
            <span className="text-[11px] text-slate-500 truncate leading-snug">
              {adminUser.email}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
