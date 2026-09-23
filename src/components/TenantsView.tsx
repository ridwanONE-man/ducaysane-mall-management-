import React, { useState } from 'react';
import { Users, Search, Phone, Mail, Store, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { initialTenants } from '../data/commercialData';
import { TenantInfo, PropertyUnit } from '../types';

interface TenantsViewProps {
  onRecordPaymentForTenant: (unitNumber: string) => void;
  units?: PropertyUnit[];
}

export const TenantsView: React.FC<TenantsViewProps> = ({ onRecordPaymentForTenant, units }) => {
  const derivedTenants: TenantInfo[] = units && units.length > 0
    ? units
        .filter(u => u.currentTenant && u.currentTenant.name.trim().length > 0)
        .map(u => ({
          ...u.currentTenant!,
          unitNumber: u.unitNumber,
          balanceUSD: u.arrearsUSD || 0,
          balanceSSP: u.arrearsSSP || 0,
          balanceStatus: (u.arrearsUSD || 0) > 0 || (u.arrearsSSP || 0) > 0 ? ('Overdue' as const) : ('Current' as const),
          leaseEnd: u.leaseEnd || 'Dec 31, 2025'
        }))
    : [];

  const tenants = derivedTenants.length > 0 ? derivedTenants : initialTenants;
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.trade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.unitNumber && t.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <span>Home</span>
            <span>›</span>
            <span className="text-blue-600">Tenants</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Commercial Tenant Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Active corporate leases, trade categories, contact representatives, and balance standings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tenant, trade, unit..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 shadow-xs"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-slate-400 stroke-[1.5]" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Active Tenants</h3>
          <p className="text-xs text-slate-400 mt-1">When commercial spaces are leased and assigned to businesses, tenant profiles will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tenant => (
            <div key={tenant.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-blue-500/20">
                      {tenant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{tenant.name}</h3>
                      <p className="text-xs text-slate-500">{tenant.trade}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                    {tenant.code}
                  </span>
                </div>

                <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      Leased Space:
                    </span>
                    <span className="font-bold text-slate-900">{tenant.unitNumber}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      Phone Contact:
                    </span>
                    <span className="font-medium text-slate-700">{tenant.phone}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      Official Email:
                    </span>
                    <span className="font-medium text-slate-700 truncate max-w-[170px]">{tenant.email}</span>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Standing</span>
                    <span className={`font-bold ${tenant.balanceStatus === 'Current' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {tenant.balanceStatus === 'Current' ? 'Good Standing' : 'Partial Balance Due'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Lease Expiry</span>
                    <span className="font-semibold text-slate-700">{tenant.leaseEnd}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onRecordPaymentForTenant(tenant.unitNumber || 'Unit G-001')}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Record Rent Payment</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
