import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  DoorOpen, 
  Percent, 
  TrendingUp, 
  AlertTriangle, 
  Lock, 
  Vault, 
  Download, 
  Plus, 
  CreditCard, 
  ArrowUpRight,
  ArrowRight
} from 'lucide-react';
import { PropertyUnit, PaymentRecord, CurrencyMode, NavigationTab } from '../types';
import { monthlyCollectionData } from '../data/commercialData';
import { exportPaymentsToCSV } from '../utils/exportUtils';

interface DashboardViewProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
  currencyMode: CurrencyMode;
  onCurrencyChange: (mode: CurrencyMode) => void;
  onOpenRecordPayment: () => void;
  onOpenAddUnit: () => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  units,
  payments,
  currencyMode,
  onCurrencyChange,
  onOpenRecordPayment,
  onOpenAddUnit,
  onNavigate
}) => {
  const [chartPeriod, setChartPeriod] = useState<'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');

  // Dynamic calculations based on state
  const totalUnitsCount = units.length;
  const occupiedUnitsCount = units.filter(u => u.occupancyStatus === 'Occupied').length;
  const availableUnitsCount = units.filter(u => u.occupancyStatus === 'Available').length;
  const reservedUnitsCount = units.filter(u => u.occupancyStatus === 'Reserved').length;
  const maintenanceUnitsCount = units.filter(u => u.occupancyStatus === 'Maintenance').length;
  
  const occupancyPercentage = totalUnitsCount > 0 
    ? Math.round((occupiedUnitsCount / totalUnitsCount) * 1000) / 10 
    : 0;
  const vacancyPercentage = totalUnitsCount > 0 
    ? Math.round((availableUnitsCount / totalUnitsCount) * 1000) / 10 
    : 0;

  const totalShopsCount = units.filter(u => u.type === 'Standard Shop').length;
  const totalSpacesCount = units.filter(u => u.type !== 'Standard Shop').length;

  const occupiedShopsCount = units.filter(u => u.type === 'Standard Shop' && u.occupancyStatus === 'Occupied').length;
  const occupiedSpacesCount = units.filter(u => u.type !== 'Standard Shop' && u.occupancyStatus === 'Occupied').length;

  const availableShopsCount = units.filter(u => u.type === 'Standard Shop' && u.occupancyStatus === 'Available').length;
  const availableSpacesCount = units.filter(u => u.type !== 'Standard Shop' && u.occupancyStatus === 'Available').length;

  const shopOccupancyPct = totalShopsCount > 0 ? Math.round((occupiedShopsCount / totalShopsCount) * 1000) / 10 : 0;
  const spaceOccupancyPct = totalSpacesCount > 0 ? Math.round((occupiedSpacesCount / totalSpacesCount) * 1000) / 10 : 0;

  // Real-time payments sums - derived purely from actual payment records
  const totalCollectedUSD = payments
    .filter(p => p.currency === 'USD')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalCollectedSSP = payments
    .filter(p => p.currency === 'SSP')
    .reduce((sum, p) => sum + p.amount, 0);

  // Arrears & overdue dynamic calculations
  const totalArrearsUSD = units.reduce((sum, u) => sum + (u.arrearsUSD || 0), 0);
  const totalArrearsSSP = units.reduce((sum, u) => sum + (u.arrearsSSP || 0), 0);
  const arrearsTenantsCount = units.filter(u => (u.arrearsUSD || 0) > 0 || (u.arrearsSSP || 0) > 0).length;

  // Escrow deposits dynamic calculations
  const totalEscrowUSD = units.reduce((sum, u) => sum + (u.escrowDepositUSD || 0), 0);
  const totalEscrowSSP = units.reduce((sum, u) => sum + (u.escrowDepositSSP || 0), 0);

  // Actual Liquid Reserves (Collected Rent + Escrow Deposits)
  const reserveCashUSD = totalCollectedUSD + totalEscrowUSD;
  const reserveCashSSP = totalCollectedSSP + totalEscrowSSP;

  const handleExportSummary = () => {
    exportPaymentsToCSV(payments);
  };

  return (
    <div id="dashboard-view-container" className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header Banner - Clean, Minimalist, Elegant */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live • Juba Central Mall
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time occupancy, collections, and reserve balance
          </p>
        </div>

        {/* Currency Pill & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
            {(['ALL', 'USD', 'SSP'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => onCurrencyChange(mode)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currencyMode === mode
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'ALL' ? 'All' : mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportSummary}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddUnit}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Unit</span>
          </button>

          <button
            type="button"
            onClick={onOpenRecordPayment}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* 4 Minimalist, High-Impact Metric Cards (Reduced from 8 cluttered boxes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Occupancy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Occupancy</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {occupancyPercentage}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{occupiedUnitsCount}</span>
            <span className="text-xs text-slate-400">/ {totalUnitsCount} Units</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, occupancyPercentage)}%` }} 
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
            <span>{availableUnitsCount} available</span>
            <span>{reservedUnitsCount + maintenanceUnitsCount} hold/maint</span>
          </div>
        </div>

        {/* Card 2: Collected */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Rent Collected</span>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
              {payments.length} receipts
            </span>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              ${totalCollectedUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span className="text-xs font-normal text-slate-400 ml-1">USD</span>
            </p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {totalCollectedSSP.toLocaleString('en-US')} SSP
            </p>
          </div>
        </div>

        {/* Card 3: Arrears */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Overdue Arrears</span>
            {arrearsTenantsCount > 0 && (
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                {arrearsTenantsCount} overdue
              </span>
            )}
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold text-rose-600 tracking-tight">
              ${totalArrearsUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span className="text-xs font-normal text-slate-400 ml-1">USD</span>
            </p>
            <p className="text-xs font-semibold text-rose-700/80 mt-0.5">
              {totalArrearsSSP.toLocaleString('en-US')} SSP
            </p>
          </div>
        </div>

        {/* Card 4: Reserves & Escrow */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Total Liquidity</span>
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              Escrow + Rent
            </span>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              ${reserveCashUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span className="text-xs font-normal text-slate-400 ml-1">USD</span>
            </p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {reserveCashSSP.toLocaleString('en-US')} SSP
            </p>
          </div>
        </div>

      </div>

      {/* Main Visuals: Rent Velocity & Spatial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Rent Collection Trend (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Collection Velocity</h3>
                <p className="text-xs text-slate-400 mt-0.5">Monthly revenue trends</p>
              </div>

              {/* Time Period Tabs */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                {(['Monthly', 'Quarterly', 'Yearly'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setChartPeriod(tab as any)}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      chartPeriod === tab ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean Legend */}
            <div className="flex items-center gap-5 text-xs pt-4 font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> USD Collected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-600" /> SSP Collected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Overdue
              </span>
            </div>

            {/* SVG Chart Graphic */}
            <div className="mt-6 h-56 w-full relative">
              {payments.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-4">
                  <TrendingUp className="w-7 h-7 text-slate-300 mb-2 stroke-[1.5]" />
                  <p className="font-semibold text-slate-700 text-xs">No Payments Recorded Yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Record payments to view monthly collection velocity</p>
                  <button
                    type="button"
                    onClick={onOpenRecordPayment}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    + Record Payment
                  </button>
                </div>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 600 220" fill="none">
                  <line x1="40" y1="30" x2="580" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="80" x2="580" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="130" x2="580" y2="130" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="180" x2="580" y2="180" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="195" x2="580" y2="195" stroke="#cbd5e1" strokeWidth="1" />

                  <text x="5" y="35" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">$50k</text>
                  <text x="5" y="85" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">$35k</text>
                  <text x="5" y="135" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">$20k</text>
                  <text x="5" y="185" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">$10k</text>

                  {/* Dynamically grouped payments */}
                  {Array.from(
                    payments.reduce((acc, p) => {
                      const period = p.accountingPeriod || 'Current';
                      const existing = acc.get(period) || { month: period, usd: 0, ssp: 0, overdue: 0 };
                      if (p.currency === 'USD') existing.usd += p.amount;
                      if (p.currency === 'SSP') existing.ssp += p.amount / 1300;
                      acc.set(period, existing);
                      return acc;
                    }, new Map<string, { month: string; usd: number; ssp: number; overdue: number }>()).values()
                  ).slice(0, 5).map((item, idx) => {
                    const xBase = 80 + idx * 95;
                    const maxVal = 20000;
                    const usdHeight = Math.min(140, (item.usd / maxVal) * 140);
                    const sspHeight = Math.min(120, (item.ssp / maxVal) * 120);

                    return (
                      <g key={item.month} className="transition-all hover:opacity-90">
                        <rect
                          x={xBase}
                          y={195 - usdHeight}
                          width="14"
                          height={Math.max(4, usdHeight)}
                          rx="3"
                          fill="#2563eb"
                        />
                        <rect
                          x={xBase + 16}
                          y={195 - sspHeight}
                          width="14"
                          height={Math.max(4, sspHeight)}
                          rx="3"
                          fill="#0d9488"
                        />
                        <text
                          x={xBase + 15}
                          y="212"
                          textAnchor="middle"
                          fill="#2563eb"
                          fontSize="10"
                          fontWeight="bold"
                        >
                          {item.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Ledger synced in real-time
            </span>
            <button
              onClick={() => onNavigate('payments')}
              className="text-blue-600 font-semibold hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Spatial Breakdown (1 Col) - Clean, Uncluttered */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Spatial Yield</h3>
              <span className="text-xs font-semibold text-slate-500">
                {totalUnitsCount} Units
              </span>
            </div>

            {/* Donut Chart */}
            <div className="relative w-40 h-40 mx-auto my-5 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600 transition-all duration-700"
                  strokeDasharray={`${occupancyPercentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-amber-400 transition-all duration-700"
                  strokeDasharray={`${vacancyPercentage}, 100`}
                  strokeDashoffset={`-${occupancyPercentage}`}
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900">{occupancyPercentage}%</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Occupied</span>
              </div>
            </div>

            {/* Clean Status Legend - No noisy nested cards */}
            <div className="grid grid-cols-2 gap-2 text-xs py-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span className="text-slate-600">Occupied: <strong className="text-slate-900">{occupiedUnitsCount}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-slate-600">Available: <strong className="text-slate-900">{availableUnitsCount}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-900" />
                <span className="text-slate-600">Reserved: <strong className="text-slate-900">{reservedUnitsCount}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                <span className="text-slate-600">Maint: <strong className="text-slate-900">{maintenanceUnitsCount}</strong></span>
              </div>
            </div>

            {/* Minimal Progress Bars */}
            <div className="space-y-3 mt-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>Enclosed Shops</span>
                  <span className="font-semibold text-slate-900">{occupiedShopsCount} / {totalShopsCount}</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-500 rounded-full" 
                    style={{ width: `${Math.min(100, shopOccupancyPct)}%` }} 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span>Open Kiosks & Spaces</span>
                  <span className="font-semibold text-slate-900">{occupiedSpacesCount} / {totalSpacesCount}</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500 rounded-full" 
                    style={{ width: `${Math.min(100, spaceOccupancyPct)}%` }} 
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigate('units')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Manage Unit Inventory</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
