import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Wifi, WifiOff, Store, Users, Printer, ArrowRight, CornerDownLeft } from 'lucide-react';
import { CurrencyMode, NavigationTab, AdminUser, CommercialNotification, PropertyUnit, PaymentRecord } from '../types';
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
  units?: PropertyUnit[];
  payments?: PaymentRecord[];
}

export const Header: React.FC<HeaderProps> = ({
  adminUser,
  searchQuery,
  onSearchChange,
  onNavigate,
  realtimeStatus = 'connected',
  units = [],
  payments = []
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsDropdownOpen(true);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const cleanQ = q.replace(/[\s\-_]/g, '');

  const matchingUnits = useMemo(() => {
    if (!units.length || !q) return [];
    return units.filter(u => {
      const uNum = (u.unitNumber || '').toLowerCase();
      const cleanNum = uNum.replace(/[\s\-_]/g, '');
      const badge = (u.codeBadge || '').toLowerCase();
      const tenant = (u.currentTenant?.name || '').toLowerCase();
      const trade = (u.currentTenant?.trade || '').toLowerCase();
      const meter = (u.meterNumber || '').toLowerCase();
      const type = (u.type || '').toLowerCase();
      const floor = (u.floor || '').toLowerCase();

      return (
        uNum.includes(q) ||
        cleanNum.includes(cleanQ) ||
        badge.includes(q) ||
        tenant.includes(q) ||
        trade.includes(q) ||
        meter.includes(q) ||
        type.includes(q) ||
        floor.includes(q)
      );
    }).slice(0, 5);
  }, [units, q, cleanQ]);

  const matchingTenants = useMemo(() => {
    if (!units.length || !q) return [];
    const tenantUnits = units.filter(u => u.currentTenant && u.currentTenant.name.trim().length > 0);
    return tenantUnits.filter(u => {
      const t = u.currentTenant!;
      const name = (t.name || '').toLowerCase();
      const trade = (t.trade || '').toLowerCase();
      const phone = (t.phone || '').toLowerCase();
      const code = (t.code || '').toLowerCase();
      const uNum = (u.unitNumber || '').toLowerCase();
      return name.includes(q) || trade.includes(q) || phone.includes(q) || code.includes(q) || uNum.includes(q);
    }).slice(0, 3);
  }, [units, q]);

  const matchingPayments = useMemo(() => {
    if (!payments.length || !q) return [];
    return payments.filter(p => {
      const rec = (p.receiptNumber || '').toLowerCase();
      const tenant = (p.tenantName || '').toLowerCase();
      const uNum = (p.unitNumber || '').toLowerCase();
      return rec.includes(q) || tenant.includes(q) || uNum.includes(q);
    }).slice(0, 3);
  }, [payments, q]);

  const hasAnyResults = matchingUnits.length > 0 || matchingTenants.length > 0 || matchingPayments.length > 0;

  const handleSelectUnit = (unit: PropertyUnit) => {
    onSearchChange(unit.unitNumber);
    onNavigate?.('units');
    setIsDropdownOpen(false);
  };

  const handleSelectTenant = (unit: PropertyUnit) => {
    if (unit.currentTenant?.name) {
      onSearchChange(unit.currentTenant.name);
    }
    onNavigate?.('tenants');
    setIsDropdownOpen(false);
  };

  const handleSelectReceipt = () => {
    onNavigate?.('receipts');
    setIsDropdownOpen(false);
  };

  const handleViewAllInUnits = () => {
    onNavigate?.('units');
    setIsDropdownOpen(false);
  };

  return (
    <header 
      id="nbc-appbar" 
      className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-5 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 transition-all"
    >
      {/* Search Bar with Live Instant Results Palette */}
      <div ref={containerRef} className="relative flex items-center flex-1 max-w-lg">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsDropdownOpen(true)}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setIsDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleViewAllInUnits();
              } else if (e.key === 'Escape') {
                setIsDropdownOpen(false);
              }
            }}
            placeholder="Quick search units, tenants, receipts..."
            className="w-full pl-10 pr-10 py-2 bg-slate-100/70 hover:bg-slate-100 border border-slate-200/70 hover:border-slate-300 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all"
          />
          {searchQuery ? (
            <button 
              type="button"
              onClick={() => {
                onSearchChange('');
                setIsDropdownOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                searchInputRef.current?.focus();
                setIsDropdownOpen(true);
              }}
              className="hidden lg:inline-block absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs cursor-pointer hover:bg-slate-50"
            >
              ⌘K
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown Palette */}
        {isDropdownOpen && q.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden divide-y divide-slate-100 text-xs animate-in fade-in zoom-in-95 max-h-[75vh] overflow-y-auto">
            
            {/* Header info bar */}
            <div className="p-3 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Quick Results for &ldquo;{searchQuery}&rdquo;</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                Press <CornerDownLeft className="w-3 h-3" /> to view in Units
              </span>
            </div>

            {/* Section: Properties & Units */}
            {matchingUnits.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Properties & Units</span>
                  <span>{matchingUnits.length} matches</span>
                </div>
                {matchingUnits.map((u) => {
                  const isOccupied = u.occupancyStatus === 'Occupied';
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUnit(u)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 border border-blue-200">
                          {u.codeBadge || u.unitNumber}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{u.unitNumber}</span>
                            <span className="text-[10px] text-slate-400">• {u.floor} • {u.type}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {u.currentTenant ? `Tenant: ${u.currentTenant.name} (${u.currentTenant.trade})` : 'Vacant ready for lease'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOccupied ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {u.occupancyStatus}
                        </span>
                        <span className="block text-[10px] font-semibold text-slate-700 mt-0.5">${u.monthlyRateUSD}/mo</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Section: Tenants */}
            {matchingTenants.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Tenants</span>
                  <span>{matchingTenants.length} matches</span>
                </div>
                {matchingTenants.map((u) => {
                  const t = u.currentTenant!;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTenant(u)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.name}</span>
                          <p className="text-[11px] text-slate-500 truncate">
                            {t.trade} • Unit: <strong className="text-slate-700">{u.unitNumber}</strong> • {t.phone}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {t.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Section: Receipts */}
            {matchingPayments.length > 0 && (
              <div className="p-2 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Receipts & Ledger</span>
                  <span>{matchingPayments.length} matches</span>
                </div>
                {matchingPayments.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={handleSelectReceipt}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 border border-emerald-200">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-slate-900">{p.receiptNumber}</span>
                        <p className="text-[11px] text-slate-500 truncate">
                          {p.tenantName} • Unit {p.unitNumber} • {p.date}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700">
                      ${p.amount.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* No matches state */}
            {!hasAnyResults && (
              <div className="p-6 text-center text-slate-400">
                <Store className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                <p className="font-semibold text-slate-700 text-xs">No matching results found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No properties, tenants, or receipts match &ldquo;{searchQuery}&rdquo;.
                </p>
              </div>
            )}

            {/* Footer action */}
            <div className="p-2 bg-slate-50/60">
              <button
                type="button"
                onClick={handleViewAllInUnits}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>View all matching properties in Units Directory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        )}
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
