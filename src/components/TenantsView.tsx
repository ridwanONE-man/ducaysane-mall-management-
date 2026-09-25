import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  Store, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  X, 
  Printer, 
  FileText, 
  ChevronRight,
  Receipt
} from 'lucide-react';
import { initialTenants } from '../data/commercialData';
import { TenantInfo, PropertyUnit, PaymentRecord, DepositRecord } from '../types';

interface TenantsViewProps {
  units?: PropertyUnit[];
  payments?: PaymentRecord[];
  deposits?: DepositRecord[];
  onRecordPaymentForTenant: (unitNumber: string) => void;
  onSelectReceiptForPrint?: (payment: PaymentRecord) => void;
}

export const TenantsView: React.FC<TenantsViewProps> = ({ 
  units = [], 
  payments = [], 
  deposits = [],
  onRecordPaymentForTenant,
  onSelectReceiptForPrint 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'All' | 'Shops' | 'Spaces' | 'Overdue' | 'Expiring Soon'>('All');
  const [selectedTenant, setSelectedTenant] = useState<{ tenant: TenantInfo; unit?: PropertyUnit } | null>(null);

  // Derive tenant list combined with live unit states
  const derivedTenants: { tenant: TenantInfo; unit: PropertyUnit }[] = units
    .filter(u => u.currentTenant && u.currentTenant.name.trim().length > 0)
    .map(u => ({
      unit: u,
      tenant: {
        ...u.currentTenant!,
        unitNumber: u.unitNumber,
        balanceUSD: u.arrearsUSD || 0,
        balanceSSP: u.arrearsSSP || 0,
        balanceStatus: ((u.arrearsUSD || 0) > 0 || (u.arrearsSSP || 0) > 0) ? ('Overdue' as const) : ('Current' as const),
        leaseStart: u.leaseStart || u.currentTenant?.leaseStart || '2026-09-01',
        leaseEnd: u.leaseEnd || u.currentTenant?.leaseEnd || '2026-10-01',
        daysRemaining: typeof u.daysRemaining === 'number' 
          ? u.daysRemaining 
          : typeof u.currentTenant?.daysRemaining === 'number' 
          ? u.currentTenant.daysRemaining 
          : 7
      }
    }));

  // Fallback to initialTenants if units not yet hydrated
  const listItems: { tenant: TenantInfo; unit?: PropertyUnit }[] = derivedTenants.length > 0
    ? derivedTenants
    : initialTenants.map(t => ({
        tenant: t,
        unit: units.find(u => u.unitNumber === t.unitNumber)
      }));

  // Summary counts
  const totalCount = listItems.length;
  const shopsCount = listItems.filter(item => 
    (item.unit?.type === 'Shop' || item.unit?.categoryType === 'Shop' || (item.tenant.unitNumber && item.tenant.unitNumber.startsWith('G')))
  ).length;
  const spacesCount = listItems.filter(item => 
    (item.unit?.type === 'Space' || item.unit?.categoryType === 'Space' || (item.tenant.unitNumber && item.tenant.unitNumber.startsWith('BW')))
  ).length;
  const overdueCount = listItems.filter(item => 
    item.tenant.balanceUSD > 0 || item.tenant.balanceSSP > 0 || item.tenant.balanceStatus === 'Overdue'
  ).length;
  const expiringSoonCount = listItems.filter(item => 
    typeof item.tenant.daysRemaining === 'number' && item.tenant.daysRemaining <= 7
  ).length;

  // Filter application
  const filtered = listItems.filter(({ tenant, unit }) => {
    const isShop = unit?.type === 'Shop' || unit?.categoryType === 'Shop' || (tenant.unitNumber && tenant.unitNumber.startsWith('G'));
    const isSpace = unit?.type === 'Space' || unit?.categoryType === 'Space' || (tenant.unitNumber && tenant.unitNumber.startsWith('BW'));
    const isOverdue = tenant.balanceUSD > 0 || tenant.balanceSSP > 0 || tenant.balanceStatus === 'Overdue';
    const isExpiring = typeof tenant.daysRemaining === 'number' && tenant.daysRemaining <= 7;

    // Category Tab
    if (activeCategoryTab === 'Shops' && !isShop) return false;
    if (activeCategoryTab === 'Spaces' && !isSpace) return false;
    if (activeCategoryTab === 'Overdue' && !isOverdue) return false;
    if (activeCategoryTab === 'Expiring Soon' && !isExpiring) return false;

    // Search query
    const q = searchTerm.toLowerCase();
    const matchName = tenant.name.toLowerCase().includes(q);
    const matchTrade = tenant.trade.toLowerCase().includes(q);
    const matchUnit = tenant.unitNumber ? tenant.unitNumber.toLowerCase().includes(q) : false;
    const matchPhone = tenant.phone ? tenant.phone.toLowerCase().includes(q) : false;

    return matchName || matchTrade || matchUnit || matchPhone;
  });

  // Payments for selected tenant
  const selectedTenantPayments = selectedTenant
    ? payments.filter(p => 
        p.unitNumber === selectedTenant.tenant.unitNumber || 
        p.tenantName.toLowerCase().includes(selectedTenant.tenant.name.toLowerCase())
      )
    : [];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <span>Nyakuron Business Centre</span>
            <span>›</span>
            <span className="text-orange-600">Tenants</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Commercial Tenant Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Active shop and space leases, contact profiles, lease terms, and financial standing.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tenant, trade, unit #..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Category Tabs Strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        {(['All', 'Shops', 'Spaces', 'Overdue', 'Expiring Soon'] as const).map(tab => {
          const count = 
            tab === 'All' ? totalCount :
            tab === 'Shops' ? shopsCount :
            tab === 'Spaces' ? spacesCount :
            tab === 'Overdue' ? overdueCount : expiringSoonCount;

          return (
            <button
              key={tab}
              onClick={() => setActiveCategoryTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategoryTab === tab
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs shadow-orange-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{tab}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                activeCategoryTab === tab 
                  ? 'bg-white/20 text-white' 
                  : tab === 'Overdue' && overdueCount > 0 
                  ? 'bg-rose-100 text-rose-700' 
                  : tab === 'Expiring Soon' && expiringSoonCount > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tenants Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-slate-400 stroke-[1.5]" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Tenants Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try changing your search query or tab filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(({ tenant, unit }) => {
            const isShop = unit?.type === 'Shop' || unit?.categoryType === 'Shop' || (tenant.unitNumber && tenant.unitNumber.startsWith('G'));
            const isOverdue = tenant.balanceUSD > 0 || tenant.balanceSSP > 0 || tenant.balanceStatus === 'Overdue';
            const daysRem = tenant.daysRemaining ?? 7;

            return (
              <div 
                key={tenant.id} 
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Avatar, Name, Unit Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center shadow-sm shrink-0 ${
                        isShop 
                          ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-orange-500/20' 
                          : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
                      }`}>
                        {tenant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                          {tenant.name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{tenant.trade}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 ${
                      isShop 
                        ? 'bg-orange-50 text-orange-700 border border-orange-200/80' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200/80'
                    }`}>
                      {tenant.unitNumber}
                    </span>
                  </div>

                  {/* Lease Expiry & Standing Row */}
                  <div className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Lease Status</span>
                      <span className={`font-bold inline-block px-1.5 py-0.2 rounded-md text-[11px] ${
                        daysRem > 7 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : daysRem > 0 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {daysRem > 0 ? `${daysRem}d remaining` : `Expired (${Math.abs(daysRem)}d)`}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Balance Standing</span>
                      <span className={`font-bold text-xs ${isOverdue ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isOverdue 
                          ? (tenant.balanceUSD > 0 ? `$${tenant.balanceUSD} Overdue` : `${tenant.balanceSSP?.toLocaleString()} SSP Overdue`)
                          : 'Good Standing'}
                      </span>
                    </div>
                  </div>

                  {/* Details List */}
                  <div className="space-y-2 py-2 border-y border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-orange-500" />
                        Space / Category:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {isShop ? 'Retail Shop' : 'Open Commercial Space'} ({unit?.floor || 'Ground Floor'})
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Phone Contact:
                      </span>
                      <span className="font-semibold text-slate-800">{tenant.phone}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        Monthly Base Rent:
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {unit?.monthlyRateUSD 
                          ? `$${unit.monthlyRateUSD.toLocaleString()} USD` 
                          : `${(unit?.monthlyRateSSP || 0).toLocaleString()} SSP`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedTenant({ tenant, unit })}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Profile</span>
                  </button>

                  <button
                    onClick={() => onRecordPaymentForTenant(tenant.unitNumber || 'G001')}
                    className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-orange-500/20"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Rent</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tenant Detail Profile Drawer / Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white font-extrabold text-base flex items-center justify-center shadow-md shadow-orange-500/20">
                  {selectedTenant.tenant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedTenant.tenant.name}</h2>
                  <p className="text-xs text-slate-500">{selectedTenant.tenant.trade} • {selectedTenant.tenant.code || 'Registered Tenant'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTenant(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-6 space-y-5 text-xs text-slate-700">
              
              {/* Leased Space & Lease Timing Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-orange-50/40 p-4 rounded-2xl border border-orange-200/60">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Assigned Unit</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedTenant.tenant.unitNumber}</span>
                  <span className="text-[10px] text-slate-500 block">{selectedTenant.unit?.floor || 'Ground Floor'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Lease Start</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedTenant.tenant.leaseStart || '01/09/2026'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Lease End</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedTenant.tenant.leaseEnd || '01/10/2026'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Expiry Alert</span>
                  <span className={`font-bold inline-block px-2 py-0.5 rounded-full text-[11px] ${
                    (selectedTenant.tenant.daysRemaining ?? 7) > 7 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : (selectedTenant.tenant.daysRemaining ?? 7) > 0 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {(selectedTenant.tenant.daysRemaining ?? 7) > 0 
                      ? `${selectedTenant.tenant.daysRemaining} days remaining` 
                      : `Expired`}
                  </span>
                </div>
              </div>

              {/* Financial Ledger Overview */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">Financial Statement</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    selectedTenant.tenant.balanceStatus === 'Current' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {selectedTenant.tenant.balanceStatus === 'Current' ? 'All Dues Paid' : 'Arrears Balance Due'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Monthly Base Rent</span>
                    <span className="font-black text-slate-900 text-sm">
                      {selectedTenant.unit?.monthlyRateUSD 
                        ? `$${selectedTenant.unit.monthlyRateUSD.toLocaleString()}` 
                        : `${(selectedTenant.unit?.monthlyRateSSP || 0).toLocaleString()} SSP`}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Security Deposit</span>
                    <span className="font-black text-slate-900 text-sm">
                      {selectedTenant.unit?.escrowDepositUSD 
                        ? `$${selectedTenant.unit.escrowDepositUSD.toLocaleString()}` 
                        : `${(selectedTenant.unit?.escrowDepositSSP || 0).toLocaleString()} SSP`}
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl ${selectedTenant.tenant.balanceUSD > 0 || selectedTenant.tenant.balanceSSP > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Outstanding Arrears</span>
                    <span className={`font-black text-sm ${selectedTenant.tenant.balanceUSD > 0 || selectedTenant.tenant.balanceSSP > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {selectedTenant.tenant.balanceUSD > 0 
                        ? `$${selectedTenant.tenant.balanceUSD.toLocaleString()}` 
                        : selectedTenant.tenant.balanceSSP > 0 
                        ? `${selectedTenant.tenant.balanceSSP.toLocaleString()} SSP`
                        : '$0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment History & Receipts */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-orange-600" />
                    <span>Recent Rent Payments & Vouchers</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{selectedTenantPayments.length} records</span>
                </div>

                {selectedTenantPayments.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <p>No recent payment transactions recorded for this tenant.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {selectedTenantPayments.map(p => (
                      <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-rose-600">{p.receiptNumber}</span>
                            <span className="text-slate-400">•</span>
                            <span className="font-medium text-slate-800">{p.accountingPeriod}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {p.date} • {p.paymentMethod}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-bold text-emerald-600 text-xs">
                            {p.currency === 'USD' ? `$${p.amount.toFixed(2)}` : `${p.amount.toLocaleString()} SSP`}
                          </span>

                          {onSelectReceiptForPrint && (
                            <button
                              onClick={() => {
                                onSelectReceiptForPrint(p);
                                setSelectedTenant(null);
                              }}
                              className="p-1 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                              title="Print Receipt Voucher"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons in Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTenant(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const unitNum = selectedTenant.tenant.unitNumber || 'G001';
                    setSelectedTenant(null);
                    onRecordPaymentForTenant(unitNum);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Record Rent Payment</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
