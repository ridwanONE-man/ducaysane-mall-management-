import React, { useState } from 'react';
import { X, Store, Check } from 'lucide-react';
import { PropertyUnit, UnitType, OccupancyStatus } from '../types';

interface AddUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUnit: (unit: PropertyUnit) => void;
}

export const AddUnitModal: React.FC<AddUnitModalProps> = ({
  isOpen,
  onClose,
  onAddUnit
}) => {
  const [unitNumber, setUnitNumber] = useState('');
  const [floor, setFloor] = useState<'Ground Floor' | 'Floor 1' | 'Floor 2' | 'Floor 3'>('Ground Floor');
  const [type, setType] = useState<UnitType>('Standard Shop');
  const [subType, setSubType] = useState('');
  const [sizeSqM, setSizeSqM] = useState<string>('');
  const [meterNumber, setMeterNumber] = useState('');
  const [rateUSD, setRateUSD] = useState<string>('');
  const [status, setStatus] = useState<OccupancyStatus>('Available');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUnitNumber = unitNumber.trim() || `Unit G-${Math.floor(100 + Math.random() * 900)}`;
    const codeBadge = cleanUnitNumber.replace('Unit ', '');
    const numSize = parseFloat(sizeSqM) || 45;
    const numRate = parseFloat(rateUSD) || 1200;

    const newUnit: PropertyUnit = {
      id: `u-${Date.now()}`,
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
      occupancyStatus: status,
      billingStatus: status === 'Occupied' ? 'Paid' : 'No Balance',
      arrearsUSD: 0,
      arrearsSSP: 0
    };

    onAddUnit(newUnit);
    onClose();
    // Reset state
    setUnitNumber('');
    setSubType('');
    setSizeSqM('');
    setMeterNumber('');
    setRateUSD('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Register New Commercial Space</h3>
              <p className="text-xs text-slate-500">Add shop, kiosk, or atrium lot to Juba Central Mall inventory.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dedicated Electric Meter #</label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Rent (USD / mo)</label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Create Unit</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
