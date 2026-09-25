import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Printer, 
  Calendar, 
  AlertTriangle, 
  Layers, 
  CheckCircle2, 
  FileText,
  Clock,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import { PropertyUnit, PaymentRecord } from '../types';

interface ReportsViewProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
}

type ReportTab = 'revenue' | 'arrears' | 'spatial' | 'expirations';

export const ReportsView: React.FC<ReportsViewProps> = ({ units, payments }) => {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('revenue');
  const [selectedNoticeTenant, setSelectedNoticeTenant] = useState<PropertyUnit | null>(null);

  // Aggregations
  const totalArrearsUSD = units.reduce((sum, u) => sum + (u.arrearsUSD || 0), 0);
  const totalArrearsSSP = units.reduce((sum, u) => sum + (u.arrearsSSP || 0), 0);
  const unitsInArrears = units.filter(u => (u.arrearsUSD || 0) > 0 || (u.arrearsSSP || 0) > 0);

  const unitsExpiringSoon = units.filter(u => u.daysToExpiry !== undefined && u.daysToExpiry <= 90);

  // Floor yields
  const floorStats = ['Ground Floor', 'Floor 1', 'Floor 2', 'Floor 3'].map(floor => {
    const floorUnits = units.filter(u => u.floor === floor);
    const occupied = floorUnits.filter(u => u.occupancyStatus === 'Occupied').length;
    const total = floorUnits.length;
    const totalArea = floorUnits.reduce((sum, u) => sum + u.sizeSqM, 0);
    const totalRevenueUSD = floorUnits
      .filter(u => u.occupancyStatus === 'Occupied')
      .reduce((sum, u) => sum + u.monthlyRateUSD, 0);
    const yieldPerSqM = totalArea > 0 ? totalRevenueUSD / totalArea : 0;
    return {
      floor,
      total,
      occupied,
      rate: total > 0 ? (occupied / total) * 100 : 0,
      totalArea,
      totalRevenueUSD,
      yieldPerSqM
    };
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportReportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (activeReportTab === 'revenue') {
      filename = 'NBC_Revenue_Report';
      headers = ['Receipt #', 'Tenant', 'Unit Space', 'Date', 'Period', 'Amount Paid', 'Currency', 'Payment Method'];
      rows = payments.map(p => [
        p.receiptNumber,
        `"${p.tenantName}"`,
        `"${p.unitSpace}"`,
        p.date,
        p.accountingPeriod,
        p.amount.toFixed(2),
        p.currency,
        `"${p.paymentMethod}"`
      ]);
    } else if (activeReportTab === 'arrears') {
      filename = 'NBC_Arrears_Aging_Report';
      headers = ['Unit Number', 'Tenant Name', 'Floor', 'Billing Status', 'Overdue USD', 'Overdue SSP', 'Days to Expiry'];
      rows = unitsInArrears.map(u => [
        u.unitNumber,
        `"${u.currentTenant?.name || 'Vacant'}"`,
        u.floor,
        u.billingStatus,
        (u.arrearsUSD || 0).toFixed(2),
        (u.arrearsSSP || 0).toString(),
        (u.daysToExpiry || 0).toString()
      ]);
    } else if (activeReportTab === 'spatial') {
      filename = 'NBC_Spatial_Yield_Report';
      headers = ['Floor Level', 'Total Units', 'Occupied Units', 'Occupancy Rate (%)', 'Total Area (sq.m)', 'Monthly Yield (USD)', 'Yield / sq.m'];
      rows = floorStats.map(f => [
        f.floor,
        f.total.toString(),
        f.occupied.toString(),
        f.rate.toFixed(1) + '%',
        f.totalArea.toFixed(1),
        f.totalRevenueUSD.toFixed(2),
        '$' + f.yieldPerSqM.toFixed(2)
      ]);
    } else {
      filename = 'NBC_Lease_Expirations';
      headers = ['Unit Number', 'Tenant Name', 'Floor', 'Lease Maturity', 'Days Remaining', 'Monthly Rate USD'];
      rows = unitsExpiringSoon.map(u => [
        u.unitNumber,
        `"${u.currentTenant?.name || ''}"`,
        u.floor,
        u.leaseEnd || 'N/A',
        (u.daysToExpiry || 0).toString(),
        u.monthlyRateUSD.toFixed(2)
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="reports-view" className="p-5 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Executive Operational & Fiscal Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Certified commercial auditing, collection velocity, delinquency aging, and spatial yield metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            onClick={handleExportReportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Active Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* Report Module Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveReportTab('revenue')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeReportTab === 'revenue'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Revenue & Collections</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('arrears')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeReportTab === 'arrears'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Arrears Aging Schedule ({unitsInArrears.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('spatial')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeReportTab === 'spatial'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Spatial & Floor Yield</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('expirations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeReportTab === 'expirations'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Lease Maturities ({unitsExpiringSoon.length})</span>
        </button>
      </div>

      {/* Active Tab Content */}

      {/* TAB 1: REVENUE & COLLECTIONS */}
      {activeReportTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">October Target Budget</span>
              <span className="text-2xl font-black text-slate-900 mt-2 block">$52,000.00 USD</span>
              <span className="text-[11px] text-slate-400 mt-1 block">Contracted Potential GFA</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">Current Cleared Collections</span>
              <span className="text-2xl font-black text-emerald-600 mt-2 block">$42,850.00 USD</span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                82.4% Realized MTD
              </span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">Parallel Currency Collections</span>
              <span className="text-2xl font-black text-blue-600 mt-2 block">18,458,000 SSP</span>
              <span className="text-[11px] text-slate-400 mt-1 block">Mobile money & office cash</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Invoiced Settlements</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[11px] uppercase font-bold">
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Tenant Name</th>
                    <th className="py-2.5 px-3">Space</th>
                    <th className="py-2.5 px-3">Billing Month</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.slice(0, 5).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{p.receiptNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.tenantName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.unitSpace}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.accountingPeriod}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {p.currency === 'USD' ? `$${p.amount.toFixed(2)}` : `${p.amount.toLocaleString()} SSP`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ARREARS AGING */}
      {activeReportTab === 'arrears' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">Total Arrears Balance (USD)</span>
              <span className="text-2xl font-black text-rose-600 mt-2 block">${totalArrearsUSD.toLocaleString()}</span>
              <span className="text-[11px] text-slate-400 mt-1 block">Subject to 2% overdue penalty</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">Total Arrears Balance (SSP)</span>
              <span className="text-2xl font-black text-amber-600 mt-2 block">{totalArrearsSSP.toLocaleString()} SSP</span>
              <span className="text-[11px] text-slate-400 mt-1 block">Local currency obligations</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 block">Tenants in Arrears</span>
              <span className="text-2xl font-black text-slate-900 mt-2 block">{unitsInArrears.length} Commercial Accounts</span>
              <span className="text-[11px] text-rose-600 font-semibold mt-1 block">Escrow guarantees active</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Overdue Balances & Recovery Queue</h3>
              <span className="text-xs text-slate-500 font-medium">Auto-cross referenced against 2-month escrow</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[11px] uppercase font-bold">
                    <th className="py-3 px-4">Unit / Badge</th>
                    <th className="py-3 px-4">Commercial Tenant</th>
                    <th className="py-3 px-4">Floor</th>
                    <th className="py-3 px-4">Overdue USD</th>
                    <th className="py-3 px-4">Overdue SSP</th>
                    <th className="py-3 px-4">Aging Status</th>
                    <th className="py-3 px-4 text-right">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitsInArrears.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{u.unitNumber}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{u.currentTenant?.name}</div>
                        <span className="text-[10px] text-slate-400">{u.currentTenant?.phone}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{u.floor}</td>
                      <td className="py-3.5 px-4 font-bold text-rose-600">
                        {u.arrearsUSD > 0 ? `$${u.arrearsUSD.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-amber-600">
                        {u.arrearsSSP > 0 ? `${u.arrearsSSP.toLocaleString()} SSP` : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-600/20">
                          30+ Days Past Grace
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedNoticeTenant(u)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Issue Notice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SPATIAL EFFICIENCY */}
      {activeReportTab === 'spatial' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Floor-by-Floor Commercial Spatial Yield</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {floorStats.map(f => (
                <div key={f.floor} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 text-xs">{f.floor}</span>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                      {f.rate.toFixed(0)}% Occupied
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Units:</span>
                      <span className="font-semibold text-slate-800">{f.occupied} / {f.total}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Lettable Area:</span>
                      <span className="font-semibold text-slate-800">{f.totalArea.toFixed(0)} m²</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Monthly Yield:</span>
                      <span className="font-bold text-emerald-600">${f.totalRevenueUSD.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200">
                      <span>Yield / m²:</span>
                      <span className="font-bold text-slate-900">${f.yieldPerSqM.toFixed(2)}/m²</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEASE EXPIRATIONS */}
      {activeReportTab === 'expirations' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Upcoming Lease Expirations (Next 90 Days)</h3>
            <p className="text-xs text-slate-500">Scheduled maturities requiring renewal confirmation or escrow inspection.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[11px] uppercase font-bold">
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Tenant Name</th>
                  <th className="py-3 px-4">Floor</th>
                  <th className="py-3 px-4">Monthly Rent (USD)</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Days Left</th>
                  <th className="py-3 px-4 text-right">Renewal Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unitsExpiringSoon.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{u.unitNumber}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{u.currentTenant?.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{u.floor}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">${u.monthlyRateUSD.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{u.leaseEnd}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (u.daysToExpiry || 0) <= 30
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {u.daysToExpiry} days
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => alert(`Renewal draft generated for ${u.currentTenant?.name} (${u.unitNumber}). Terms locked for 12 months.`)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        Draft Renewal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Demand Notice Letter Modal */}
      {selectedNoticeTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Official Formal Demand Notice</h3>
              </div>
              <button 
                onClick={() => setSelectedNoticeTenant(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="my-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono text-slate-800 leading-relaxed">
              <p className="font-bold">TO: {selectedNoticeTenant.currentTenant?.name}</p>
              <p>UNIT: {selectedNoticeTenant.unitNumber} ({selectedNoticeTenant.floor})</p>
              <p>OUTSTANDING AMOUNT: ${selectedNoticeTenant.arrearsUSD.toFixed(2)} USD</p>
              <p className="mt-2 text-slate-600">
                Take notice that your commercial rent is overdue. In accordance with Nyakuron Business Centre Tenancy Agreement Section 9, please clear the arrears within 7 business days or escrow default procedures will be enacted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedNoticeTenant(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(`Formal Notice dispatched electronically to ${selectedNoticeTenant.currentTenant?.email}`);
                  setSelectedNoticeTenant(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Send Formal Notice
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
