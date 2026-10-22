import React, { useState, useEffect } from 'react';
import { X, Store, Check, Layers, Calendar, DollarSign, Phone, UserCheck, AlertCircle, Trash2 } from 'lucide-react';
import { PropertyUnit, UnitType, OccupancyStatus } from '../types';
import { leaseMonthCount } from '../utils/rentLedger';
import { DurationPicker, formatDuration } from './DurationPicker';
import { RentCurrency, rentFields, unitCurrency, unitRent } from '../utils/currency';
import { formatMoney } from '../utils/printUtils';

// What a new lease puts on the tenant's balance: every month of the duration.
function tenantLeaseTotal(months: number, rent: number, currency: RentCurrency) {
  if (months <= 0 || rent <= 0) return null;
  return (
    <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs">
      <div>
        <span className="block text-[10px] font-bold uppercase text-rose-700">Lease total added to balance</span>
        <span className="text-slate-600">
          {months} month{months === 1 ? '' : 's'} × {formatMoney(rent, currency)} rent — collected on the Payments page
        </span>
      </div>
      <span className="text-lg font-black text-rose-600 shrink-0">{formatMoney(months * rent, currency)}</span>
    </div>
  );
}


const DAY_MS = 1000 * 60 * 60 * 24;

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be UTC midnight).
const parseISODate = (s?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// Adds whole months, clamping to the last day of the month (Jan 31 + 1 month = Feb 28/29).
const addMonths = (start: Date, months: number) => {
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(start.getDate(), lastDay));
  return target;
};

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

function calculateLease(leaseStart: string, durationMonths: number) {
  const start = parseISODate(leaseStart);
  if (!start) return null;
  const end = addMonths(start, Math.max(1, durationMonths || 1));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    endStr: toISODate(end),
    endLabel: end.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
    totalDays: daysBetween(start, end),
    daysRemaining: daysBetween(today, end),
    daysUntilStart: daysBetween(today, start),
  };
}

// Whole months between two lease dates, used to restore the duration when editing.
function monthsBetween(startStr?: string, endStr?: string) {
  const start = parseISODate(startStr);
  const end = parseISODate(endStr);
  if (!start || !end) return null;
  for (let m = 1; m <= 120; m++) {
    if (addMonths(start, m) >= end) return m;
  }
  return null;
}

// One numbered block of the form (Unit, Rent, Tenant, Lease)
const Section: React.FC<{ step: number; title: string; icon: React.ComponentType<{ className?: string }>; right?: React.ReactNode; children: React.ReactNode }> = ({ step, title, icon: Icon, right, children }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white text-[11px] font-black flex items-center justify-center shadow-sm">{step}</span>
        <Icon className="w-4 h-4 text-orange-500" />
        <h4 className="text-xs font-extrabold text-slate-900">{title}</h4>
      </div>
      {right}
    </div>
    {children}
  </section>
);

interface AddUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveUnit: (unit: PropertyUnit) => void;
  editingUnit?: PropertyUnit | null;
}

export const AddUnitModal: React.FC<AddUnitModalProps> = ({
  isOpen,
  onClose,
  onSaveUnit,
  editingUnit
}) => {
  const isEditing = Boolean(editingUnit);

  // Step 1: Unit Category selection ('Shop' | 'Space')
  const [selectedCategory, setSelectedCategory] = useState<'Shop' | 'Space'>('Shop');
  const [unitCodeInput, setUnitCodeInput] = useState('');
  const [floor, setFloor] = useState<'Ground Floor' | 'Floor 1' | 'Floor 2' | 'Floor 3'>('Ground Floor');
  const [trade, setTrade] = useState('');
  const [sizeSqM, setSizeSqM] = useState<string>('30');
  const [meterNumber, setMeterNumber] = useState('');
  const [monthlyRent, setMonthlyRent] = useState<string>('500');
  const [rentCurrency, setRentCurrency] = useState<RentCurrency>('USD');
  const [status, setStatus] = useState<OccupancyStatus>('Available');

  // Tenant Fields
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  // Lease calculations
  const todayStr = toISODate(new Date());
  const [leaseStart, setLeaseStart] = useState(todayStr);
  const [leaseDurationMonths, setLeaseDurationMonths] = useState<number>(1);

  const [notes, setNotes] = useState('');

  const lease = calculateLease(leaseStart, leaseDurationMonths);
  const calculatedEnd = lease?.endStr || '';
  const calculatedDaysRemaining = lease?.daysRemaining ?? 0;

  // Sync state when editingUnit changes or modal opens
  useEffect(() => {
    if (editingUnit) {
      const isShop = editingUnit.categoryType === 'Shop' || editingUnit.unitNumber.startsWith('G');
      setSelectedCategory(isShop ? 'Shop' : 'Space');

      // Strip prefix for input
      if (isShop) {
        setUnitCodeInput(editingUnit.unitNumber.replace(/^G-?/, ''));
      } else {
        setUnitCodeInput(editingUnit.unitNumber.replace(/^BW-?/, ''));
      }

      setFloor(editingUnit.floor || 'Ground Floor');
      setTrade(editingUnit.currentTenant?.trade || editingUnit.subType || '');
      setSizeSqM(editingUnit.sizeSqM ? String(editingUnit.sizeSqM) : '30');
      setMeterNumber(editingUnit.meterNumber || '');
      setRentCurrency(unitCurrency(editingUnit));
      setMonthlyRent(String(unitRent(editingUnit) || 500));

      setStatus(editingUnit.occupancyStatus || 'Available');
      setTenantName(editingUnit.currentTenant?.name || '');
      setTenantPhone(editingUnit.currentTenant?.phone || '');
      const editStart = parseISODate(editingUnit.leaseStart) ? editingUnit.leaseStart!.slice(0, 10) : toISODate(new Date());
      setLeaseStart(editStart);
      setLeaseDurationMonths(
        editingUnit.leaseTermMonths || monthsBetween(editingUnit.leaseStart, editingUnit.leaseEnd) || 1
      );
      setNotes(editingUnit.notes || '');
    } else {
      setSelectedCategory('Shop');
      setUnitCodeInput('');
      setFloor('Ground Floor');
      setTrade('');
      setSizeSqM('30');
      setMeterNumber('');
      setMonthlyRent('500');
      setRentCurrency('USD');
      setStatus('Available');
      setTenantName('');
      setTenantPhone('');
      setLeaseStart(toISODate(new Date()));
      setLeaseDurationMonths(1);
      setNotes('');
    }
  }, [editingUnit, isOpen]);

  // When switching category
  const handleCategoryChange = (cat: 'Shop' | 'Space') => {
    setSelectedCategory(cat);
    if (cat === 'Shop' && (monthlyRent === '100' || monthlyRent === '150')) {
      setMonthlyRent('500');
    } else if (cat === 'Space' && (monthlyRent === '500' || monthlyRent === '600')) {
      setMonthlyRent('150');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let cleanCode = unitCodeInput.trim();
    let finalUnitNumber = '';

    if (selectedCategory === 'Shop') {
      // Auto-prefix G: e.g. '001' -> 'G001', 'G015' -> 'G015'
      if (cleanCode.toUpperCase().startsWith('G')) {
        finalUnitNumber = cleanCode.toUpperCase();
      } else {
        finalUnitNumber = `G${cleanCode.padStart(3, '0')}`;
      }
    } else {
      // Auto-prefix BW-: e.g. '1-A' -> 'BW-1-A', 'BW-1-A' -> 'BW-1-A'
      if (cleanCode.toUpperCase().startsWith('BW-')) {
        finalUnitNumber = cleanCode.toUpperCase();
      } else if (cleanCode.toUpperCase().startsWith('BW')) {
        finalUnitNumber = cleanCode.replace(/^BW/i, 'BW-').toUpperCase();
      } else {
        finalUnitNumber = `BW-${cleanCode.toUpperCase()}`;
      }
    }

    const numSize = parseFloat(sizeSqM) || 30;
    const numRent = parseFloat(monthlyRent) || 0;
    // Security deposits are recorded on the Deposits page; keep any existing deposit when editing.
    const numDeposit = editingUnit?.escrowDepositUSD || 0;
    const existingDepositMonths = editingUnit?.depositMonths;

    // Entering a tenant name leases the unit; leaving it empty keeps the unit vacant.
    const hasTenant = tenantName.trim().length > 0;
    const assignedTenant = hasTenant ? {
      id: editingUnit?.currentTenant?.id || `t-${Date.now()}`,
      name: tenantName.trim(),
      trade: trade.trim() || (selectedCategory === 'Shop' ? 'General Retail' : 'Commercial Space'),
      code: editingUnit?.currentTenant?.code || `TNT-${finalUnitNumber}`,
      phone: tenantPhone.trim() || '+211 928 000 000',
      email: editingUnit?.currentTenant?.email || `${finalUnitNumber.toLowerCase()}@nyakuron.com`,
      unitNumber: finalUnitNumber,
      balanceUSD: rentCurrency === 'USD' ? editingUnit?.arrearsUSD || 0 : 0,
      balanceSSP: rentCurrency === 'SSP' ? editingUnit?.arrearsSSP || 0 : 0,
      depositUSD: numDeposit,
      depositMonths: existingDepositMonths,
      balanceStatus: (editingUnit?.arrearsUSD || 0) > 0 ? ('Overdue' as const) : ('Current' as const),
      status: 'Active' as const,
      leaseStart,
      leaseEnd: calculatedEnd,
      daysRemaining: calculatedDaysRemaining
    } : undefined;

    const finalUnit: PropertyUnit = {
      id: editingUnit ? editingUnit.id : `u-${Date.now()}`,
      unitNumber: finalUnitNumber,
      codeBadge: finalUnitNumber,
      floor,
      type: selectedCategory,
      categoryType: selectedCategory,
      subType: trade.trim() || (selectedCategory === 'Shop' ? 'Retail Shop' : 'Open Space'),
      sizeSqM: numSize,
      sizeSqFt: Math.round(numSize * 10.764 * 10) / 10,
      // Meter is no longer asked for; keep what the unit already has
      meterNumber: meterNumber.trim() || (selectedCategory === 'Shop' ? `MTR-${finalUnitNumber}` : '2 meter'),
      ...rentFields(numRent, rentCurrency),
      escrowDepositUSD: numDeposit,
      escrowDepositSSP: editingUnit?.escrowDepositSSP || 0,
      depositMonths: existingDepositMonths,
      occupancyStatus: hasTenant ? 'Occupied' : (status === 'Occupied' ? 'Available' : status),
      billingStatus: hasTenant ? (editingUnit?.billingStatus || 'Paid') : 'No Balance',
      billingMonthText: hasTenant ? (editingUnit?.billingMonthText || 'Paid • Sept 2026') : undefined,
      arrearsUSD: hasTenant && rentCurrency === 'USD' ? (editingUnit?.arrearsUSD || 0) : 0,
      arrearsSSP: hasTenant && rentCurrency === 'SSP' ? (editingUnit?.arrearsSSP || 0) : 0,
      currentTenant: assignedTenant,
      leaseStart: hasTenant ? leaseStart : undefined,
      leaseEnd: hasTenant ? calculatedEnd : undefined,
      leaseTermMonths: hasTenant ? leaseDurationMonths : undefined,
      daysRemaining: hasTenant ? calculatedDaysRemaining : undefined,
      daysToExpiry: hasTenant ? calculatedDaysRemaining : undefined,
      notes: notes.trim() || undefined,
    };

    onSaveUnit(finalUnit);
    onClose();
  };

  const isShop = selectedCategory === 'Shop';
  const hasTenant = tenantName.trim().length > 0;
  const previewNumber = unitCodeInput.trim()
    ? (isShop ? `G${unitCodeInput.trim().replace(/^G-?/i, '').toUpperCase()}` : `BW-${unitCodeInput.trim().replace(/^BW-?/i, '').toUpperCase()}`)
    : isShop ? 'G___' : 'BW-___';
  const field = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100';
  const label = 'block text-[11px] font-bold text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-50 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8 max-h-[92vh] flex flex-col font-sans">

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white px-6 py-5 shrink-0">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-orange-500/20" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold">{isEditing ? `Edit ${editingUnit?.unitNumber}` : 'Create Unit'}</h3>
                <p className="text-[11px] text-slate-300">Add a shop or space, and lease it now or later.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Live preview */}
          <div className="relative mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 font-mono font-black text-amber-300">{previewNumber}</span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10">{selectedCategory} • {floor}</span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10">{formatMoney(parseFloat(monthlyRent) || 0, rentCurrency)}/month</span>
            <span className={`px-2.5 py-1 rounded-lg font-bold ${hasTenant ? 'bg-emerald-500/90' : 'bg-white/10'}`}>
              {hasTenant ? 'Occupied' : 'Available'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">

            {/* 1. Unit */}
            <Section step={1} title="Unit" icon={Layers}>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { cat: 'Shop' as const, badge: 'G', title: 'Shop', sub: 'G001, G015…' },
                  { cat: 'Space' as const, badge: 'BW', title: 'Space', sub: 'BW-1-A, BW-4-B…' },
                ]).map(o => {
                  const on = selectedCategory === o.cat;
                  return (
                    <button
                      key={o.cat}
                      type="button"
                      onClick={() => handleCategoryChange(o.cat)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        on ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black ${
                        on ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {o.badge}
                      </span>
                      <span>
                        <span className="block text-xs font-extrabold text-slate-900">{o.title}</span>
                        <span className="block text-[10px] text-slate-500">{o.sub}</span>
                      </span>
                      {on && <Check className="w-4 h-4 text-orange-600 ml-auto" />}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={label}>{isShop ? 'Shop number' : 'Space number'}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-orange-600">{isShop ? 'G' : 'BW-'}</span>
                    <input
                      type="text"
                      required
                      value={unitCodeInput}
                      onChange={(e) => setUnitCodeInput(e.target.value)}
                      placeholder={isShop ? '001' : '1-A'}
                      className={`${field} ${isShop ? 'pl-7' : 'pl-10'} font-bold`}
                    />
                  </div>
                </div>
                <div>
                  <label className={label}>Floor</label>
                  <select value={floor} onChange={(e) => setFloor(e.target.value as typeof floor)} className={field}>
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="Floor 1">Floor 1</option>
                    <option value="Floor 2">Floor 2</option>
                    <option value="Floor 3">Floor 3</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Size (m²)</label>
                  <input type="number" step="any" required value={sizeSqM} onChange={(e) => setSizeSqM(e.target.value)} placeholder="30" className={field} />
                </div>
              </div>
            </Section>

            {/* 2. Rent */}
            <Section
              step={2}
              title="Monthly rent"
              icon={DollarSign}
              right={
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                  {(['USD', 'SSP'] as RentCurrency[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRentCurrency(c)}
                      className={`px-3 py-1 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                        rentCurrency === c ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {c === 'USD' ? '$ Dollar' : 'SSP'}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">{rentCurrency === 'USD' ? '$' : 'SSP'}</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  placeholder={rentCurrency === 'USD' ? '500' : '650000'}
                  className="w-full pl-14 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <p className="text-[10px] text-slate-500">Payments, balance and deposits for this unit use {rentCurrency === 'USD' ? 'dollars' : 'SSP'}.</p>
            </Section>

            {/* 3. Tenant */}
            <Section
              step={3}
              title="Tenant"
              icon={UserCheck}
              right={hasTenant ? (
                <button
                  type="button"
                  onClick={() => { setTenantName(''); setTenantPhone(''); setStatus('Available'); }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Remove tenant from this unit"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Optional</span>
              )}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Tenant name</label>
                  <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Leave empty to keep it available" className={field} />
                </div>
                <div>
                  <label className={label}>Phone</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="tel" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="+211 920 000 001" className={`${field} pl-8`} />
                  </div>
                </div>
              </div>
              <div>
                <label className={label}>Business / trade</label>
                <input type="text" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Electronics, Wholesale, Clothing" className={field} />
              </div>
            </Section>

            {/* 4. Lease — only when a tenant is entered */}
            {hasTenant ? (
              <Section step={4} title="Lease" icon={Calendar}>
                <div className="space-y-3">
                  <div>
                    <label className={label}>Start date</label>
                    <input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className={label}>Duration</label>
                    <DurationPicker months={leaseDurationMonths} onChange={setLeaseDurationMonths} />
                  </div>
                </div>

                {lease && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-900 text-white px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Ends on</span>
                      <span className="block text-sm font-extrabold">{lease.endLabel}</span>
                      <span className="block text-[10px] text-slate-400">{formatDuration(leaseDurationMonths)} • {lease.totalDays} days</span>
                    </div>
                    <div className={`rounded-xl px-3 py-2.5 ${
                      lease.daysRemaining > 7 ? 'bg-emerald-50 text-emerald-800' : lease.daysRemaining > 0 ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'
                    }`}>
                      <span className="block text-[9px] font-bold uppercase tracking-wider opacity-70">Days left</span>
                      <span className="block text-sm font-extrabold">
                        {lease.daysRemaining > 0 ? `${lease.daysRemaining} days` : lease.daysRemaining === 0 ? 'Ends today' : `Expired ${Math.abs(lease.daysRemaining)}d ago`}
                      </span>
                      {lease.daysUntilStart > 0 && <span className="block text-[10px] font-semibold">Starts in {lease.daysUntilStart} day{lease.daysUntilStart === 1 ? '' : 's'}</span>}
                    </div>
                  </div>
                )}
                {lease && tenantLeaseTotal(leaseMonthCount(leaseStart, lease.endStr), parseFloat(monthlyRent) || 0, rentCurrency)}
              </Section>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-[11px] text-slate-500">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                No tenant — the unit will be saved as <strong className="text-emerald-700">Available</strong>. Add a tenant name to set up the lease.
              </div>
            )}

            {/* Notes */}
            <div>
              <label className={label}>Notes <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Glass storefront, corner unit"
                className={`${field} resize-none`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 bg-white border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold rounded-xl shadow-md shadow-orange-500/25 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {isEditing ? 'Save Changes' : hasTenant ? `Create ${selectedCategory} & Lease` : `Create Available ${selectedCategory}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
