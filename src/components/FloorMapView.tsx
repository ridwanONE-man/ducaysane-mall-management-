import React, { useState } from 'react';
import { X, Store, CheckCircle, Clock, AlertTriangle, Wrench, CreditCard } from 'lucide-react';
import { PropertyUnit } from '../types';

interface FloorMapViewProps {
  isOpen: boolean;
  onClose: () => void;
  units: PropertyUnit[];
  onSelectUnitForPayment: (unitId: string) => void;
}

export const FloorMapView: React.FC<FloorMapViewProps> = ({
  isOpen,
  onClose,
  units,
  onSelectUnitForPayment
}) => {
  const [activeFloor, setActiveFloor] = useState<'Ground Floor' | 'Floor 1' | 'Floor 2' | 'Floor 3'>('Ground Floor');
  const [selectedUnit, setSelectedUnit] = useState<PropertyUnit | null>(null);

  if (!isOpen) return null;

  const floorUnits = units.filter(u => u.floor === activeFloor);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              <span>Architectural Mall Floor Plan & Spatial Yield</span>
            </h3>
            <p className="text-xs text-slate-500">Live graphical layout of retail bays, corridors, and tenant tenancies.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Floor selector tabs */}
        <div className="px-6 pt-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {(['Ground Floor', 'Floor 1', 'Floor 2', 'Floor 3'] as const).map(fl => (
              <button
                key={fl}
                onClick={() => {
                  setActiveFloor(fl);
                  setSelectedUnit(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeFloor === fl
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {fl}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-blue-800">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Occupied
            </span>
            <span className="flex items-center gap-1.5 text-emerald-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
            </span>
            <span className="flex items-center gap-1.5 text-amber-800">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reserved
            </span>
            <span className="flex items-center gap-1.5 text-rose-800">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Maint.
            </span>
          </div>
        </div>

        {/* Floor Plan Grid */}
        <div className="p-6">
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl relative min-h-[300px]">
            <div className="absolute top-2 left-3 text-[10px] font-mono uppercase text-slate-400">
              {activeFloor} • Central Galleria & Main Concourse
            </div>

            {/* Architectural units display */}
            {floorUnits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <Store className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                <p className="font-semibold text-slate-700 text-xs">No Units Registered on {activeFloor}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">Units registered on this level will appear in this interactive floor layout.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {floorUnits.map(unit => {
                  const isSelected = selectedUnit?.id === unit.id;
                  let bgStyle = 'bg-white border-blue-200 text-slate-800 hover:border-blue-500';
                  if (unit.occupancyStatus === 'Available') {
                    bgStyle = 'bg-emerald-50/70 border-emerald-300 text-emerald-900 hover:border-emerald-600';
                  } else if (unit.occupancyStatus === 'Reserved') {
                    bgStyle = 'bg-amber-50/70 border-amber-300 text-amber-900 hover:border-amber-600';
                  } else if (unit.occupancyStatus === 'Maintenance') {
                    bgStyle = 'bg-rose-50/70 border-rose-300 text-rose-900 hover:border-rose-600';
                  }

                  return (
                    <button
                      key={unit.id}
                      onClick={() => setSelectedUnit(unit)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${bgStyle} ${
                        isSelected ? 'ring-2 ring-blue-600 shadow-md scale-[1.02]' : 'shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">{unit.codeBadge}</span>
                        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-black/5">{unit.sizeSqM}m²</span>
                      </div>
                      <p className="text-[11px] font-semibold truncate">
                        {unit.currentTenant ? unit.currentTenant.name : 'Vacant Bay'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{unit.subType}</p>
                      <div className="mt-2 text-[10px] font-bold">
                        ${unit.monthlyRateUSD.toLocaleString()} / mo
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Central Atrium Corridor Display */}
            <div className="my-4 py-2 bg-slate-200/70 rounded-xl text-center text-[11px] font-bold text-slate-500 tracking-wider uppercase border border-dashed border-slate-300">
              Escalators • Central Atrium Corridor & Skylight • Elevators
            </div>
          </div>

          {/* Selected Unit Details Panel */}
          {selectedUnit && (
            <div className="mt-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
              <div className="text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <span>{selectedUnit.unitNumber}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    {selectedUnit.occupancyStatus}
                  </span>
                  <span className="text-slate-500 text-xs font-normal">Meter: {selectedUnit.meterNumber}</span>
                </div>
                <p className="text-slate-600 mt-0.5">
                  Tenant: <strong>{selectedUnit.currentTenant ? selectedUnit.currentTenant.name : 'None (Vacant)'}</strong> • Rate: <strong>${selectedUnit.monthlyRateUSD.toLocaleString()} USD / {selectedUnit.monthlyRateSSP.toLocaleString()} SSP</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedUnit.currentTenant && (
                  <button
                    onClick={() => {
                      onClose();
                      onSelectUnitForPayment(selectedUnit.id);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedUnit(null)}
                  className="px-3 py-2 bg-white text-slate-600 hover:text-slate-800 rounded-xl text-xs font-medium border border-slate-200 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <span>Total Gross Floor Area: 18,458 sq.m • Commercial Leasable Core</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close Map
          </button>
        </div>

      </div>
    </div>
  );
};
