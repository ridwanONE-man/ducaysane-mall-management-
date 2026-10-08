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
  Edit3,
  Edit2,
  DoorOpen,
  DollarSign,
  Loader2,
  RefreshCw,
  Database,
  Check,
  AlertCircle,
  UserX,
  UserPlus,
  Plus
} from 'lucide-react';
import { initialTenants } from '../data/commercialData';
import { TenantInfo, PropertyUnit, PaymentRecord, DepositRecord, BillingStatus } from '../types';
import { ModifyTenantPricingPayload, VacateUnitPayload } from '../lib/supabaseService';

interface TenantsViewProps {
  units?: PropertyUnit[];
  payments?: PaymentRecord[];
  deposits?: DepositRecord[];
  onRecordPaymentForTenant: (unitNumber: string) => void;
  onSelectReceiptForPrint?: (payment: PaymentRecord) => void;
  onModifyTenantPricing?: (unitId: string, payload: ModifyTenantPricingPayload) => Promise<boolean>;
  onVacateUnit?: (unitId: string, payload?: VacateUnitPayload) => Promise<boolean>;
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
  onModifyTenantPricing,
  onVacateUnit,
  onSaveUnit,
  onSaveDeposit,
  onOpenAssignUnit
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'All' | 'Shops' | 'Spaces' | 'Overdue' | 'Expiring Soon' | 'Available Units'>('All');
  const [selectedTenant, setSelectedTenant] = useState<{ tenant: TenantInfo; unit?: PropertyUnit } | null>(null);

  // Modify Tenant & Price Modal State
  const [modifyingTarget, setModifyingTarget] = useState<{ unit: PropertyUnit; tenant: TenantInfo } | null>(null);
  const [modName, setModName] = useState('');
  const [modTrade, setModTrade] = useState('');
  const [modPhone, setModPhone] = useState('');
  const [modEmail, setModEmail] = useState('');
  const [modCode, setModCode] = useState('');
  const [modMonthlyUSD, setModMonthlyUSD] = useState('');
  const [modMonthlySSP, setModMonthlySSP] = useState('');
  const [modDepositUSD, setModDepositUSD] = useState('');
  const [modDepositSSP, setModDepositSSP] = useState('');
  const [modLeaseStart, setModLeaseStart] = useState('');
  const [modLeaseEnd, setModLeaseEnd] = useState('');
  const [modBillingStatus, setModBillingStatus] = useState<BillingStatus>('Paid');
  const [modNotes, setModNotes] = useState('');
  const [isModSaving, setIsModSaving] = useState(false);
  const [modError, setModError] = useState<string | null>(null);

  // Vacate Unit Modal State
  const [vacatingTarget, setVacatingTarget] = useState<{ unit: PropertyUnit; tenant: TenantInfo } | null>(null);
  const [vacateDate, setVacateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vacateReason, setVacateReason] = useState('End of Lease Term');
  const [vacateNotes, setVacateNotes] = useState('');
  const [vacateConfirmed, setVacateConfirmed] = useState(false);
  const [isVacatingSaving, setIsVacatingSaving] = useState(false);
  const [vacateError, setVacateError] = useState<string | null>(null);

  // Add / Modify Deposit Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositUnit, setDepositUnit] = useState<PropertyUnit | null>(null);
  const [depositMonths, setDepositMonths] = useState<number>(2);
  const [customDepositAmount, setCustomDepositAmount] = useState<string>('');
  const [isCustomDeposit, setIsCustomDeposit] = useState(false);
  const [depositBankAccount, setDepositBankAccount] = useState('Stanbic Bank - Escrow Liability #8892-01');

  // Derive active tenant list combined with live unit states
  const derivedTenants: { tenant: TenantInfo; unit: PropertyUnit }[] = units
    .filter(u => u.occupancyStatus !== 'Available' && u.currentTenant && u.currentTenant.name.trim().length > 0)
    .map(u => {
      const matchingDeposit = deposits.find(d => d.unitNumber === u.unitNumber && d.status === 'Held in Escrow');
      const depositAmount = matchingDeposit?.amountUSD || u.escrowDepositUSD || 0;
      const depositMos = matchingDeposit?.depositMonths || u.depositMonths || (depositAmount > 0 && u.monthlyRateUSD > 0 ? Math.max(1, Math.round(depositAmount / u.monthlyRateUSD)) : 0);

      return {
        unit: u,
        tenant: {
          ...u.currentTenant!,
          unitNumber: u.unitNumber,
          balanceUSD: u.arrearsUSD || 0,
          balanceSSP: u.arrearsSSP || 0,
          depositUSD: depositAmount,
          depositMonths: depositMos,
          balanceStatus: ((u.arrearsUSD || 0) > 0 || (u.arrearsSSP || 0) > 0) ? ('Overdue' as const) : ('Current' as const),
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

  // Directly connect tenants to live units so any deletion or vacating from Units page reflects 1:1 immediately
  const listItems: { tenant: TenantInfo; unit?: PropertyUnit }[] = derivedTenants;

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

  // Open Edit / Replace Modal (delegates to comprehensive Supabase modify)
  const handleOpenEdit = (unit: PropertyUnit, tenant: TenantInfo) => {
    openModifyModal(unit, tenant);
  };

  // Open Vacate / Clear Tenant Confirmation (delegates to comprehensive Supabase vacate)
  const handleOpenVacate = (unit: PropertyUnit) => {
    if (unit.currentTenant) {
      openVacateModal(unit, unit.currentTenant);
    }
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

  // Open Modify Modal
  const openModifyModal = (unit: PropertyUnit, tenant: TenantInfo) => {
    setModifyingTarget({ unit, tenant });
    setModName(tenant.name || '');
    setModTrade(tenant.trade || '');
    setModPhone(tenant.phone || '');
    setModEmail(tenant.email || '');
    setModCode(tenant.code || '');
    setModMonthlyUSD(String(unit.monthlyRateUSD || 0));
    setModMonthlySSP(String(unit.monthlyRateSSP || (unit.monthlyRateUSD ? unit.monthlyRateUSD * 1300 : 0)));
    setModDepositUSD(String(unit.escrowDepositUSD || unit.monthlyRateUSD || 0));
    setModDepositSSP(String(unit.escrowDepositSSP || (unit.monthlyRateSSP || (unit.monthlyRateUSD ? unit.monthlyRateUSD * 1300 : 0))));
    setModLeaseStart(unit.leaseStart || tenant.leaseStart || '2026-09-01');
    setModLeaseEnd(unit.leaseEnd || tenant.leaseEnd || '2026-10-01');
    setModBillingStatus(unit.billingStatus || 'Paid');
    setModNotes(unit.notes || '');
    setModError(null);
  };

  // Open Vacate Modal
  const openVacateModal = (unit: PropertyUnit, tenant: TenantInfo) => {
    setVacatingTarget({ unit, tenant });
    setVacateDate(new Date().toISOString().slice(0, 10));
    setVacateReason('End of Lease Term');
    setVacateNotes('');
    setVacateConfirmed(false);
    setVacateError(null);
  };

  // Submit Modify Form
  const handleSaveModify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingTarget) return;

    if (!modName.trim()) {
      setModError('Tenant name is required.');
      return;
    }

    const monthlyUSD = parseFloat(modMonthlyUSD) || 0;
    const monthlySSP = parseFloat(modMonthlySSP) || 0;
    const depositUSD = parseFloat(modDepositUSD) || 0;
    const depositSSP = parseFloat(modDepositSSP) || 0;

    setIsModSaving(true);
    setModError(null);

    const payload: ModifyTenantPricingPayload = {
      tenantName: modName.trim(),
      trade: modTrade.trim(),
      phone: modPhone.trim(),
      email: modEmail.trim(),
      tenantCode: modCode.trim() || undefined,
      monthlyRateUSD: monthlyUSD,
      monthlyRateSSP: monthlySSP,
      securityDepositUSD: depositUSD,
      securityDepositSSP: depositSSP,
      leaseStart: modLeaseStart || undefined,
      leaseEnd: modLeaseEnd || undefined,
      billingStatus: modBillingStatus,
      notes: modNotes.trim() || undefined,
    };

    try {
      if (onModifyTenantPricing) {
        const ok = await onModifyTenantPricing(modifyingTarget.unit.id, payload);
        if (ok) {
          setModifyingTarget(null);
          // If selectedTenant was this unit, update its local view
          if (selectedTenant && selectedTenant.unit?.id === modifyingTarget.unit.id) {
            setSelectedTenant(prev => prev ? {
              ...prev,
              tenant: {
                ...prev.tenant,
                name: payload.tenantName,
                trade: payload.trade,
                phone: payload.phone,
                email: payload.email,
                leaseStart: payload.leaseStart,
                leaseEnd: payload.leaseEnd,
              },
              unit: {
                ...prev.unit!,
                monthlyRateUSD: payload.monthlyRateUSD,
                monthlyRateSSP: payload.monthlyRateSSP,
                escrowDepositUSD: payload.securityDepositUSD,
                escrowDepositSSP: payload.securityDepositSSP,
                leaseStart: payload.leaseStart,
                leaseEnd: payload.leaseEnd,
                billingStatus: payload.billingStatus as any,
                notes: payload.notes,
              }
            } : null);
          }
        } else {
          setModError('Database update failed. Please check network connection.');
        }
      }
    } catch (err: any) {
      setModError(err?.message || 'Error saving changes to database.');
    } finally {
      setIsModSaving(false);
    }
  };

  // Submit Vacate Form
  const handleConfirmVacate = async () => {
    if (!vacatingTarget) return;

    if (!vacateConfirmed) {
      setVacateError('Please confirm the acknowledgment checkbox before proceeding.');
      return;
    }

    setIsVacatingSaving(true);
    setVacateError(null);

    const payload: VacateUnitPayload = {
      vacatedDate: vacateDate,
      reason: vacateReason,
      notes: vacateNotes.trim() || undefined,
    };

    try {
      if (onVacateUnit) {
        const ok = await onVacateUnit(vacatingTarget.unit.id, payload);
        if (ok) {
          setVacatingTarget(null);
          if (selectedTenant && selectedTenant.unit?.id === vacatingTarget.unit.id) {
            setSelectedTenant(null);
          }
        } else {
          setVacateError('Database update failed when vacating unit.');
        }
      }
    } catch (err: any) {
      setVacateError(err?.message || 'Error vacating unit in database.');
    } finally {
      setIsVacatingSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <span>Ducaysane Mall</span>
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
          <h3 className="font-bold text-slate-800 text-sm">
            {totalCount === 0 ? 'No Active Tenants' : 'No Tenants Found'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {totalCount === 0 
              ? 'There are currently no active tenants assigned to any commercial units.' 
              : 'Try changing your search query or tab filter.'}
          </p>
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
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedTenant({ tenant, unit })}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="View full tenant ledger and profile"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={() => unit && openModifyModal(unit, tenant)}
                    className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="Modify tenant details and lease price in database"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Modify</span>
                  </button>

                  <button
                    onClick={() => unit && openVacateModal(unit, tenant)}
                    className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="Vacate this unit and mark as available"
                  >
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                    <span className="hidden sm:inline">Vacate</span>
                  </button>

                  <button
                    onClick={() => onRecordPaymentForTenant(tenant.unitNumber || 'G001')}
                    className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs shadow-orange-500/20"
                    title="Record rent payment"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay</span>
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-base flex items-center justify-center shadow-md shadow-blue-500/20">
                  {selectedTenant.tenant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedTenant.tenant.name}</h2>
                  <p className="text-xs text-slate-500">{selectedTenant.tenant.trade} • {selectedTenant.tenant.code || 'Registered Tenant'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedTenant.unit && (
                  <button
                    onClick={() => openModifyModal(selectedTenant.unit!, selectedTenant.tenant)}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Modify details or price"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Modify</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedTenant(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                {selectedTenant.unit && (
                  <button
                    type="button"
                    onClick={() => {
                      openVacateModal(selectedTenant.unit!, selectedTenant.tenant);
                    }}
                    className="px-3.5 py-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                    <span>Vacate Unit</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedTenant(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
                  >
                    Close
                  </button>

                  {selectedTenant.unit && (
                    <button
                      type="button"
                      onClick={() => {
                        openModifyModal(selectedTenant.unit!, selectedTenant.tenant);
                      }}
                      className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Modify / Price</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const unitNum = selectedTenant.tenant.unitNumber || 'G001';
                      setSelectedTenant(null);
                      onRecordPaymentForTenant(unitNum);
                    }}
                    className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Record Rent</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MODIFY DETAILS / PRICE (Direct Database Sync)     */}
      {/* ======================================================== */}
      {modifyingTarget && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <form onSubmit={handleSaveModify}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-slate-900">Modify Details & Price</h2>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold font-mono">
                        {modifyingTarget.unit.unitNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Updates tenant information and monthly rental rates directly in Supabase.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModifyingTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[70vh] overflow-y-auto">
                {modError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{modError}</span>
                  </div>
                )}

                {/* Section 1: Tenant Profile */}
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Tenant Identity & Contact
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tenant Full Name *</label>
                      <input
                        type="text"
                        required
                        value={modName}
                        onChange={(e) => setModName(e.target.value)}
                        placeholder="e.g. Saber Ibrahim"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Business / Trade</label>
                      <input
                        type="text"
                        value={modTrade}
                        onChange={(e) => setModTrade(e.target.value)}
                        placeholder="e.g. Electronics & Accessories"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={modPhone}
                        onChange={(e) => setModPhone(e.target.value)}
                        placeholder="+211 910 000 000"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={modEmail}
                        onChange={(e) => setModEmail(e.target.value)}
                        placeholder="tenant@domain.com"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Monthly Rent & Security Deposit */}
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Lease Rates & Security Deposit
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const usd = parseFloat(modMonthlyUSD) || 0;
                        if (usd > 0) {
                          setModMonthlySSP(String(Math.round(usd * 1300)));
                        }
                        const depUSD = parseFloat(modDepositUSD) || 0;
                        if (depUSD > 0) {
                          setModDepositSSP(String(Math.round(depUSD * 1300)));
                        }
                      }}
                      className="text-[10px] text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 cursor-pointer bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/50"
                      title="Calculate SSP at rate 1 USD = 1,300 SSP"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sync SSP @ 1,300 Rate</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Monthly Rent (USD $)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          value={modMonthlyUSD}
                          onChange={(e) => setModMonthlyUSD(e.target.value)}
                          placeholder="600"
                          className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Monthly Rent (SSP)</label>
                      <input
                        type="number"
                        step="any"
                        value={modMonthlySSP}
                        onChange={(e) => setModMonthlySSP(e.target.value)}
                        placeholder="780000"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Security Deposit (USD $)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          value={modDepositUSD}
                          onChange={(e) => setModDepositUSD(e.target.value)}
                          placeholder="600"
                          className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Security Deposit (SSP)</label>
                      <input
                        type="number"
                        step="any"
                        value={modDepositSSP}
                        onChange={(e) => setModDepositSSP(e.target.value)}
                        placeholder="780000"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Lease Dates & Standing */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Lease Schedule & Status
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lease Start Date</label>
                      <input
                        type="date"
                        value={modLeaseStart}
                        onChange={(e) => setModLeaseStart(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Lease End Date</label>
                      <input
                        type="date"
                        value={modLeaseEnd}
                        onChange={(e) => setModLeaseEnd(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Billing Status</label>
                      <select
                        value={modBillingStatus}
                        onChange={(e) => setModBillingStatus(e.target.value as BillingStatus)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Overdue">Overdue</option>
                        <option value="No Balance">No Balance</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Internal Notes / Terms</label>
                    <textarea
                      rows={2}
                      value={modNotes}
                      onChange={(e) => setModNotes(e.target.value)}
                      placeholder="Special lease notes, price revisions, or remarks..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Syncs to Supabase Database</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isModSaving}
                    onClick={() => setModifyingTarget(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isModSaving}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {isModSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving to Database...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save & Sync Database</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VACATE UNIT CONFIRMATION (Database Sync)          */}
      {/* ======================================================== */}
      {vacatingTarget && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-rose-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Vacate Unit: {vacatingTarget.unit.unitNumber}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tenant will be checked out and unit restored to 'Available' status in Supabase.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVacatingTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              {vacateError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{vacateError}</span>
                </div>
              )}

              {/* Tenant Summary Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Occupant</span>
                  <span className="font-extrabold text-slate-900 text-sm">{vacatingTarget.tenant.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Business Trade:</span>
                  <span className="font-semibold text-slate-800">{vacatingTarget.tenant.trade}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Unit Space:</span>
                  <span className="font-semibold text-slate-800">{vacatingTarget.unit.unitNumber} ({vacatingTarget.unit.floor})</span>
                </div>
              </div>

              {/* Financial Reconcile Alert */}
              {(vacatingTarget.tenant.balanceUSD > 0 || (vacatingTarget.tenant.balanceSSP || 0) > 0) ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Outstanding Arrears Warning</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-700">
                    This tenant has an unpaid balance of{' '}
                    <strong className="font-extrabold">
                      {vacatingTarget.tenant.balanceUSD > 0 
                        ? `$${vacatingTarget.tenant.balanceUSD.toLocaleString()} USD` 
                        : `${(vacatingTarget.tenant.balanceSSP || 0).toLocaleString()} SSP`}
                    </strong>. Ensure collection or settlement before releasing keys or escrow deposit.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">No outstanding rent arrears. Tenant account is in good standing.</span>
                </div>
              )}

              {/* Escrow Deposit Notice */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-800 font-bold block uppercase">Security Deposit in Escrow</span>
                  <span className="text-xs text-amber-900 font-extrabold">
                    {vacatingTarget.unit.escrowDepositUSD 
                      ? `$${vacatingTarget.unit.escrowDepositUSD.toLocaleString()} USD` 
                      : `${(vacatingTarget.unit.escrowDepositSSP || 0).toLocaleString()} SSP`}
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md font-semibold">
                  Held in Escrow
                </span>
              </div>

              {/* Vacate Details Form */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Effective Vacation Date</label>
                  <input
                    type="date"
                    value={vacateDate}
                    onChange={(e) => setVacateDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vacate Reason</label>
                  <select
                    value={vacateReason}
                    onChange={(e) => setVacateReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                  >
                    <option value="End of Lease Term">End of Lease Term (Standard Expiry)</option>
                    <option value="Tenant Requested Early Termination">Tenant Requested Early Termination</option>
                    <option value="Default / Eviction for Non-Payment">Default / Eviction for Non-Payment</option>
                    <option value="Relocated to Another Unit">Relocated to Another Mall Unit</option>
                    <option value="Mutual Lease Cancellation">Mutual Lease Cancellation</option>
                    <option value="Other">Other Reason</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Handover & Inspection Remarks (Optional)</label>
                  <textarea
                    rows={2}
                    value={vacateNotes}
                    onChange={(e) => setVacateNotes(e.target.value)}
                    placeholder="e.g. Keys handed over, shop painted, electricity meter reading verified..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                  />
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vacateConfirmed}
                    onChange={(e) => setVacateConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-600 leading-snug">
                    I confirm that unit handover inspection has occurred and authorize updating unit{' '}
                    <strong>{vacatingTarget.unit.unitNumber}</strong> to <em>Available</em> in the live Supabase database.
                  </span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                disabled={isVacatingSaving}
                onClick={() => setVacatingTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Keep Occupied
              </button>

              <button
                type="button"
                disabled={isVacatingSaving || !vacateConfirmed}
                onClick={handleConfirmVacate}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {isVacatingSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Vacating in Supabase...</span>
                  </>
                ) : (
                  <>
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>Confirm & Vacate Unit</span>
                  </>
                )}
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
