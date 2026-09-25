import React, { useState, useEffect } from 'react';
import { X, Store, Check, Layers, Calendar, DollarSign, Phone, UserCheck, AlertCircle } from 'lucide-react';
import { PropertyUnit, UnitType, OccupancyStatus } from '../types';

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
  const [rentCurrency, setRentCurrency] = useState<'USD' | 'SSP'>('USD');
  const [status, setStatus] = useState<OccupancyStatus>('Available');

  // Tenant Fields
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  // Lease calculations
  const todayStr = '2026-09-25';
  const [leaseStart, setLeaseStart] = useState('2026-09-01');
  const [leaseDurationMonths, setLeaseDurationMonths] = useState<number>(1);
  const [calculatedEnd, setCalculatedEnd] = useState('2026-10-01');
  const [calculatedDaysRemaining, setCalculatedDaysRemaining] = useState<number>(7);

  const [notes, setNotes] = useState('');

  // Compute calculated end date & days remaining
  useEffect(() => {
    if (!leaseStart) return;
    try {
      const start = new Date(leaseStart);
      if (isNaN(start.getTime())) return;

      const end = new Date(start);
      end.setMonth(end.getMonth() + (Number(leaseDurationMonths) || 1));
      
      const year = end.getFullYear();
      const month = String(end.getMonth() + 1).padStart(2, '0');
      const day = String(end.getDate()).padStart(2, '0');
      const endStr = `${year}-${month}-${day}`;
      setCalculatedEnd(endStr);

      // Calculate days remaining relative to current date (or today)
      const current = new Date(todayStr);
      const diffTime = end.getTime() - current.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setCalculatedDaysRemaining(diffDays);
    } catch {
      // fallback
    }
  }, [leaseStart, leaseDurationMonths]);

  // Sync state when editingUnit changes or modal opens
  useEffect(() => {
    if (editingUnit) {
      const isShop = editingUnit.categoryType === 'Shop' || editingUnit.unitNumber.startsWith('G');
      setSelectedCategory(isShop ? 'Shop' : 'Space');

      // Strip prefix for input
      if (isShop) {
        setUnitCodeInput(editingUnit.unitNumber.replace(/^G-?/, ''));
        setRentCurrency('USD');
      } else {
        setUnitCodeInput(editingUnit.unitNumber.replace(/^BW-?/, ''));
        setRentCurrency(editingUnit.monthlyRateSSP > 0 && editingUnit.monthlyRateUSD <= 100 ? 'SSP' : 'USD');
      }

      setFloor(editingUnit.floor || 'Ground Floor');
      setTrade(editingUnit.currentTenant?.trade || editingUnit.subType || '');
      setSizeSqM(editingUnit.sizeSqM ? String(editingUnit.sizeSqM) : '30');
      setMeterNumber(editingUnit.meterNumber || '');
      
      if (!isShop && editingUnit.monthlyRateSSP > 0 && editingUnit.monthlyRateUSD <= 100) {
        setMonthlyRent(String(editingUnit.monthlyRateSSP));
      } else {
        setMonthlyRent(String(editingUnit.monthlyRateUSD));
      }

      setStatus(editingUnit.occupancyStatus || 'Available');
      setTenantName(editingUnit.currentTenant?.name || '');
      setTenantPhone(editingUnit.currentTenant?.phone || '');
      setLeaseStart(editingUnit.leaseStart || '2026-09-01');
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
      setLeaseStart('2026-09-01');
      setLeaseDurationMonths(1);
      setNotes('');
    }
  }, [editingUnit, isOpen]);

  // When switching category
  const handleCategoryChange = (cat: 'Shop' | 'Space') => {
    setSelectedCategory(cat);
    if (cat === 'Shop') {
      setRentCurrency('USD');
      if (monthlyRent === '100000' || monthlyRent === '50000') setMonthlyRent('500');
    } else {
      setRentCurrency('SSP');
      if (monthlyRent === '500' || monthlyRent === '600') setMonthlyRent('100000');
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

    let rateUSD = 0;
    let rateSSP = 0;

    if (rentCurrency === 'USD') {
      rateUSD = numRent;
      rateSSP = Math.round(numRent * 1300);
    } else {
      rateSSP = numRent;
      rateUSD = Math.round((numRent / 1300) * 100) / 100;
    }

    const hasTenant = Boolean(tenantName.trim().length > 0 || status === 'Occupied');
    const assignedTenant = hasTenant ? {
      id: editingUnit?.currentTenant?.id || `t-${Date.now()}`,
      name: tenantName.trim() || 'Commercial Tenant',
      trade: trade.trim() || (selectedCategory === 'Shop' ? 'General Retail' : 'Commercial Space'),
      code: `TNT-${finalUnitNumber}`,
      phone: tenantPhone.trim() || '+211 928 000 000',
      email: `${finalUnitNumber.toLowerCase()}@nyakuron.com`,
      unitNumber: finalUnitNumber,
      balanceUSD: editingUnit?.arrearsUSD || 0,
      balanceSSP: editingUnit?.arrearsSSP || 0,
      balanceStatus: (editingUnit?.arrearsUSD || 0) > 0 || (editingUnit?.arrearsSSP || 0) > 0 ? ('Overdue' as const) : ('Current' as const),
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
      meterNumber: meterNumber.trim() || (selectedCategory === 'Shop' ? `MTR-${finalUnitNumber}` : '2 meter'),
      monthlyRateUSD: rateUSD,
      monthlyRateSSP: rateSSP,
      escrowDepositUSD: rateUSD,
      escrowDepositSSP: rateSSP,
      occupancyStatus: hasTenant ? 'Occupied' : status,
      billingStatus: hasTenant ? (editingUnit?.billingStatus || 'Paid') : 'No Balance',
      billingMonthText: editingUnit?.billingMonthText || (hasTenant ? 'Paid • Sept 2026' : undefined),
      arrearsUSD: editingUnit?.arrearsUSD || 0,
      arrearsSSP: editingUnit?.arrearsSSP || 0,
      currentTenant: assignedTenant,
      leaseStart,
      leaseEnd: calculatedEnd,
      leaseTermMonths: leaseDurationMonths,
      daysRemaining: calculatedDaysRemaining,
      daysToExpiry: calculatedDaysRemaining,
      notes: notes.trim() || undefined,
    };

    onSaveUnit(finalUnit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8 max-h-[92vh] flex flex-col font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {isEditing ? `Edit Unit: ${editingUnit?.unitNumber}` : 'Register New Unit / Space'}
              </h3>
              <p className="text-xs text-slate-500">
                Nyakuron Business Centre • Inventory & Commercial Lease
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* STEP 1: Unit Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Select Unit Type / Category:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleCategoryChange('Shop')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                  selectedCategory === 'Shop'
                    ? 'border-orange-500 bg-orange-50/70 text-orange-950 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
                  selectedCategory === 'Shop' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  G
                </div>
                <div>
                  <p className="font-extrabold text-xs">Option A: Shop</p>
                  <p className="text-[11px] text-slate-500">Prefix: G (e.g. G001, G015) • USD</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange('Space')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                  selectedCategory === 'Space'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                  selectedCategory === 'Space' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  BW
                </div>
                <div>
                  <p className="font-extrabold text-xs">Option B: Space</p>
                  <p className="text-[11px] text-slate-500">Prefix: BW- (e.g. BW-1-A) • SSP/USD</p>
                </div>
              </button>
            </div>
          </div>

          {/* Unit Number & Floor Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {selectedCategory === 'Shop' ? 'Shop Number (auto-prefixed G)' : 'Space Number (auto-prefixed BW-)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">
                  {selectedCategory === 'Shop' ? 'G' : 'BW-'}
                </span>
                <input
                  type="text"
                  required
                  value={unitCodeInput}
                  onChange={(e) => setUnitCodeInput(e.target.value)}
                  placeholder={selectedCategory === 'Shop' ? '001 or 015' : '1-A or 4-B'}
                  className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Floor Level</label>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white"
              >
                <option value="Ground Floor">Ground Floor</option>
                <option value="Floor 1">Floor 1</option>
                <option value="Floor 2">Floor 2</option>
                <option value="Floor 3">Floor 3</option>
              </select>
            </div>
          </div>

          {/* Gross Area & Meter Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Gross Area (sq.m)</label>
              <input
                type="number"
                step="any"
                required
                value={sizeSqM}
                onChange={(e) => setSizeSqM(e.target.value)}
                placeholder="e.g. 30"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Electric Meter No / Size</label>
              <input
                type="text"
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value)}
                placeholder={selectedCategory === 'Shop' ? 'e.g. MTR-G001' : 'e.g. 2 meter'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Monthly Rent & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monthly Rent ({rentCurrency})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  placeholder={rentCurrency === 'USD' ? '600' : '100000'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
              {selectedCategory === 'Shop' ? (
                <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>USD ($)</span>
                  <span className="text-[10px] text-slate-500">Standard for Shops</span>
                </div>
              ) : (
                <select
                  value={rentCurrency}
                  onChange={(e) => setRentCurrency(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white"
                >
                  <option value="SSP">SSP (South Sudanese Pounds)</option>
                  <option value="USD">USD (US Dollars)</option>
                </select>
              )}
            </div>
          </div>

          {/* Tenant Information Section */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-bold text-slate-900">Tenant & Business Profile</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Tenant Name</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Khaalid Adam Abdale"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Phone Number</label>
                <input
                  type="tel"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  placeholder="e.g. +211 920 000 001"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Trade / Industry Category</label>
              <input
                type="text"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="e.g. General Merchandise, Electronics, Wholesale"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Lease Dates & Duration (Dynamic Calculation) */}
          <div className="p-4 bg-orange-50/50 border border-orange-200/70 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-bold text-orange-950">Lease Agreement & Dynamic Calculation</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Lease Start Date</label>
                <input
                  type="date"
                  value={leaseStart}
                  onChange={(e) => setLeaseStart(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Duration (Months)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={leaseDurationMonths}
                  onChange={(e) => setLeaseDurationMonths(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Auto-calculated results */}
            <div className="p-3 bg-white rounded-xl border border-orange-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Calculated Lease End Date</span>
                <span className="font-extrabold text-slate-900">{calculatedEnd}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Days Remaining</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                  calculatedDaysRemaining > 7 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : calculatedDaysRemaining > 0 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {calculatedDaysRemaining > 0 ? `${calculatedDaysRemaining} days remaining` : `Expired (${Math.abs(calculatedDaysRemaining)}d ago)`}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fitted with glass storefront and dedicated sub-meter."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : `Create ${selectedCategory}`}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
