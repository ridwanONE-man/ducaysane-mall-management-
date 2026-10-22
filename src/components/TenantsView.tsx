import { formatMoney, formatLongDate, parsePaymentDate } from '../utils/printUtils';
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
  Database,
  Check,
  AlertCircle,
  UserX,
  UserPlus,
  Plus,
  LayoutGrid
} from 'lucide-react';
import { TenantInfo, PropertyUnit, PaymentRecord, DepositRecord, BillingStatus } from '../types';
import { ModifyTenantPricingPayload, VacateUnitPayload } from '../lib/supabaseService';
import { DeleteButton, ClearAllButton } from './DeleteControls';
import { TenantAccount, accountKey } from '../utils/tenantAccount';
import { formatUnitRent, rentFields, unitCurrency, unitRent } from '../utils/currency';

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
  onDeleteTenant?: (unitId: string) => void;
  onClearAllTenants?: () => void;
  tenantAccounts?: TenantAccount[];
  onOpenTenantPayments?: (account: TenantAccount) => void;
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
  onOpenAssignUnit,
  onDeleteTenant,
  onClearAllTenants,
  tenantAccounts = [],
  onOpenTenantPayments
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

  const accountFor = (tenant: TenantInfo, unit?: PropertyUnit) =>
    unit ? tenantAccounts.find(a => a.key === accountKey(tenant.name, unit.unitNumber)) : undefined;

  const usd = (n: number, currency: 'USD' | 'SSP' = 'USD') => formatMoney(n, currency);

  // Paid / balance badge, linking to the tenant's account on the Payments page
  const renderAccountStatus = (tenant: TenantInfo, unit?: PropertyUnit) => {
    const account = accountFor(tenant, unit);
    if (!account) return null;
    return (
      <button
        type="button"
        onClick={() => onOpenTenantPayments?.(account)}
        title="Open this tenant's months and vouchers on the Payments page"
        className={`w-full mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-colors cursor-pointer ${
          account.balance > 0
            ? 'bg-rose-50 border-rose-200 hover:bg-rose-100'
            : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
        }`}
      >
        <span className="flex flex-col items-start min-w-0">
          <span className={`font-extrabold ${account.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {account.balance > 0
              ? `Balance ${usd(account.balance, account.currency)} • ${account.owing.length} month${account.owing.length === 1 ? '' : 's'}`
              : '✓ Paid up to date'}
          </span>
          <span className="text-[10px] text-slate-500 truncate max-w-full">
            {account.balance > 0
              ? account.owing.map(m => m.short).join(', ')
              : `${account.paidCount} month${account.paidCount === 1 ? '' : 's'} paid`}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 shrink-0">
          {account.depositHeld > 0 && (
            <span className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black">
              Deposit {usd(account.depositHeld, account.currency)}
            </span>
          )}
        </span>
      </button>
    );
  };

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
    setModMonthlyUSD(String(unitRent(unit)));
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

    // Rent is edited in the unit's own currency ($ or SSP); deposits aren't edited here.
    const { unit: currentUnit } = modifyingTarget;
    const rent = rentFields(parseFloat(modMonthlyUSD) || 0, unitCurrency(currentUnit));
    const monthlyUSD = rent.monthlyRateUSD;
    const monthlySSP = rent.monthlyRateSSP;
    const depositUSD = currentUnit.escrowDepositUSD || 0;
    const depositSSP = currentUnit.escrowDepositSSP || 0;

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
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tenants</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Everyone renting a shop or space — contacts, leases and balances.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tenant, trade, unit #..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {onClearAllTenants && (
              <ClearAllButton
                count={listItems.length}
                itemLabel="tenants"
                onClear={onClearAllTenants}
                message={<>All tenants are removed and their units become <strong>Available</strong>. Units, payments, deposits, cashflow, receipts, reports and analytics are <strong>kept</strong>.</>}
              />
            )}

            {availableUnits.length > 0 && onOpenAssignUnit && (
              <button
                onClick={() => onOpenAssignUnit(availableUnits[0])}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-extrabold shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" /> Lease a Unit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category tiles: tap to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {([
          { tab: 'All', soft: 'bg-slate-50 border-slate-200', ink: 'text-slate-900', ring: 'bg-slate-200/60', count: totalCount, sub: `${tenantAccounts.filter(a => a.balance <= 0).length} paid up`, icon: Users, tone: 'from-slate-700 to-slate-900' },
          { tab: 'Shops', soft: 'bg-orange-50 border-orange-200', ink: 'text-orange-600', ring: 'bg-orange-200/50', count: shopsCount, sub: 'G… units', icon: Store, tone: 'from-orange-500 to-amber-500' },
          { tab: 'Spaces', soft: 'bg-sky-50 border-sky-200', ink: 'text-sky-600', ring: 'bg-sky-200/50', count: spacesCount, sub: 'BW… units', icon: LayoutGrid, tone: 'from-sky-500 to-blue-500' },
          { tab: 'Overdue', soft: 'bg-rose-50 border-rose-200', ink: 'text-rose-600', ring: 'bg-rose-200/50', count: overdueCount, sub: overdueCount ? 'owe rent' : 'nobody late', icon: AlertTriangle, tone: 'from-rose-500 to-orange-500' },
          { tab: 'Expiring Soon', soft: 'bg-amber-50 border-amber-200', ink: 'text-amber-600', ring: 'bg-amber-200/50', count: expiringSoonCount, sub: 'within 15 days', icon: Clock, tone: 'from-amber-500 to-yellow-500' },
          { tab: 'Available Units', soft: 'bg-emerald-50 border-emerald-200', ink: 'text-emerald-600', ring: 'bg-emerald-200/50', count: availableCount, sub: 'ready to lease', icon: DoorOpen, tone: 'from-emerald-500 to-teal-500' },
        ] as const).map(({ tab, count, sub, icon: Icon, tone, soft, ink, ring }) => {
          const active = activeCategoryTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveCategoryTab(tab)}
              className={`group relative overflow-hidden text-left rounded-3xl p-4 border transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
                active
                  ? `bg-gradient-to-br ${tone} text-white border-transparent shadow-lg`
                  : `${soft} hover:shadow-md`
              }`}
            >
              <div className={`absolute -right-6 -bottom-8 w-24 h-24 rounded-full ${active ? 'bg-white/15' : ring}`} />
              <div className={`absolute right-10 -top-6 w-12 h-12 rounded-full ${active ? 'bg-white/10' : ring} opacity-60`} />
              <div className="relative flex items-center justify-between">
                <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${active ? 'bg-white/20' : `bg-gradient-to-br ${tone} text-white shadow-md`}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className={`text-3xl font-black leading-none ${active ? 'text-white' : ink}`}>{count}</span>
              </div>
              <p className={`relative mt-3 text-xs font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>{tab}</p>
              <p className={`relative text-[10px] font-semibold ${active ? 'text-white/80' : 'text-slate-500'}`}>{sub}</p>
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
                      <strong className="text-slate-900 font-bold">{formatUnitRent(unit)}/mo</strong>
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
            const account = accountFor(tenant, unit);
            const cur = account?.currency || 'USD';
            const balance = account ? account.balance : tenant.balanceUSD || 0;
            const deposit = account ? account.depositHeld : tenant.depositUSD || unit?.escrowDepositUSD || 0;
            const start = parsePaymentDate(unit?.leaseStart || tenant.leaseStart);
            const end = parsePaymentDate(unit?.leaseEnd || tenant.leaseEnd);
            const today = new Date(new Date().setHours(0, 0, 0, 0));
            const daysLeft = end ? Math.round((end.getTime() - today.getTime()) / 86_400_000) : null;
            const leasePct = start && end && end > start
              ? Math.min(100, Math.max(0, ((today.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100))
              : 0;
            const leaseTone = daysLeft === null ? 'text-slate-500' : daysLeft < 0 ? 'text-rose-600' : daysLeft <= 15 ? 'text-amber-600' : 'text-emerald-600';
            const band = isShop ? 'from-orange-500 to-amber-500' : 'from-sky-500 to-blue-500';

            return (
              <div
                key={tenant.id}
                className="group bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
              >
                {/* Coloured header: who and where */}
                <div className={`relative overflow-hidden bg-gradient-to-br ${band} text-white px-5 pt-4 pb-5`}>
                  <div className="absolute -right-6 -top-8 w-24 h-24 rounded-full bg-white/10" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-12 h-12 shrink-0 rounded-2xl bg-white/20 backdrop-blur-xs text-white font-black text-base flex items-center justify-center ring-2 ring-white/30">
                        {tenant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-base leading-tight truncate">{tenant.name}</h3>
                        <p className="text-[11px] text-white/80 truncate">{tenant.trade || (isShop ? 'Shop' : 'Space')}</p>
                      </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white text-slate-900 text-xs font-black font-mono shadow-sm">{tenant.unitNumber}</span>
                  </div>
                  <div className="relative mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded-md bg-white/20">{isShop ? 'Shop' : 'Space'} • {unit?.floor || 'Ground Floor'}</span>
                    {balance > 0
                      ? <span className="px-2 py-0.5 rounded-md bg-rose-600/90">Owes {formatMoney(balance, cur)}</span>
                      : <span className="px-2 py-0.5 rounded-md bg-emerald-600/90">✓ Paid up</span>}
                  </div>
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col">
                  {/* Key numbers */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Rent / month', value: formatUnitRent(unit), tone: 'text-slate-900' },
                      { label: 'Balance', value: balance > 0 ? formatMoney(balance, cur) : 'Paid up', tone: balance > 0 ? 'text-rose-600' : 'text-emerald-600' },
                      { label: 'Deposit', value: deposit > 0 ? formatMoney(deposit, cur) : 'None', tone: deposit > 0 ? 'text-sky-700' : 'text-slate-400' },
                      { label: 'Months owed', value: account ? String(account.owing.length) : '—', tone: account && account.owing.length ? 'text-rose-600' : 'text-slate-900' },
                    ].map(k => (
                      <div key={k.label} className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{k.label}</span>
                        <span className={`block text-sm font-black truncate ${k.tone}`}>{k.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Lease */}
                  <div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 font-semibold text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-orange-500" />
                        {start && end ? `${formatLongDate(start)} → ${formatLongDate(end)}` : 'No lease dates'}
                      </span>
                      <span className={`font-black ${leaseTone}`}>
                        {daysLeft === null ? '' : daysLeft < 0 ? `Expired ${-daysLeft}d ago` : daysLeft === 0 ? 'Ends today' : `${daysLeft} days left`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${daysLeft !== null && daysLeft <= 15 ? 'bg-gradient-to-r from-rose-500 to-amber-500' : `bg-gradient-to-r ${band}`}`}
                        style={{ width: `${leasePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-600 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="truncate font-semibold">{tenant.phone || 'No phone'}</span>
                    </span>
                    {account && onOpenTenantPayments && (
                      <button
                        type="button"
                        onClick={() => onOpenTenantPayments(account)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold cursor-pointer"
                        title="Open this tenant's months and vouchers on the Payments page"
                      >
                        <CreditCard className="w-3 h-3" /> Payments
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedTenant({ tenant, unit })}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="View full tenant profile"
                    >
                      <FileText className="w-3.5 h-3.5" /> Profile
                    </button>
                    <button
                      onClick={() => unit && openModifyModal(unit, tenant)}
                      className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Change tenant details and rent"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Modify
                    </button>
                    <button
                      onClick={() => unit && openVacateModal(unit, tenant)}
                      className="px-2.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Vacate this unit and mark it as available"
                    >
                      <DoorOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Vacate</span>
                    </button>
                    {onDeleteTenant && unit && (
                      <DeleteButton
                        className="py-2 px-2"
                        title="Delete tenant"
                        onDelete={() => onDeleteTenant(unit.id)}
                        confirm={{
                          title: 'Delete this tenant?',
                          subject: `${tenant.name} • ${unit.unitNumber}`,
                          message: `The tenant is removed from the database and ${unit.unitNumber} becomes Available. Payments, deposits, cashflow and reports are kept.`,
                          confirmLabel: 'Delete tenant',
                        }}
                      />
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
                      {formatUnitRent(selectedTenant.unit)}
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

              {/* Rent account: paid / balance */}
              {renderAccountStatus(selectedTenant.tenant, selectedTenant.unit)}

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

                {onDeleteTenant && selectedTenant.unit && (
                  <DeleteButton
                    label="Delete Tenant"
                    title="Delete tenant"
                    onDelete={() => {
                      onDeleteTenant(selectedTenant.unit!.id);
                      setSelectedTenant(null);
                    }}
                    confirm={{
                      title: 'Delete this tenant?',
                      subject: `${selectedTenant.tenant.name} • ${selectedTenant.unit.unitNumber}`,
                      message: `The tenant is removed from the database and ${selectedTenant.unit.unitNumber} becomes Available. Payments, deposits, cashflow and reports are kept.`,
                      confirmLabel: 'Delete tenant',
                    }}
                  />
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
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Lease Rate
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Monthly Rent ({unitCurrency(modifyingTarget.unit) === 'USD' ? 'USD $' : 'SSP'})</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">{unitCurrency(modifyingTarget.unit) === 'USD' ? '$' : 'SSP'}</span>
                        <input
                          type="number"
                          step="any"
                          value={modMonthlyUSD}
                          onChange={(e) => setModMonthlyUSD(e.target.value)}
                          placeholder="600"
                          className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-white font-semibold"
                        />
                      </div>
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
