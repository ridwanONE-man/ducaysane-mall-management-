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
  Check,
  Store,
  X,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  LayoutGrid,
  AlertTriangle,
  Phone,
  List,
  Layers,
  Ruler,
  Gauge,
  Star,
} from 'lucide-react';
import { PropertyUnit, CurrencyMode } from '../types';
import { exportUnitsToCSV } from '../utils/exportUtils';
import { DeleteButton, ClearAllButton } from './DeleteControls';
import { useConfirm } from './ConfirmDialog';
import { formatUnitRent } from '../utils/currency';
import { parsePaymentDate, formatLongDate } from '../utils/printUtils';

// Colour per occupancy status: top bar, pill and dot
const STATUS_STYLE: Record<string, { bar: string; pill: string; dot: string }> = {
  Occupied: { bar: 'bg-gradient-to-r from-orange-500 to-amber-400', pill: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  Available: { bar: 'bg-gradient-to-r from-emerald-500 to-teal-400', pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Reserved: { bar: 'bg-gradient-to-r from-sky-500 to-blue-400', pill: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  Maintenance: { bar: 'bg-gradient-to-r from-slate-500 to-slate-400', pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
};

// Days until the lease ends, from the saved end date (null when there is none)
const daysLeftOf = (unit: PropertyUnit): number | null => {
  const end = parsePaymentDate(unit.leaseEnd || unit.currentTenant?.leaseEnd);
  if (!end) return null;
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
};

interface UnitsViewProps {
  units: PropertyUnit[];
  currencyMode: CurrencyMode;
  onCurrencyChange: (mode: CurrencyMode) => void;
  onOpenRecordPaymentWithUnit?: (unitId: string) => void;
  onOpenAddUnit: () => void;
  onOpenFloorMap: () => void;
  onEditUnit?: (unit: PropertyUnit) => void;
  onDeleteUnit?: (unitId: string) => void;
  onAssignTenant?: (unit: PropertyUnit) => void;
  onDeleteTenant?: (unitId: string) => void;
  onDeleteAllUnits?: () => void;
  onDeleteSelectedUnits?: (unitIds: string[]) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  units,
  currencyMode,
  onCurrencyChange,
  onOpenRecordPaymentWithUnit,
  onOpenAddUnit,
  onOpenFloorMap,
  onEditUnit,
  onDeleteUnit,
  onAssignTenant,
  onDeleteTenant,
  onDeleteAllUnits,
  onDeleteSelectedUnits,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange
}) => {
  // Search query state (support controlled from App/Header and local state)
  const confirm = useConfirm();
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const search = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;

  const handleSearchChange = (value: string) => {
    if (externalOnSearchChange) {
      externalOnSearchChange(value);
    }
    setInternalSearchQuery(value);
    if (value.trim().length > 0 && activeCategoryTab !== 'All') {
      setActiveCategoryTab('All');
    }
  };

  // Helper for normalized search without spaces, dashes, slashes
  const cleanStr = (val?: string) => (val || '').toLowerCase().replace(/[\s\-_/]/g, '');

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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filter application
  const filteredUnits = units.filter(unit => {
    // Search query filter (matches unit number, badge, tenant name/trade/code/phone, meter, type, subType, floor, notes, footfall)
    const q = search.trim().toLowerCase();
    if (q) {
      const cleanQ = cleanStr(q);
      const matchUnitNumber = unit.unitNumber?.toLowerCase().includes(q) || cleanStr(unit.unitNumber).includes(cleanQ);
      const matchBadge = unit.codeBadge?.toLowerCase().includes(q) || cleanStr(unit.codeBadge).includes(cleanQ);
      const matchTenantName = unit.currentTenant?.name?.toLowerCase().includes(q);
      const matchTenantTrade = unit.currentTenant?.trade?.toLowerCase().includes(q);
      const matchTenantCode = unit.currentTenant?.code?.toLowerCase().includes(q) || cleanStr(unit.currentTenant?.code).includes(cleanQ);
      const matchTenantPhone = unit.currentTenant?.phone?.toLowerCase().includes(q) || cleanStr(unit.currentTenant?.phone).includes(cleanQ);
      const matchMeter = unit.meterNumber?.toLowerCase().includes(q) || cleanStr(unit.meterNumber).includes(cleanQ);
      const matchType = unit.type?.toLowerCase().includes(q);
      const matchSubType = unit.subType?.toLowerCase().includes(q);
      const matchFloor = unit.floor?.toLowerCase().includes(q);
      const matchStatus = unit.occupancyStatus?.toLowerCase().includes(q);
      const matchBilling = unit.billingStatus?.toLowerCase().includes(q);
      const matchBadgeFootfall = unit.footfallBadge?.toLowerCase().includes(q);
      const matchNotes = unit.notes?.toLowerCase().includes(q);

      const matchesSearch = Boolean(
        matchUnitNumber ||
        matchBadge ||
        matchTenantName ||
        matchTenantTrade ||
        matchTenantCode ||
        matchTenantPhone ||
        matchMeter ||
        matchType ||
        matchSubType ||
        matchFloor ||
        matchStatus ||
        matchBilling ||
        matchBadgeFootfall ||
        matchNotes
      );

      if (!matchesSearch) return false;
    }

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
    if (quickExpiring30) {
      const days = unit.currentTenant ? daysLeftOf(unit) : null;
      if (days === null || days < 0 || days > 30) return false;
    }
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
    handleSearchChange('');
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

  const hasFilters = Boolean(search.trim()) || floorFilter !== 'All' || occupancyFilter !== 'All' || activeCategoryTab !== 'All'
    || quickGroundFloor || quickExpiring30 || quickHighArrears || quickAnchor;

  const isShopUnit = (u: PropertyUnit) => u.type === 'Shop' || u.categoryType === 'Shop' || u.unitNumber.startsWith('G');
  const occupiedOf = (list: PropertyUnit[]) => list.filter(u => u.occupancyStatus === 'Occupied').length;
  const shopUnits = units.filter(isShopUnit);
  const spaceUnits = units.filter(u => !isShopUnit(u));
  const categoryTiles = [
    { tab: 'All' as const, soft: 'bg-slate-50 border-slate-200', ink: 'text-slate-900', ring: 'bg-slate-200/60',  label: 'All units', count: totalInventoryCount, total: totalInventoryCount, occupied: occupiedCount, sub: `${occupiedCount} occupied • ${occupancyPct}% full`, icon: Building2, tone: 'from-slate-700 to-slate-900' },
    { tab: 'Shops' as const, soft: 'bg-orange-50 border-orange-200', ink: 'text-orange-600', ring: 'bg-orange-200/50',  label: 'Shops', count: shopsCount, total: shopUnits.length, occupied: occupiedOf(shopUnits), sub: `${occupiedOf(shopUnits)} occupied • ${shopUnits.length - occupiedOf(shopUnits)} free`, icon: Store, tone: 'from-orange-500 to-amber-500' },
    { tab: 'Spaces' as const, soft: 'bg-sky-50 border-sky-200', ink: 'text-sky-600', ring: 'bg-sky-200/50',  label: 'Spaces', count: spacesCount, total: spaceUnits.length, occupied: occupiedOf(spaceUnits), sub: `${occupiedOf(spaceUnits)} occupied • ${spaceUnits.length - occupiedOf(spaceUnits)} free`, icon: LayoutGrid, tone: 'from-sky-500 to-blue-500' },
    { tab: 'Available' as const, soft: 'bg-emerald-50 border-emerald-200', ink: 'text-emerald-600', ring: 'bg-emerald-200/50',  label: 'Available', count: availableCount, total: availableCount, occupied: 0, sub: `${vacancyPct}% of all units are vacant`, icon: DoorOpen, tone: 'from-emerald-500 to-teal-500' },
  ];

  const expiringSoon = units.filter(u => {
    const d = u.currentTenant ? daysLeftOf(u) : null;
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const expiredLeases = units.filter(u => {
    const d = u.currentTenant ? daysLeftOf(u) : null;
    return d !== null && d < 0;
  }).length;
  const withArrears = units.filter(u => (u.arrearsUSD || 0) > 0 || (u.arrearsSSP || 0) > 0).length;
  const insights: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: string; card: string; on?: boolean; onClick?: () => void }[] = [
    { label: 'Total floor area', value: `${Math.round(totalSqM).toLocaleString()} m²`, icon: Ruler, tone: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white', card: 'bg-slate-50 border-slate-200' },
    { label: 'Leases ending ≤ 30 days', value: String(expiringSoon), icon: Clock, tone: 'bg-gradient-to-br from-amber-500 to-yellow-500 text-white', card: 'bg-amber-50 border-amber-200', on: quickExpiring30, onClick: () => setQuickExpiring30(v => !v) },
    { label: expiredLeases ? `With arrears • ${expiredLeases} lease(s) expired` : 'Units with arrears', value: String(withArrears), icon: AlertTriangle, tone: 'bg-gradient-to-br from-rose-500 to-orange-500 text-white', card: 'bg-rose-50 border-rose-200', on: quickHighArrears, onClick: () => setQuickHighArrears(v => !v) },
    { label: 'On hold / maintenance', value: String(reservedCount + maintenanceCount), icon: Wrench, tone: 'bg-gradient-to-br from-sky-500 to-blue-500 text-white', card: 'bg-sky-50 border-sky-200', on: occupancyFilter === 'Maintenance', onClick: () => setOccupancyFilter(f => (f === 'Maintenance' ? 'All' : 'Maintenance')) },
  ];


  const selectCls = 'px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 cursor-pointer';

  const billingChip = (unit: PropertyUnit) => {
    if (!unit.currentTenant) return null;
    const map: Record<string, string> = {
      Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
      Overdue: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    const cls = map[unit.billingStatus] || 'bg-slate-50 text-slate-600 border-slate-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cls}`}>
        {unit.billingStatus === 'Paid' && <Check className="w-3 h-3" />}
        {unit.billingStatus === 'Paid' || unit.billingStatus === 'Partially Paid' || unit.billingStatus === 'Overdue' ? unit.billingStatus : 'No balance'}
      </span>
    );
  };

  const leaseInfo = (unit: PropertyUnit) => {
    const start = parsePaymentDate(unit.leaseStart || unit.currentTenant?.leaseStart);
    const end = parsePaymentDate(unit.leaseEnd || unit.currentTenant?.leaseEnd);
    if (!end) return null;
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);
    const pct = start && end > start
      ? Math.min(100, Math.max(0, ((today.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100))
      : 0;
    return { start, end, days, pct };
  };

  return (
    <div id="units-management-container" className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="absolute right-32 -bottom-20 w-40 h-40 rounded-full bg-amber-100/40" />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Properties & Units</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Shops, spaces and who leases them — all in one place.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onDeleteAllUnits && (
              <ClearAllButton
                count={units.length}
                itemLabel="units"
                onClear={onDeleteAllUnits}
                message="All units and properties are deleted, together with their connected tenants, for every user. This cannot be undone."
              />
            )}
            <button
              type="button"
              onClick={handleExport}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export
            </button>
            <button
              type="button"
              onClick={onOpenFloorMap}
              className="px-3.5 py-2 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-200 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Map className="w-3.5 h-3.5 text-orange-500" /> Floor Map
            </button>
            <button
              type="button"
              onClick={onOpenAddUnit}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-extrabold shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Unit
            </button>
          </div>
        </div>
      </div>

      {/* Category tiles: tap to filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {categoryTiles.map(t => {
          const active = activeCategoryTab === t.tab;
          const pct = t.total > 0 ? Math.round((t.occupied / t.total) * 100) : 0;
          return (
            <button
              key={t.tab}
              type="button"
              onClick={() => setActiveCategoryTab(t.tab)}
              className={`group relative overflow-hidden text-left rounded-3xl p-5 border transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
                active
                  ? `bg-gradient-to-br ${t.tone} text-white border-transparent shadow-lg`
                  : `${t.soft} hover:shadow-md`
              }`}
            >
              <div className={`absolute -right-8 -bottom-10 w-32 h-32 rounded-full ${active ? 'bg-white/15' : t.ring}`} />
              <div className={`absolute right-14 -top-8 w-16 h-16 rounded-full ${active ? 'bg-white/10' : t.ring} opacity-60`} />
              <div className="relative flex items-center justify-between">
                <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${active ? 'bg-white/20' : `bg-gradient-to-br ${t.tone} text-white shadow-md`}`}>
                  <t.icon className="w-5 h-5" />
                </span>
                <span className={`text-4xl font-black leading-none ${active ? 'text-white' : t.ink}`}>{t.count}</span>
              </div>
              <p className={`relative mt-3 text-sm font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>{t.label}</p>
              <p className={`relative text-[11px] ${active ? 'text-white/80' : 'text-slate-500'}`}>{t.sub}</p>
              {t.tab !== 'Available' && (
                <div className={`relative mt-3 h-1.5 rounded-full overflow-hidden ${active ? 'bg-white/20' : 'bg-white'}`}>
                  <div className={`h-full rounded-full ${active ? 'bg-white' : `bg-gradient-to-r ${t.tone}`}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              {t.tab === 'Available' && (
                <p className={`relative mt-2.5 text-[10px] font-bold ${active ? 'text-white' : 'text-emerald-600'}`}>
                  {Math.round(availableSqM).toLocaleString()} m² ready to lease
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Property insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {insights.map(i => (
          <button
            key={i.label}
            type="button"
            onClick={i.onClick}
            disabled={!i.onClick}
            className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 ${i.card} ${
              i.on ? 'ring-2 ring-orange-400 shadow-md' : ''
            } ${i.onClick ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : 'cursor-default'}`}
          >
            <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${i.tone}`}>
              <i.icon className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-black text-slate-900 leading-tight">{i.value}</span>
              <span className="block text-[11px] font-semibold text-slate-500 truncate">{i.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search unit, tenant, phone, meter..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-200/50"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className={selectCls}>
              <option value="All">All floors</option>
              <option value="Ground Floor">Ground Floor</option>
              <option value="Floor 1">Floor 1</option>
              <option value="Floor 2">Floor 2</option>
              <option value="Floor 3">Floor 3</option>
            </select>
            <select value={occupancyFilter} onChange={(e) => setOccupancyFilter(e.target.value)} className={selectCls}>
              <option value="All">All statuses</option>
              <option value="Occupied">Occupied</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl">
              {([['cards', LayoutGrid, 'Cards'], ['table', List, 'Table']] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewMode(v)}
                  title={`${label} view`}
                  className={`p-2 rounded-lg cursor-pointer transition-all ${viewMode === v ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {hasFilters && (
              <button type="button" onClick={handleResetFilters} className="px-2.5 py-1.5 text-[11px] font-bold text-orange-600 hover:text-orange-800 cursor-pointer">
                Reset all
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500">
            Showing <strong className="text-slate-900">{filteredUnits.length}</strong>{hasFilters ? ` of ${units.length}` : ''} units
          </span>
        </div>
      </div>

      {/* Selection bar */}
      {selectedUnitIds.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg">
          <span className="text-xs font-bold">{selectedUnitIds.length} unit{selectedUnitIds.length === 1 ? '' : 's'} selected</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelectedUnitIds([])} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white cursor-pointer">
              Clear selection
            </button>
            <button type="button" onClick={() => exportUnitsToCSV(units.filter(u => selectedUnitIds.includes(u.id)))} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            {onDeleteSelectedUnits && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Delete ${selectedUnitIds.length} selected unit(s)?`,
                    subject: `${selectedUnitIds.length} unit(s) and their connected tenants`,
                  });
                  if (ok) {
                    onDeleteSelectedUnits(selectedUnitIds);
                    setSelectedUnitIds([]);
                  }
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty states */}
      {filteredUnits.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-14 text-center">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-4">
            {units.length === 0 ? <Store className="w-8 h-8" /> : <Search className="w-8 h-8" />}
          </div>
          <p className="font-extrabold text-slate-900">{units.length === 0 ? 'No units yet' : 'No matching units'}</p>
          <p className="text-xs text-slate-500 mt-1 mb-5 max-w-sm mx-auto">
            {units.length === 0
              ? 'Create your first shop or space to start managing tenants and rent.'
              : search.trim()
                ? <>Nothing matches <strong className="text-slate-700">"{search.trim()}"</strong> with the current filters.</>
                : 'No units match the selected filters.'}
          </p>
          <button
            type="button"
            onClick={units.length === 0 ? onOpenAddUnit : handleResetFilters}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-orange-500/25 cursor-pointer inline-flex items-center gap-1.5"
          >
            {units.length === 0 ? <><Plus className="w-4 h-4" /> Create first unit</> : <><X className="w-4 h-4" /> Clear search & filters</>}
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              onChange={handleSelectAll}
              checked={selectedUnitIds.length > 0 && selectedUnitIds.length === filteredUnits.length}
              className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
            />
            Select all
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUnits.map(unit => {
              const isSelected = selectedUnitIds.includes(unit.id);
              const status = STATUS_STYLE[unit.occupancyStatus] || STATUS_STYLE.Available;
              const lease = unit.currentTenant ? leaseInfo(unit) : null;
              const [badgeTop, badgeBottom] = (unit.codeBadge || unit.unitNumber).split(' ');
              return (
                <div
                  key={unit.id}
                  className={`group relative bg-white rounded-3xl border shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col ${
                    isSelected ? 'border-orange-400 ring-2 ring-orange-200' : 'border-slate-200/80'
                  }`}
                >
                  <div className={`h-1.5 ${status.bar}`} />
                  <div className="p-5 flex-1 flex flex-col">
                    {/* Unit header */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100 border border-orange-200 text-orange-800 flex flex-col items-center justify-center leading-tight shrink-0">
                        <span className="text-[9px] font-bold">{badgeTop}</span>
                        <span className="text-xs font-black">{badgeBottom || ''}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-900 text-base">{unit.unitNumber}</span>
                          {unit.footfallBadge && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              <Star className="w-2.5 h-2.5" /> {unit.footfallBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{unit.type}{unit.subType ? ` • ${unit.subType}` : ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(unit.id)}
                          className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                          aria-label={`Select ${unit.unitNumber}`}
                        />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${status.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {unit.occupancyStatus}
                        </span>
                      </div>
                    </div>

                    {/* Specs */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { icon: Layers, label: unit.floor },
                        { icon: Ruler, label: `${unit.sizeSqM} m²` },
                        { icon: Gauge, label: unit.meterNumber || '—' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-1.5 flex items-center gap-1.5 min-w-0">
                          <s.icon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-700 truncate">{s.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Tenant */}
                    {unit.currentTenant ? (
                      <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200/80">
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                          <span className="w-9 h-9 rounded-xl bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 ring-2 ring-orange-100">
                            {unit.currentTenant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tenant</p>
                            <p className="text-xs font-extrabold text-slate-900 truncate">{unit.currentTenant.name}</p>
                          </div>
                          {billingChip(unit)}
                        </div>
                        <div className="px-3 py-2.5 bg-white space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <span className="flex items-center gap-1 text-slate-500 min-w-0">
                              <Store className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate font-semibold text-slate-700">{unit.currentTenant.trade || '—'}</span>
                            </span>
                            <span className="flex items-center gap-1 text-slate-500 min-w-0">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate font-semibold text-slate-700">{unit.currentTenant.phone || 'No phone'}</span>
                            </span>
                          </div>
                          {lease && (
                            <div>
                              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                                <span>{formatLongDate(lease.start || undefined)} → {formatLongDate(lease.end)}</span>
                                <span className={`font-black ${lease.days <= 10 ? 'text-rose-600' : lease.days <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {lease.days < 0 ? `Expired ${-lease.days}d ago` : lease.days === 0 ? 'Ends today' : `${lease.days} days left`}
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${lease.days <= 10 ? 'bg-rose-500' : lease.days <= 30 ? 'bg-amber-500' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`}
                                  style={{ width: `${lease.pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-emerald-800">Vacant — ready to lease</p>
                          <p className="text-[10px] text-emerald-700/80">No tenant on this unit yet</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAssignTenant ? onAssignTenant(unit) : (onEditUnit ? onEditUnit(unit) : onOpenAddUnit())}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-sm cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Lease
                        </button>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto pt-4 flex items-end justify-between gap-2">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly rent</span>
                        <span className="text-xl font-black text-slate-900">{formatUnitRent(unit)}</span>
                        {unit.escrowDepositUSD > 0 && (
                          <span className="block text-[10px] font-bold text-sky-700">Deposit ${unit.escrowDepositUSD.toLocaleString()} held</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditUnit ? onEditUnit(unit) : onOpenAddUnit()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
                          title="Edit unit details"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        {onDeleteUnit && (
                          <DeleteButton
                            title="Delete unit"
                            onDelete={() => onDeleteUnit(unit.id)}
                            confirm={{
                              title: `Delete unit ${unit.unitNumber}?`,
                              subject: unit.currentTenant ? `${unit.unitNumber} • leased to ${unit.currentTenant.name}` : `${unit.unitNumber} • vacant`,
                              message: 'The unit and any connected tenant are removed from the database. This cannot be undone.',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedUnitIds.length > 0 && selectedUnitIds.length === filteredUnits.length}
                      className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Unit</th>
                  <th className="p-4">Floor & size</th>
                  <th className="p-4">Tenant</th>
                  <th className="p-4">Rent</th>
                  <th className="p-4">Lease</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUnits.map(unit => {
                  const isSelected = selectedUnitIds.includes(unit.id);
                  const status = STATUS_STYLE[unit.occupancyStatus] || STATUS_STYLE.Available;
                  const lease = unit.currentTenant ? leaseInfo(unit) : null;
                  return (
                    <tr key={unit.id} className={`hover:bg-orange-50/40 transition-colors ${isSelected ? 'bg-orange-50/60' : ''}`}>
                      <td className="p-4">
                        <input type="checkbox" checked={isSelected} onChange={() => handleToggleRow(unit.id)} className="w-4 h-4 rounded accent-orange-500 cursor-pointer" />
                      </td>
                      <td className="p-4">
                        <p className="font-black text-slate-900 text-sm">{unit.unitNumber}</p>
                        <p className="text-[11px] text-slate-500">{unit.type}{unit.subType ? ` • ${unit.subType}` : ''}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-800">{unit.floor}</p>
                        <p className="text-[11px] text-slate-500">{unit.sizeSqM} m² • <span className="font-mono">{unit.meterNumber}</span></p>
                      </td>
                      <td className="p-4">
                        {unit.currentTenant ? (
                          <div className="max-w-[200px]">
                            <p className="font-bold text-slate-900 truncate">{unit.currentTenant.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{unit.currentTenant.trade}</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAssignTenant ? onAssignTenant(unit) : (onEditUnit ? onEditUnit(unit) : onOpenAddUnit())}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Lease now
                          </button>
                        )}
                      </td>
                      <td className="p-4 font-black text-slate-900">{formatUnitRent(unit)}</td>
                      <td className="p-4">
                        {lease ? (
                          <>
                            <p className="text-[11px] text-slate-600">{formatLongDate(lease.end)}</p>
                            <p className={`text-[10px] font-black ${lease.days <= 10 ? 'text-rose-600' : lease.days <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {lease.days < 0 ? 'Expired' : `${lease.days} days left`}
                            </p>
                          </>
                        ) : <span className="text-[11px] text-slate-400">—</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${status.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {unit.occupancyStatus}
                          </span>
                          {billingChip(unit)}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditUnit ? onEditUnit(unit) : onOpenAddUnit()}
                            className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit unit details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteUnit && (
                            <DeleteButton
                              title="Delete unit"
                              onDelete={() => onDeleteUnit(unit.id)}
                              confirm={{
                                title: `Delete unit ${unit.unitNumber}?`,
                                subject: unit.currentTenant ? `${unit.unitNumber} • leased to ${unit.currentTenant.name}` : `${unit.unitNumber} • vacant`,
                                message: 'The unit and any connected tenant are removed from the database. This cannot be undone.',
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
