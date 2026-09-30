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
  Receipt,
  Edit2,
  UserX,
  UserPlus,
  DollarSign,
  Plus
} from 'lucide-react';
import { initialTenants } from '../data/commercialData';
import { TenantInfo, PropertyUnit, PaymentRecord, DepositRecord } from '../types';

interface TenantsViewProps {
  units?: PropertyUnit[];
  payments?: PaymentRecord[];
  deposits?: DepositRecord[];
  onRecordPaymentForTenant: (unitNumber: string) => void;
  onSelectReceiptForPrint?: (payment: PaymentRecord) => void;
  onSaveUnit?: (unit: PropertyUnit) => void;
  onSaveDeposit?: (deposit: DepositRecord) => void;
  onOpenAssignUnit?: (unit: PropertyUnit) => void;
}

export const TenantsView: React.FC<TenantsViewProps> = ({ 
  units = [], 
  payments = [], 
  deposits = [],
  onRecordPaymentForTenant,
  onSelectReceiptForPrint,
  onSaveUnit,
  onSaveDeposit,
  onOpenAssignUnit
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'All' | 'Shops' | 'Spaces' | 'Overdue' | 'Expiring Soon' | 'Available Units'>('All');
  const [selectedTenant, setSelectedTenant] = useState<{ tenant: TenantInfo; unit?: PropertyUnit } | null>(null);

  // Edit / Replace Tenant Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<PropertyUnit | null>(null);
  const [editTenantName, setEditTenantName] = useState('');
  const [editTrade, setEditTrade] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMonthlyRentUSD, setEditMonthlyRentUSD] = useState<number>(500);
  const [editLeaseStart, setEditLeaseStart] = useState('');
  const [editLeaseEnd, setEditLeaseEnd] = useState('');

  // Vacate / Clear Tenant Confirmation Modal
  const [isVacateModalOpen, setIsVacateModalOpen] = useState(false);
  const [unitToVacate, setUnitToVacate] = useState<PropertyUnit | null>(null);

  // Add / Modify Deposit Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositUnit, setDepositUnit] = useState<PropertyUnit | null>(null);
  const [depositMonths, setDepositMonths] = useState<number>(2);
  const [customDepositAmount, setCustomDepositAmount] = useState<string>('');
  const [isCustomDeposit, setIsCustomDeposit] = useState(false);
  const [depositBankAccount, setDepositBankAccount] = useState('Stanbic Bank - Escrow Liability #8892-01');

  // Derive tenant list combined with live unit states
  const derivedTenants: { tenant: TenantInfo; unit: PropertyUnit }[] = units
    .filter(u => u.occupancyStatus === 'Occupied' && u.currentTenant && u.currentTenant.name.trim().length > 0)
    .map(u => {
      // Find latest deposit for this tenant/unit
      const matchingDeposit = deposits.find(d => d.unitNumber === u.unitNumber && d.status === 'Held in Escrow');
      const depositAmount = matchingDeposit?.amountUSD || u.escrowDepositUSD || 0;
      const depositMos = matchingDeposit?.depositMonths || u.depositMonths || (depositAmount > 0 && u.monthlyRateUSD > 0 ? Math.max(1, Math.round(depositAmount / u.monthlyRateUSD)) : 0);

      return {
        unit: u,
        tenant: {
          ...u.currentTenant!,
          unitNumber: u.unitNumber,
          balanceUSD: u.arrearsUSD || 0,
          depositUSD: depositAmount,
          depositMonths: depositMos,
          balanceStatus: (u.arrearsUSD || 0) > 0 ? ('Overdue' as const) : ('Current' as const),
          leaseStart: u.leaseStart || u.currentTenant?.leaseStart || '2026-09-01',
          leaseEnd: u.leaseEnd || u.currentTenant?.leaseEnd || '2026-10-01',
          daysRemaining: typeof u.daysRemaining === 'number' 
            ? u.daysRemaining 
            : typeof u.currentTenant?.daysRemaining === 'number' 
            ? u.currentTenant.daysRemaining 
            : 30
        }
      };
    });

  // Available vacant units
  const availableUnits = units.filter(u => u.occupancyStatus === 'Available' || !u.currentTenant);

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
    item.tenant.balanceUSD > 0 || item.tenant.balanceStatus === 'Overdue'
  ).length;
  const expiringSoonCount = listItems.filter(item => 
    typeof item.tenant.daysRemaining === 'number' && item.tenant.daysRemaining <= 15
  ).length;
  const availableCount = availableUnits.length;

  // Filter application
  const filtered = listItems.filter(({ tenant, unit }) => {
    const isShop = unit?.type === 'Shop' || unit?.categoryType === 'Shop' || (tenant.unitNumber && tenant.unitNumber.startsWith('G'));
    const isSpace = unit?.type === 'Space' || unit?.categoryType === 'Space' || (tenant.unitNumber && tenant.unitNumber.startsWith('BW'));
    const isOverdue = tenant.balanceUSD > 0 || tenant.balanceStatus === 'Overdue';
    const isExpiring = typeof tenant.daysRemaining === 'number' && tenant.daysRemaining <= 15;

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

  // Open Edit / Replace Modal
  const handleOpenEdit = (unit: PropertyUnit, tenant: TenantInfo) => {
    setEditUnit(unit);
    setEditTenantName(tenant.name);
    setEditTrade(tenant.trade);
    setEditPhone(tenant.phone);
    setEditEmail(tenant.email);
    setEditMonthlyRentUSD(unit.monthlyRateUSD || 500);
    setEditLeaseStart(tenant.leaseStart || '2026-09-01');
    setEditLeaseEnd(tenant.leaseEnd || '2026-10-01');
    setIsEditModalOpen(true);
    setSelectedTenant(null);
  };

  // Submit Edit / Replace Tenant
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUnit || !editTenantName.trim()) return;

    const updatedTenant: TenantInfo = {
      id: editUnit.currentTenant?.id || `t-${Date.now()}`,
      name: editTenantName.trim(),
      trade: editTrade.trim() || 'Retail Business',
      code: editUnit.currentTenant?.code || `TNT-${editUnit.unitNumber}`,
      phone: editPhone.trim() || '+211 928 000 000',
      email: editEmail.trim() || `${editUnit.unitNumber.toLowerCase()}@nyakuron.com`,
      unitNumber: editUnit.unitNumber,
      balanceUSD: editUnit.arrearsUSD || 0,
      balanceSSP: 0,
      depositUSD: editUnit.escrowDepositUSD || (editMonthlyRentUSD * 2),
      depositMonths: editUnit.depositMonths || 2,
      balanceStatus: (editUnit.arrearsUSD || 0) > 0 ? 'Overdue' : 'Current',
      leaseStart: editLeaseStart,
      leaseEnd: editLeaseEnd,
      daysRemaining: editUnit.daysRemaining || 30,
      status: 'Active'
    };

    const updatedUnit: PropertyUnit = {
      ...editUnit,
      monthlyRateUSD: editMonthlyRentUSD,
      currentTenant: updatedTenant,
      leaseStart: editLeaseStart,
      leaseEnd: editLeaseEnd,
      occupancyStatus: 'Occupied'
    };

    if (onSaveUnit) {
      onSaveUnit(updatedUnit);
    }
    setIsEditModalOpen(false);
    setEditUnit(null);
  };

  // Open Vacate / Clear Tenant Confirmation
  const handleOpenVacate = (unit: PropertyUnit) => {
    setUnitToVacate(unit);
    setIsVacateModalOpen(true);
    setSelectedTenant(null);
  };

  // Confirm Vacate / Clear Tenant
  const handleConfirmVacate = () => {
    if (!unitToVacate) return;

    const clearedUnit: PropertyUnit = {
      ...unitToVacate,
      occupancyStatus: 'Available',
      currentTenant: undefined,
      billingStatus: 'No Balance',
      billingMonthText: undefined,
      arrearsUSD: 0,
      arrearsSSP: 0,
      leaseStart: undefined,
      leaseEnd: undefined,
      daysRemaining: undefined,
      daysToExpiry: undefined,
      notes: `Vacated on ${new Date().toLocaleDateString('en-US')}. Ready for immediate lease.`
    };

    if (onSaveUnit) {
      onSaveUnit(clearedUnit);
    }
    setIsVacateModalOpen(false);
    setUnitToVacate(null);
  };

  // Open Deposit Modal
  const handleOpenDepositModal = (unit: PropertyUnit) => {
    setDepositUnit(unit);
    setDepositMonths(2);
    setIsCustomDeposit(false);
    setCustomDepositAmount(String((unit.monthlyRateUSD || 500) * 2));
    setIsDepositModalOpen(true);
    setSelectedTenant(null);
  };

  // Save Deposit
  const handleSaveDepositRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositUnit) return;

    const rate = depositUnit.monthlyRateUSD || 500;
    const finalAmt = isCustomDeposit 
      ? (parseFloat(customDepositAmount) || 0) 
      : rate * depositMonths;
    const effectiveMonths = isCustomDeposit 
      ? Math.max(1, Math.round(finalAmt / (rate || 1))) 
      : depositMonths;

    const newDep: DepositRecord = {
      id: `dep-${Date.now()}`,
      depositSlip: `DEP-2026-${Math.floor(100 + Math.random() * 900)}`,
      tenantName: depositUnit.currentTenant?.name || 'Commercial Tenant',
      tenantId: depositUnit.currentTenant?.id,
      unitNumber: depositUnit.unitNumber,
      amountUSD: finalAmt,
      amountSSP: 0,
      depositMonths: effectiveMonths,
      monthlyRentUSD: rate,
      heldSince: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      status: 'Held in Escrow',
      bankAccount: depositBankAccount,
      notes: `Security deposit of ${effectiveMonths} month(s) rent held in segregated escrow.`
    };

    // Update unit with new deposit amount
    const updatedUnit: PropertyUnit = {
      ...depositUnit,
      escrowDepositUSD: finalAmt,
      depositMonths: effectiveMonths
    };

    if (onSaveUnit) onSaveUnit(updatedUnit);
    if (onSaveDeposit) onSaveDeposit(newDep);

    setIsDepositModalOpen(false);
    setDepositUnit(null);
  };

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
            <span className="text-blue-600">Tenants</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Commercial Tenant Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Active shop and space leases, contact profiles, lease terms, and security deposit standings.
          </p>
        </div>

        {/* Actions & Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tenant, trade, unit #..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
            />
          </div>

          {availableUnits.length > 0 && onOpenAssignUnit && (
            <button
              onClick={() => onOpenAssignUnit(availableUnits[0])}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Lease Available Unit</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs Strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        {(['All', 'Shops', 'Spaces', 'Overdue', 'Expiring Soon', 'Available Units'] as const).map(tab => {
          const count = 
            tab === 'All' ? totalCount :
            tab === 'Shops' ? shopsCount :
            tab === 'Spaces' ? spacesCount :
            tab === 'Overdue' ? overdueCount :
            tab === 'Expiring Soon' ? expiringSoonCount : availableCount;

          return (
            <button
              key={tab}
              onClick={() => setActiveCategoryTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategoryTab === tab
                  ? 'bg-slate-900 text-white shadow-xs'
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
                  : tab === 'Available Units'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* View: Available Vacant Units Tab */}
      {activeCategoryTab === 'Available Units' ? (
        <div className="space-y-4">
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                  {availableUnits.length} Vacant Units Ready for Immediate Lease
                </h3>
                <p className="text-[11px] text-slate-600">
                  Click on any available shop or space to fill in a new tenant and onboard them instantly.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableUnits.map(unit => (
              <div 
                key={unit.id}
                onClick={() => onOpenAssignUnit && onOpenAssignUnit(unit)}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center">
                        {unit.unitNumber}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition-colors">
                          {unit.categoryType || unit.type}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">{unit.floor}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      Available
                    </span>
                  </div>

                  <div className="py-2 space-y-1.5 border-y border-slate-100 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Area Size:</span>
                      <strong className="text-slate-800">{unit.sizeSqM} m² ({unit.sizeSqFt} sq.ft)</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Standard Rent:</span>
                      <strong className="text-slate-900 font-bold">${unit.monthlyRateUSD.toLocaleString()} USD/mo</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-600 group-hover:underline flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign / Lease to Tenant</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-slate-400 stroke-[1.5]" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Tenants Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try changing your search query or tab filter.</p>
        </div>
      ) : (
        /* Tenants Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(({ tenant, unit }) => {
            const isShop = unit?.type === 'Shop' || unit?.categoryType === 'Shop' || (tenant.unitNumber && tenant.unitNumber.startsWith('G'));
            const isOverdue = tenant.balanceUSD > 0 || tenant.balanceStatus === 'Overdue';
            const daysRem = tenant.daysRemaining ?? 30;
            const depositAmt = tenant.depositUSD || unit?.escrowDepositUSD || 0;
            const depositMos = tenant.depositMonths || (depositAmt > 0 && unit?.monthlyRateUSD ? Math.max(1, Math.round(depositAmt / unit.monthlyRateUSD)) : 0);

            return (
              <div 
                key={tenant.id} 
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Avatar, Name, Unit Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center shadow-xs shrink-0 ${
                        isShop 
                          ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-blue-500/20' 
                          : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-500/20'
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
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/80' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    }`}>
                      {tenant.unitNumber}
                    </span>
                  </div>

                  {/* Lease Expiry & Standing Row */}
                  <div className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Lease Status</span>
                      <span className={`font-bold inline-block px-1.5 py-0.2 rounded-md text-[11px] ${
                        daysRem > 15 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : daysRem > 0 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {daysRem > 0 ? `${daysRem}d remaining` : `Expired (${Math.abs(daysRem)}d)`}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Deposit Standing</span>
                      <span className={`font-bold text-xs ${depositAmt > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {depositAmt > 0 ? `$${depositAmt.toLocaleString()} (${depositMos} mo)` : 'No Deposit'}
                      </span>
                    </div>
                  </div>

                  {/* Details List */}
                  <div className="space-y-2 py-2 border-y border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-500" />
                        Space / Category:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {isShop ? 'Retail Shop' : 'Commercial Space'} ({unit?.floor || 'Ground Floor'})
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
                        ${(unit?.monthlyRateUSD || 0).toLocaleString()} USD
                      </span>
                    </div>

                    {isOverdue && (
                      <div className="flex items-center justify-between text-rose-600 font-bold">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Outstanding Arrears:
                        </span>
                        <span>${tenant.balanceUSD.toLocaleString()} USD</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTenant({ tenant, unit })}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Profile</span>
                    </button>

                    <button
                      onClick={() => onRecordPaymentForTenant(tenant.unitNumber || 'G001')}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-blue-500/20"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay Rent</span>
                    </button>
                  </div>

                  {/* Secondary Fast Actions: Edit Tenant & Vacate / Clear */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                    {unit && (
                      <button
                        onClick={() => handleOpenEdit(unit, tenant)}
                        className="text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Modify Details / Price</span>
                      </button>
                    )}

                    {unit && (
                      <button
                        onClick={() => handleOpenVacate(unit)}
                        className="text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Vacate Unit</span>
                      </button>
                    )}
                  </div>
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-base flex items-center justify-center shadow-md shadow-blue-500/20">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50/40 p-4 rounded-2xl border border-blue-200/60">
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
                    (selectedTenant.tenant.daysRemaining ?? 30) > 15 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : (selectedTenant.tenant.daysRemaining ?? 30) > 0 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {(selectedTenant.tenant.daysRemaining ?? 30) > 0 
                      ? `${selectedTenant.tenant.daysRemaining} days remaining` 
                      : `Expired`}
                  </span>
                </div>
              </div>

              {/* Financial Ledger Overview */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">Financial Statement (USD)</span>
                  <div className="flex items-center gap-2">
                    {selectedTenant.unit && (
                      <button
                        onClick={() => handleOpenDepositModal(selectedTenant.unit!)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        + Add / Modify Deposit
                      </button>
                    )}
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                      selectedTenant.tenant.balanceStatus === 'Current' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {selectedTenant.tenant.balanceStatus === 'Current' ? 'All Dues Paid' : 'Arrears Balance Due'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Monthly Base Rent</span>
                    <span className="font-black text-slate-900 text-sm">
                      ${(selectedTenant.unit?.monthlyRateUSD || 0).toLocaleString()} USD
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Security Deposit Held</span>
                    <span className="font-black text-slate-900 text-sm">
                      ${(selectedTenant.tenant.depositUSD || selectedTenant.unit?.escrowDepositUSD || 0).toLocaleString()} USD
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      {selectedTenant.tenant.depositMonths ? `${selectedTenant.tenant.depositMonths} Month(s) Escrow` : 'Escrow Deposit'}
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl ${selectedTenant.tenant.balanceUSD > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Outstanding Arrears</span>
                    <span className={`font-black text-sm ${selectedTenant.tenant.balanceUSD > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      ${(selectedTenant.tenant.balanceUSD || 0).toLocaleString()} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment History & Receipts */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-600" />
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
                            <span className="font-mono font-bold text-blue-600">{p.receiptNumber}</span>
                            <span className="text-slate-400">•</span>
                            <span className="font-medium text-slate-800">{p.accountingPeriod}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {p.date} • {p.paymentMethod}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-bold text-emerald-600 text-xs">
                            ${p.amount.toFixed(2)} USD
                          </span>

                          {onSelectReceiptForPrint && (
                            <button
                              onClick={() => {
                                onSelectReceiptForPrint(p);
                                setSelectedTenant(null);
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
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
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {selectedTenant.unit && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(selectedTenant.unit!, selectedTenant.tenant)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Modify / Replace</span>
                    </button>
                  )}

                  {selectedTenant.unit && (
                    <button
                      type="button"
                      onClick={() => handleOpenVacate(selectedTenant.unit!)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Vacate Tenant</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
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
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Record Rent Payment</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Edit / Replace Tenant Modal */}
      {isEditModalOpen && editUnit && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Modify Tenant or Replace Space
                </h3>
                <p className="text-xs text-slate-500">
                  Update tenant details, modify rent price, or assign a replacement tenant for Unit {editUnit.unitNumber}.
                </p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tenant Full Name (or New Person's Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTenantName}
                  onChange={(e) => setEditTenantName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business / Trade</label>
                  <input
                    type="text"
                    value={editTrade}
                    onChange={(e) => setEditTrade(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Modify Rent Price */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl">
                <label className="block font-bold text-slate-900 mb-1">
                  Modify Monthly Rent Price (USD $) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-blue-600">$</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editMonthlyRentUSD}
                    onChange={(e) => setEditMonthlyRentUSD(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Adjusting the monthly rent will immediately update future invoices and billing for this space.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lease Start</label>
                  <input
                    type="date"
                    value={editLeaseStart}
                    onChange={(e) => setEditLeaseStart(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lease End</label>
                  <input
                    type="date"
                    value={editLeaseEnd}
                    onChange={(e) => setEditLeaseEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vacate / Clear Confirmation Dialog */}
      {isVacateModalOpen && unitToVacate && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Vacate Tenant & Free Up Unit?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to clear <strong>{unitToVacate.currentTenant?.name}</strong> from <strong>Unit {unitToVacate.unitNumber}</strong>?
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 text-left space-y-1">
                <p>✓ Unit {unitToVacate.unitNumber} will be marked as <strong>Available</strong>.</p>
                <p>✓ It will appear in the Available list on the dashboard.</p>
                <p>✓ You will be able to click and lease it to another tenant immediately.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsVacateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVacate}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Yes, Clear & Make Unit Available
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Modify Deposit Modal */}
      {isDepositModalOpen && depositUnit && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Record / Add Security Deposit
                  </h3>
                  <p className="text-[11px] text-slate-500">Unit {depositUnit.unitNumber} • {depositUnit.currentTenant?.name}</p>
                </div>
              </div>
              <button onClick={() => setIsDepositModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDepositRecord} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monthly Base Rent:
                </label>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-extrabold text-slate-900 text-sm">
                  ${(depositUnit.monthlyRateUSD || 500).toLocaleString()} USD/mo
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deposit Months / Option</label>
                <select
                  value={isCustomDeposit ? 'custom' : depositMonths}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomDeposit(true);
                    } else {
                      setIsCustomDeposit(false);
                      setDepositMonths(Number(e.target.value));
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value={1}>1 Month Deposit (${(depositUnit.monthlyRateUSD || 500) * 1})</option>
                  <option value={2}>2 Months Deposit (${(depositUnit.monthlyRateUSD || 500) * 2}) • Standard</option>
                  <option value={3}>3 Months Deposit (${(depositUnit.monthlyRateUSD || 500) * 3})</option>
                  <option value="custom">Custom Deposit Amount ($ USD)</option>
                </select>
              </div>

              {isCustomDeposit && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custom Amount (USD $)</label>
                  <input
                    type="number"
                    step="any"
                    value={customDepositAmount}
                    onChange={(e) => setCustomDepositAmount(e.target.value)}
                    placeholder="Enter deposit in USD"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Depository Trust Account</label>
                <select
                  value={depositBankAccount}
                  onChange={(e) => setDepositBankAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="Stanbic Bank - Escrow Liability #8892-01">Stanbic Bank - Escrow Liability #8892-01</option>
                  <option value="Central Vault Cash Float - Nyakuron">Central Vault Cash Float - Nyakuron</option>
                  <option value="Ecobank Commercial Escrow #4410-09">Ecobank Commercial Escrow #4410-09</option>
                </select>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <span className="font-bold text-slate-700">Total Deposit to Hold:</span>
                <span className="font-black text-emerald-700 text-sm">
                  ${(isCustomDeposit ? (parseFloat(customDepositAmount) || 0) : (depositUnit.monthlyRateUSD || 500) * depositMonths).toLocaleString()} USD
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Confirm & Hold Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
