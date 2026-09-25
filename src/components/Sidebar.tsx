import React from 'react';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  CreditCard, 
  Lock, 
  Landmark, 
  Printer, 
  BarChart3, 
  TrendingUp, 
  Bell, 
  Settings, 
  Building2, 
  ChevronDown,
  Mail,
  LogOut
} from 'lucide-react';
import { NavigationTab, AdminUser } from '../types';
import logoImg from '../assets/logo.png';

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  unreadAlertsCount: number;
  adminUser: AdminUser;
  onLogout: () => void;
  activeBuilding: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  unreadAlertsCount,
  adminUser,
  onLogout,
  activeBuilding
}) => {
  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'units', label: 'Units / Properties', icon: Store },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'deposits', label: 'Deposits', icon: Lock },
    { id: 'cashflow', label: 'Cash Flow', icon: Landmark, badge: 'USD/SSP', badgeColor: 'bg-orange-50 text-orange-700' },
    { id: 'receipts', label: 'Receipts', icon: Printer },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined, badgeColor: 'bg-red-600 text-white' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside id="nbc-sidebar" className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-screen shrink-0 sticky top-0 z-30 select-none">
      
      {/* Top Header & Property Selector */}
      <div className="p-4 border-b border-slate-100">
        {/* Nyakuron Business Centre Brand Logo */}
        <div className="flex items-center gap-3 px-1 py-1 mb-4">
          <div className="relative w-10 h-10 rounded-full bg-white ring-2 ring-orange-500/40 p-0.5 shadow-md shadow-orange-500/10 flex items-center justify-center overflow-hidden shrink-0">
            <img 
              src={logoImg} 
              alt="Nyakuron Business Centre" 
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-slate-900 text-sm leading-tight tracking-tight truncate">
              Nyakuron
            </div>
            <div className="text-[10px] font-bold text-orange-600 tracking-wider uppercase">
              Business Centre
            </div>
          </div>
        </div>

        {/* Property Selector */}
        <button 
          type="button"
          onClick={() => onTabChange('units')}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 transition-colors cursor-pointer group"
          title="Switch Mall Property"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span className="truncate">{activeBuilding || 'Nyakuron Business Centre'}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 ml-1" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold shadow-sm shadow-orange-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom User Profile Section */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ring-1 ring-orange-400/50 overflow-hidden">
            {adminUser.avatar && adminUser.avatar !== 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' ? (
              <img src={adminUser.avatar} alt={adminUser.name} className="w-full h-full object-cover" />
            ) : (
              adminUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)
            )}
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">{adminUser.name}</p>
            <p className="text-[10px] text-slate-500 truncate">Office Management In-Charge</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-200/60 mt-1 text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            className="hover:text-orange-600 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Mail className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="hover:text-red-600 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

    </aside>
  );
};
