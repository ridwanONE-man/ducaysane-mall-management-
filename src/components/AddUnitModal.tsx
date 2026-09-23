import React, { useState, useEffect } from 'react';
import { X, Store, Check, UserCheck } from 'lucide-react';
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

  const [unitNumber, setUnitNumber] = useState('');
  const [floor, setFloor] = useState<'Ground Floor' | 'Floor 1' | 'Floor 2' | 'Floor 3'>('Ground Floor');
  const [type, setType] = useState<UnitType>('Standard Shop');
  const [subType, setSubType] = useState('');
  const [sizeSqM, setSizeSqM] = useState<string>('');
  const [meterNumber, setMeterNumber] = useState('');
  const [rateUSD, setRateUSD] = useState<string>('');
  const [status, setStatus] = useState<OccupancyStatus>('Available');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantTrade, setTenantTrade] = useState('');
  const [notes, setNotes] = useState('');

  // Sync state when editingUnit changes or modal opens
  useEffect(() => {
    if (editingUnit) {
      setUnitNumber(editingUnit.unitNumber || '');
      setFloor(editingUnit.floor || 'Ground Floor');
      setType(editingUnit.type || 'Standard Shop');
      setSubType(editingUnit.subType || '');
      setSizeSqM(editingUnit.sizeSqM ? String(editingUnit.sizeSqM) : '45');
      setMeterNumber(editingUnit.meterNumber || '');
      setRateUSD(editingUnit.monthlyRateUSD ? String(editingUnit.monthlyRateUSD) : '1200');
      setStatus(editingUnit.occupancyStatus || 'Available');
      setTenantName(editingUnit.currentTenant?.name || '');
      setTenantPhone(editingUnit.currentTenant?.phone || '');
      setTenantTrade(editingUnit.currentTenant?.trade || '');
      setNotes(editingUnit.notes || '');
    } else {
      setUnitNumber('');
      setFloor('Ground Floor');
      setType('Standard Shop');
      setSubType('');
      setSizeSqM('');
      setMeterNumber('');
      setRateUSD('');
      setStatus('Available');
      setTenantName('');
      setTenantPhone('');
      setTenantTrade('');
      setNotes('');
    }
  }, [editingUnit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUnitNumber = unitNumber.trim() || `Unit G-${Math.floor(100 + Math.random() * 900)}`;
    const codeBadge = cleanUnitNumber.replace('Unit ', '');
    const numSize = parseFloat(sizeSqM) || 45;
    const numRate = parseFloat(rateUSD) || 1200;

    const hasTenant = Boolean(tenantName.trim().length > 0 || status === 'Occupied');
    const assignedTenant = hasTenant ? {
      id: editingUnit?.currentTenant?.id || `t-${Date.now()}`,
      name: tenantName.trim() || 'Commercial Tenant',
      trade: tenantTrade.trim() || 'Retail Space',
      code: editingUnit?.currentTenant?.code || `TNT-${cleanUnitNumber.replace(/\D/g, '') || '101'}`,
      phone: tenantPhone.trim() || '+211 92 000 0000',
      email: editingUnit?.currentTenant?.email || 'tenant@ducaysanemall.com',
      unitNumber: cleanUnitNumber,
      balanceUSD: editingUnit?.arrearsUSD || 0,
      balanceSSP: editingUnit?.arrearsSSP || 0,
      balanceStatus: (editingUnit?.arrearsUSD || 0) > 0 ? ('Overdue' as const) : ('Current' as const),
      status: 'Active' as const,
      leaseEnd: editingUnit?.leaseEnd || 'Dec 31, 2025',
    } : undefined;

    const finalUnit: PropertyUnit = {
      id: editingUnit ? editingUnit.id : `u-${Date.now()}`,
      unitNumber: cleanUnitNumber,
      codeBadge,
      floor,
      type,
      subType: subType.trim() || 'Retail Space',
      sizeSqM: numSize,
      sizeSqFt: Math.round(numSize * 10.7639 * 10) / 10,
      meterNumber: meterNumber.trim() || `MTR-${Math.floor(1000 + Math.random() * 9000)}`,
      monthlyRateUSD: numRate,
      monthlyRateSSP: Math.round(numRate * 1300),
      escrowDepositUSD: numRate * 2,
      escrowDepositSSP: Math.round(numRate * 2 * 1300),
      occupancyStatus: hasTenant ? 'Occupied' : status,
      billingStatus: hasTenant ? (editingUnit?.billingStatus || 'Paid') : 'No Balance',
      billingMonthText: editingUnit?.billingMonthText || (hasTenant ? 'Paid • Oct 2024' : undefined),
      arrearsUSD: editingUnit?.arrearsUSD || 0,
      arrearsSSP: editingUnit?.arrearsSSP || 0,
      currentTenant: assignedTenant,
      leaseStart: editingUnit?.leaseStart || (hasTenant ? 'Jan 01, 2024' : undefined),
      leaseEnd: editingUnit?.leaseEnd || (hasTenant ? 'Dec 31, 2025' : undefined),
      footfallBadge: editingUnit?.footfallBadge || (numRate >= 2000 ? 'High Footfall' : undefined),
      notes: notes.trim() || undefined,
    };

    onSaveUnit(finalUnit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditing ? `Edit Commercial Unit: ${editingUnit?.unitNumber}` : 'Register New Commercial Space'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update specifications, rental terms, and tenant occupancy.' : 'Add shop, kiosk, or atrium space to inventory.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Number</label>
              <input
                type="text"
                required
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. Unit G-015"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Level</label>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value="Ground Floor">Ground Floor</option>
                <option value="Floor 1">Floor 1</option>
                <option value="Floor 2">Floor 2</option>
                <option value="Floor 3">Floor 3</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Space Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value="Standard Shop">Standard Shop</option>
                <option value="Corner Unit">Corner Unit</option>
                <option value="Open Atrium Space">Open Atrium Space</option>
                <option value="Kiosk">Kiosk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sub-Category / Specs</label>
              <input
                type="text"
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                placeholder="e.g. Retail A, Electronics"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gross Area (sq.m)</label>
              <input
                type="number"
                step="any"
                required
                value={sizeSqM}
                onChange={(e) => setSizeSqM(e.target.value)}
                placeholder="e.g. 48"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Electric Meter #</label>
              <input
                type="text"
                required
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value)}
                placeholder="e.g. MTR-8821"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Rent (USD)</label>
              <input
                type="number"
                step="any"
                required
                value={rateUSD}
                onChange={(e) => setRateUSD(e.target.value)}
                placeholder="e.g. 1200"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Occupancy Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value="Available">Available (Ready for Lease)</option>
                <option value="Occupied">Occupied</option>
                <option value="Reserved">Reserved (Under LOI)</option>
                <option value="Maintenance">Maintenance (Offline)</option>
              </select>
            </div>
          </div>

          {/* Tenant Assignment Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">Tenant Information (Optional)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Tenant Name / Business</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Somlink Telecom"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Phone Number</label>
                <input
                  type="text"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  placeholder="e.g. +211 92 111 2233"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Trade / Industry Category</label>
              <input
                type="text"
                value={tenantTrade}
                onChange={(e) => setTenantTrade(e.target.value)}
                placeholder="e.g. Telecommunications & FinTech"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fitted with glass storefront and dedicated sub-meter."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Create Unit'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
