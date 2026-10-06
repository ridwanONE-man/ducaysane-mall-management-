import React, { useState, useEffect } from 'react';
import { X, UserPlus, Store, Calendar, ShieldCheck, DollarSign, Phone, Mail, Briefcase } from 'lucide-react';
import { PropertyUnit, DepositRecord } from '../types';

interface AssignTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: PropertyUnit | null;
  onConfirmLease: (updatedUnit: PropertyUnit, newDeposit?: DepositRecord) => void;
}

export const AssignTenantModal: React.FC<AssignTenantModalProps> = ({
  isOpen,
  onClose,
  unit,
  onConfirmLease
}) => {
  const [tenantName, setTenantName] = useState('');
  const [trade, setTrade] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [monthlyRentUSD, setMonthlyRentUSD] = useState<number>(500);
  const [depositMonths, setDepositMonths] = useState<number>(2);
  const [customDepositUSD, setCustomDepositUSD] = useState<string>('');
  const [isCustomDeposit, setIsCustomDeposit] = useState(false);
  const [leaseDurationMonths, setLeaseDurationMonths] = useState<number>(12);
  const [leaseStart, setLeaseStart] = useState<string>('2026-10-01');
  const [bankAccount, setBankAccount] = useState('Stanbic Bank - Escrow Liability #8892-01');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (unit) {
      setTenantName('');
      setTrade(unit.type === 'Shop' || unit.categoryType === 'Shop' ? 'Retail Store' : 'Commercial Space');
      setPhone('');
      setEmail('');
      const baseRent = unit.monthlyRateUSD || 500;
      setMonthlyRentUSD(baseRent);
      setDepositMonths(2);
      setIsCustomDeposit(false);
      setCustomDepositUSD(String(baseRent * 2));
      setLeaseDurationMonths(12);
      const today = new Date();
      const startStr = today.toISOString().slice(0, 10);
      setLeaseStart(startStr);
      setNotes('');
    }
  }, [unit, isOpen]);

  if (!isOpen || !unit) return null;

  const calculatedDeposit = isCustomDeposit 
    ? (parseFloat(customDepositUSD) || 0) 
    : monthlyRentUSD * depositMonths;

  // Calculate lease end date
  const computeEndDate = () => {
    try {
      const d = new Date(leaseStart);
      d.setMonth(d.getMonth() + leaseDurationMonths);
      return d.toISOString().slice(0, 10);
    } catch {
      return '2027-10-01';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) return;

    const leaseEnd = computeEndDate();
    const effectiveDepositMonths = isCustomDeposit 
      ? Math.max(1, Math.round(calculatedDeposit / (monthlyRentUSD || 1))) 
      : depositMonths;

    const newTenant = {
      id: `t-${Date.now()}`,
      name: tenantName.trim(),
      trade: trade.trim() || 'Commercial Retail',
      code: `TNT-${unit.unitNumber}`,
      phone: phone.trim() || '+211 928 000 000',
      email: email.trim() || `${unit.unitNumber.toLowerCase()}@nyakuron.com`,
      unitNumber: unit.unitNumber,
      balanceUSD: 0,
      balanceSSP: 0,
      depositUSD: calculatedDeposit,
      depositMonths: effectiveDepositMonths,
      balanceStatus: 'Current' as const,
      leaseStart,
      leaseEnd,
      daysRemaining: leaseDurationMonths * 30,
      status: 'Active' as const,
      joinDate: leaseStart
    };

    const updatedUnit: PropertyUnit = {
      ...unit,
      occupancyStatus: 'Occupied',
      currentTenant: newTenant,
      monthlyRateUSD: monthlyRentUSD,
      escrowDepositUSD: calculatedDeposit,
      depositMonths: effectiveDepositMonths,
      leaseStart,
      leaseEnd,
      leaseTermMonths: leaseDurationMonths,
      daysRemaining: leaseDurationMonths * 30,
      daysToExpiry: leaseDurationMonths * 30,
      billingStatus: 'Paid',
      billingMonthText: `Active • ${new Date(leaseStart).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
      arrearsUSD: 0,
      arrearsSSP: 0,
      notes: notes.trim() || `Leased to ${tenantName.trim()} on ${leaseStart}. Deposit: $${calculatedDeposit} (${effectiveDepositMonths} mos).`
    };

    let newDepositRecord: DepositRecord | undefined;
    if (calculatedDeposit > 0) {
      newDepositRecord = {
        id: `dep-${Date.now()}`,
        depositSlip: `DEP-2026-${Math.floor(100 + Math.random() * 900)}`,
        tenantName: tenantName.trim(),
        tenantId: newTenant.id,
        unitNumber: unit.unitNumber,
        amountUSD: calculatedDeposit,
        amountSSP: 0,
        depositMonths: effectiveDepositMonths,
        monthlyRentUSD: monthlyRentUSD,
        currency: 'USD',
        heldSince: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        status: 'Held in Escrow',
        bankAccount,
        notes: `Initial security deposit for ${unit.unitNumber} (${effectiveDepositMonths} month(s) rent held in segregated escrow).`
      };
    }

    onConfirmLease(updatedUnit, newDepositRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-8 max-h-[92vh] flex flex-col font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Lease Unit {unit.unitNumber} to New Tenant
              </h2>
              <p className="text-xs text-slate-300">
                {unit.categoryType || unit.type} • {unit.floor} • {unit.sizeSqM} m² ({unit.sizeSqFt} sq.ft)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Tenant Identity */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center gap-1.5 text-slate-900 font-bold">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span>Tenant Information & Business Profile</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Tenant Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Khaalid Adam Abdale"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Business / Trade Category</label>
                <input
                  type="text"
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  placeholder="e.g. Electronics, Cosmetics, Kiosk"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contact Phone Number</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+211 920 000 000"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tenant@nyakuron.com"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rent & Deposit Configuration */}
          <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-2xl space-y-3">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span>Rental Terms & Security Deposit</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Agreed Monthly Rent (USD $) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={monthlyRentUSD}
                    onChange={(e) => setMonthlyRentUSD(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Security Deposit Options</label>
                <select
                  value={isCustomDeposit ? 'custom' : depositMonths}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomDeposit(true);
                    } else {
                      setIsCustomDeposit(false);
                      setDepositMonths(Number(e.target.value));
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 shadow-2xs"
                >
                  <option value={1}>1 Month Deposit (${monthlyRentUSD * 1})</option>
                  <option value={2}>2 Months Deposit (${monthlyRentUSD * 2}) • Standard</option>
                  <option value={3}>3 Months Deposit (${monthlyRentUSD * 3})</option>
                  <option value="custom">Custom Deposit Amount</option>
                </select>
              </div>
            </div>

            {isCustomDeposit && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Custom Security Deposit Amount (USD $)</label>
                <input
                  type="number"
                  step="any"
                  value={customDepositUSD}
                  onChange={(e) => setCustomDepositUSD(e.target.value)}
                  placeholder="Enter custom deposit"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-2xs"
                />
              </div>
            )}

            {/* Escrow summary banner */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-blue-200 text-xs">
              <span className="font-semibold text-slate-600">Total Escrow Deposit to be Held:</span>
              <span className="font-extrabold text-blue-700 text-sm">
                ${calculatedDeposit.toLocaleString()} USD
              </span>
            </div>
          </div>

          {/* Lease Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Lease Start Date</label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={leaseStart}
                  onChange={(e) => setLeaseStart(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Lease Duration</label>
              <select
                value={leaseDurationMonths}
                onChange={(e) => setLeaseDurationMonths(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value={1}>1 Month (Monthly Roll)</option>
                <option value={3}>3 Months (Quarterly)</option>
                <option value={6}>6 Months (Semi-Annual)</option>
                <option value={12}>1 Year (12 Months Standard)</option>
                <option value={24}>2 Years (24 Months Commercial)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Depository Trust Bank Account</label>
            <select
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value="Stanbic Bank - Escrow Liability #8892-01">Stanbic Bank - Escrow Liability #8892-01</option>
              <option value="Central Vault Cash Float - Nyakuron">Central Vault Cash Float - Nyakuron</option>
              <option value="Ecobank Commercial Escrow #4410-09">Ecobank Commercial Escrow #4410-09</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Lease Notes & Terms</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special lease conditions, hand-over terms, or initial payment notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Submit Actions */}
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-97 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Confirm Lease & Onboard Tenant</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
