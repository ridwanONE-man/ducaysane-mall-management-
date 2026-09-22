import React from 'react';
import { Search, X } from 'lucide-react';
import { CurrencyMode, NavigationTab, AdminUser, CommercialNotification } from '../types';

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
}

export const Header: React.FC<HeaderProps> = ({
  adminUser,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header 
      id="mallcore-appbar" 
      className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-5 lg:px-8 flex items-center justify-between gap-6 sticky top-0 z-30 transition-all"
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

      {/* Admin Profile: Unclickable, displays Name and Email */}
      <div className="flex items-center select-none shrink-0">
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
