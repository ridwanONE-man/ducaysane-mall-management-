import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  DoorOpen, 
  Clock, 
  Wrench, 
  Download, 
  Map, 
  Plus, 
  Filter, 
  CreditCard, 
  Check, 
  Store,
  ChevronDown,
  X,
  UserPlus,
  Edit2,
  Trash2
} from 'lucide-react';
import { PropertyUnit, CurrencyMode, OccupancyStatus } from '../types';
import { exportUnitsToCSV } from '../utils/exportUtils';

interface UnitsViewProps {
  units: PropertyUnit[];
  currencyMode: CurrencyMode;
  onCurrencyChange: (mode: CurrencyMode) => void;
  onOpenRecordPaymentWithUnit: (unitId: string) => void;
  onOpenAddUnit: () => void;
  onOpenFloorMap: () => void;
  onEditUnit?: (unit: PropertyUnit) => void;
  onDeleteUnit?: (unitId: string) => void;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  units,
  currencyMode,
  onCurrencyChange,
  onOpenRecordPaymentWithUnit,
  onOpenAddUnit,
  onOpenFloorMap,
  onEditUnit,
  onDeleteUnit
}) => {
  // Category tabs: All, Shops (G), Spaces (BW), Available
  const [activeCategoryTab, setActiveCategoryTab] = useState<'All' | 'Shops' | 'Spaces' | 'Available'>('All');

  // Dynamic inventory calculations
  const totalInventoryCount = units.length;
  const occupiedCount = units.filter(u => u.occupancyStatus === 'Occupied').length;
  const availableCount = units.filter(u => u.occupancyStatus === 'Available').length;
  const reservedCount = units.filter(u => u.occupancyStatus === 'Reserved').length;
  const maintenanceCount = units.filter(u => u.occupancyStatus === 'Maintenance').length;
  const shopsCount = units.filter(u => u.type === 'Shop' || u.categoryType === 'Shop' || u.unitNumber.startsWith('G')).length;
  const spacesCount = units.filter(u => u.type === 'Space' || u.categoryType === 'Space' || u.unitNumber.startsWith('BW')).length;
  const occupancyPct = totalInventoryCount > 0 ? Math.round((occupiedCount / totalInventoryCount) * 1000) / 10 : 0;
  const vacancyPct = totalInventoryCount > 0 ? Math.round((availableCount / totalInventoryCount) * 1000) / 10 : 0;
  const totalSqM = units.reduce((sum, u) => sum + (u.sizeSqM || 0), 0);
  const availableSqM = units.filter(u => u.occupancyStatus === 'Available').reduce((sum, u) => sum + (u.sizeSqM || 0), 0);

  // Filter dropdowns
  const [floorFilter, setFloorFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [occupancyFilter, setOccupancyFilter] = useState('All');
  const [leaseFilter, setLeaseFilter] = useState('All');

  // Quick filter tags
  const [quickGroundFloor, setQuickGroundFloor] = useState(false);
  const [quickExpiring30, setQuickExpiring30] = useState(false);
  const [quickHighArrears, setQuickHighArrears] = useState(false);
  const [quickAnchor, setQuickAnchor] = useState(false);

  // Selected row checkboxes
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Filter application
  const filteredUnits = units.filter(unit => {
    const isShop = unit.type === 'Shop' || unit.categoryType === 'Shop' || unit.unitNumber.startsWith('G');
    const isSpace = unit.type === 'Space' || unit.categoryType === 'Space' || unit.unitNumber.startsWith('BW');

    // Category tab filter
    if (activeCategoryTab === 'Shops' && !isShop) return false;
    if (activeCategoryTab === 'Spaces' && !isSpace) return false;
    if (activeCategoryTab === 'Available' && unit.occupancyStatus !== 'Available') return false;

    // Dropdown filters
    if (floorFilter !== 'All' && unit.floor !== floorFilter) return false;
    if (typeFilter !== 'All' && unit.type !== typeFilter) return false;
    if (occupancyFilter !== 'All' && unit.occupancyStatus !== occupancyFilter) return false;
    if (leaseFilter === 'Active' && !unit.currentTenant) return false;
    if (leaseFilter === 'Vacant' && unit.currentTenant) return false;
    if (leaseFilter === 'Expiring' && (!unit.daysToExpiry || unit.daysToExpiry > 60)) return false;

    // Quick filters
    if (quickGroundFloor && unit.floor !== 'Ground Floor') return false;
    if (quickExpiring30 && (!unit.daysToExpiry || unit.daysToExpiry > 30)) return false;
    if (quickHighArrears && unit.arrearsUSD === 0 && unit.arrearsSSP === 0) return false;
    if (quickAnchor && unit.footfallBadge !== 'Anchor Tenant') return false;

    return true;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUnitIds(filteredUnits.map(u => u.id));
    } else {
      setSelectedUnitIds([]);
    }
  };

  const handleToggleRow = (id: string) => {
    if (selectedUnitIds.includes(id)) {
      setSelectedUnitIds(selectedUnitIds.filter(i => i !== id));
    } else {
      setSelectedUnitIds([...selectedUnitIds, id]);
    }
  };

  const handleResetFilters = () => {
    setActiveCategoryTab('All');
    setFloorFilter('All');
    setTypeFilter('All');
    setOccupancyFilter('All');
    setLeaseFilter('All');
    setQuickGroundFloor(false);
    setQuickExpiring30(false);
    setQuickHighArrears(false);
    setQuickAnchor(false);
  };

  const handleExport = () => {
    exportUnitsToCSV(filteredUnits);
  };

  return (
    <div id="units-management-container" className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header Section - Clean & Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Properties & Units
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Storefronts, kiosks, and tenant occupancy directory
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={onOpenFloorMap}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Map className="w-3.5 h-3.5 text-blue-600" />
            <span>Floor Map</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddUnit}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Unit</span>
          </button>
        </div>
      </div>

      {/* Unified Minimalist Metric Strip (Replaces 5 separate bulky cards) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3 sm:gap-y-0">
        
        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Total Units</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">{totalInventoryCount}</span>
            <span className="text-[11px] text-slate-400 font-normal">{shopsCount} shops · {spacesCount} spaces</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Occupied</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full">
              {occupancyPct}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-emerald-600">{occupiedCount}</span>
            <span className="text-[11px] text-slate-400 font-normal">Active leases</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Available</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">{availableCount}</span>
            <span className="text-[11px] text-slate-400 font-normal">{vacancyPct}% vacancy</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-1">
          <span className="text-xs font-medium text-slate-500 block">Hold & Maint</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-slate-900">{reservedCount + maintenanceCount}</span>
            <span className="text-[11px] text-slate-400 font-normal">{reservedCount} hold · {maintenanceCount} maint</span>
          </div>
        </div>

      </div>

      {/* Filter Toolbar - Clean, Single Tier (Replaces large layered box) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Category Tabs */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
            {(['All', 'Shops', 'Spaces', 'Available'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveCategoryTab(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeCategoryTab === tab 
                    ? 'bg-white text-orange-600 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'All' ? `All (${totalInventoryCount})` : tab === 'Shops' ? `Shops (${shopsCount})` : tab === 'Spaces' ? `Spaces (${spacesCount})` : `Available (${availableCount})`}
              </button>
            ))}
          </div>

          {/* Quick Select Filters */}
          <div className="flex items-center gap-2 text-xs">
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600"
            >
              <option value="All">All Floors</option>
              <option value="Ground Floor">Ground Floor</option>
              <option value="Floor 1">Floor 1</option>
              <option value="Floor 2">Floor 2</option>
              <option value="Floor 3">Floor 3</option>
            </select>

            <select
              value={occupancyFilter}
              onChange={(e) => setOccupancyFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600"
            >
              <option value="All">All Statuses</option>
              <option value="Occupied">Occupied</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Maintenance">Maintenance</option>
            </select>

            {(floorFilter !== 'All' || occupancyFilter !== 'All' || activeCategoryTab !== 'All') && (
              <button
                onClick={handleResetFilters}
                className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

        </div>

        {/* Quick Filter Tag Chips - Minimal & Refined */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Filter:</span>

            <button
              onClick={() => setQuickGroundFloor(!quickGroundFloor)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                quickGroundFloor
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Ground Floor
            </button>

            <button
              onClick={() => setQuickExpiring30(!quickExpiring30)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                quickExpiring30
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Expiring Soon
            </button>

            <button
              onClick={() => setQuickHighArrears(!quickHighArrears)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                quickHighArrears
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Arrears (&gt;60d)
            </button>

            <button
              onClick={() => setQuickAnchor(!quickAnchor)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                quickAnchor
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Anchor Tenants
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            <span className="font-semibold text-slate-800">{filteredUnits.length}</span> units
          </div>
        </div>

      </div>

      {/* Main Units Table (Exact Match to Image 2) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/90 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedUnitIds.length > 0 && selectedUnitIds.length === filteredUnits.length}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="p-4">Unit & Specs</th>
                <th className="p-4">Floor & Size / Meter</th>
                <th className="p-4">Current Tenant & Trade</th>
                <th className="p-4">Monthly Rate / Escrow</th>
                <th className="p-4">Lease Term & Maturity</th>
                <th className="p-4">Billing Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                        <Store className="w-6 h-6 text-slate-400 stroke-[1.5]" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No Commercial Units Registered</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Register your first commercial shop, kiosk, or space to start managing inventory.</p>
                      <button
                        type="button"
                        onClick={onOpenAddUnit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register First Unit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => {
                const isSelected = selectedUnitIds.includes(unit.id);

                return (
                  <tr 
                    key={unit.id}
                    className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(unit.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                    </td>

                    {/* Unit & Specs */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-blue-800 font-bold flex flex-col items-center justify-center text-[10px] leading-tight shrink-0 border border-blue-200/80">
                          <span>{unit.codeBadge.split(' ')[0]}</span>
                          <span className="font-extrabold">{unit.codeBadge.split(' ')[1] || ''}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">{unit.unitNumber}</span>
                            {unit.footfallBadge && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {unit.footfallBadge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {unit.type} • {unit.subType}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Floor & Size / Meter */}
                    <td className="p-4">
                      <p className="font-semibold text-slate-800">{unit.floor}</p>
                      <p className="text-slate-600 text-[11px]">
                        {unit.sizeSqM} m² <span className="text-slate-400 font-mono">({unit.sizeSqFt} sq.ft)</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ⚙ {unit.meterNumber}
                      </p>
                    </td>

                    {/* Current Tenant & Trade */}
                    <td className="p-4">
                      {unit.currentTenant ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {unit.currentTenant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="truncate max-w-[180px]">
                            <p className="font-bold text-slate-900 truncate">{unit.currentTenant.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{unit.currentTenant.trade}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {unit.currentTenant.code}</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-slate-400 italic">No Active Tenant</p>
                          <button
                            onClick={() => onOpenAddUnit()}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-0.5 cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>+ Assign Tenant Now</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Monthly Rate / Escrow */}
                    <td className="p-4">
                      <p className="font-bold text-slate-900 text-sm">
                        ${unit.monthlyRateUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">USD</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        equiv. {unit.monthlyRateSSP.toLocaleString('en-US')} SSP/mo
                      </p>
                      <p className="text-[10px] text-blue-700 font-medium mt-0.5">
                        Deposit: ${unit.escrowDepositUSD.toLocaleString()} held
                      </p>
                    </td>

                    {/* Lease Term & Maturity */}
                    <td className="p-4">
                      {unit.currentTenant ? (
                        <div>
                          <p className="text-[11px] font-medium text-slate-700">
                            {unit.leaseStart} - {unit.leaseEnd}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {unit.leaseTermMonths} Mo Term
                            </span>
                            {unit.daysToExpiry && unit.daysToExpiry <= 30 ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                Exp in {unit.daysToExpiry} days
                              </span>
                            ) : unit.daysToExpiry ? (
                              <span className="text-[10px] font-medium text-slate-500">
                                Exp in {unit.daysToExpiry} days
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-emerald-600">Active</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Ready for Immediate Lease
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1">Standard 1-3 Year Contract</p>
                        </div>
                      )}
                    </td>

                    {/* Billing Status */}
                    <td className="p-4">
                      {unit.billingStatus === 'Paid' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          <Check className="w-3 h-3" />
                          <span>{unit.billingMonthText || 'Paid • Oct 2024'}</span>
                        </span>
                      ) : unit.billingStatus === 'Partially Paid' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                          <span>{unit.billingMonthText || 'Partially Paid'}</span>
                        </span>
                      ) : unit.billingStatus === 'Overdue' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                          <span>{unit.billingMonthText || 'Overdue'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                          <span>No Balance</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {unit.currentTenant && (
                          <button
                            type="button"
                            onClick={() => onOpenRecordPaymentWithUnit(unit.id)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                            title="Record rent payment"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditUnit ? onEditUnit(unit) : onOpenAddUnit()}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit unit details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteUnit && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete ${unit.unitNumber}? This change will sync instantly to all users.`)) {
                                onDeleteUnit(unit.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete unit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Selected {selectedUnitIds.length} of {filteredUnits.length} total units
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={selectedUnitIds.length === 0}
              onClick={handleExport}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium disabled:opacity-50 cursor-pointer"
            >
              Export Selected
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
