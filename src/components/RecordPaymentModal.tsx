import React, { useState, useId } from 'react';
import { 
  X, 
  CreditCard, 
  Store, 
  Calendar, 
  Check, 
  AlertCircle
} from 'lucide-react';
import { PropertyUnit, PaymentRecord, PaymentMethodType } from '../types';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  units: PropertyUnit[];
  onConfirmPayment: (payment: PaymentRecord) => void;
  selectedUnitId?: string;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  units,
  onConfirmPayment,
  selectedUnitId
}) => {
  // Find units that have active tenants or any units
  const occupiedUnits = units.filter(u => u.currentTenant);
  const initialUnit = occupiedUnits.find(u => u.id === selectedUnitId) || 
                      units.find(u => u.id === selectedUnitId) ||
                      occupiedUnits[0] || 
                      units[0] || 
                      null;

  const [selectedUnit, setSelectedUnit] = useState<PropertyUnit | null>(initialUnit);
  const [manualTenantName, setManualTenantName] = useState('');
  const [manualUnitNumber, setManualUnitNumber] = useState('');

  // Dynamic current date
  const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const currentMonthPeriod = `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;

  const [paymentDate, setPaymentDate] = useState(todayFormatted);
  const [accountingPeriod, setAccountingPeriod] = useState(currentMonthPeriod);
  const [currency, setCurrency] = useState<'USD' | 'SSP'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Cash (Office Management Desk)');
  
  // Clean dynamic amount: defaults to the monthly rate of the selected unit
  const defaultAmount = selectedUnit 
    ? (currency === 'USD' ? selectedUnit.monthlyRateUSD : selectedUnit.monthlyRateSSP)
    : 0;
  const [amountReceived, setAmountReceived] = useState<number>(defaultAmount);
  const [notes, setNotes] = useState('');
  const [autoGenerateReceipt, setAutoGenerateReceipt] = useState(true);

  // Generate dynamic receipt number matching official NBC voucher
  const receiptNumberId = useId();
  const nextReceiptNumber = `#REC-2026-${String(Math.abs(receiptNumberId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 894)) % 900 + 100).padStart(4, '0')}`;

  if (!isOpen) return null;

  // Calculations
  const baseRent = selectedUnit ? (currency === 'USD' ? selectedUnit.monthlyRateUSD : selectedUnit.monthlyRateSSP) : 0;
  const previousArrears = selectedUnit ? (currency === 'USD' ? selectedUnit.arrearsUSD : selectedUnit.arrearsSSP) : 0;
  const totalDue = baseRent + previousArrears;
  const numAmount = Number(amountReceived) || 0;
  
  const appliedToRent = Math.min(numAmount, totalDue);
  const remainingRentBalance = Math.max(0, totalDue - numAmount);
  const advanceBalanceHeld = Math.max(0, numAmount - totalDue);

  const getPaymentStatus = (): 'Paid' | 'Partially Paid' | 'Pending Review' => {
    if (remainingRentBalance <= 0) return 'Paid';
    return 'Partially Paid';
  };

  const handleUnitChange = (unitNumber: string) => {
    const found = units.find(u => u.unitNumber === unitNumber);
    if (found) {
      setSelectedUnit(found);
      const rent = currency === 'USD' ? found.monthlyRateUSD : found.monthlyRateSSP;
      setAmountReceived(rent);
      setNotes('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const unitNum = selectedUnit?.unitNumber || manualUnitNumber || 'Walk-in Space';
    const tenantName = selectedUnit?.currentTenant?.name || manualTenantName || 'Walk-in Tenant';
    const tenantId = selectedUnit?.currentTenant?.code || 'TNT-WALKIN';

    const record: PaymentRecord = {
      id: `pay-${Date.now()}`,
      receiptNumber: nextReceiptNumber,
      tenantName,
      tenantId,
      unitNumber: unitNum,
      unitSpace: selectedUnit 
        ? `${selectedUnit.unitNumber} (${selectedUnit.floor} ${selectedUnit.type})`
        : unitNum,
      date: paymentDate,
      accountingPeriod,
      currency,
      amount: numAmount,
      paymentMethod,
      monthlyBaseRent: baseRent,
      previousArrears,
      totalDue,
      remainingBalance: remainingRentBalance,
      advanceBalance: advanceBalanceHeld,
      status: getPaymentStatus(),
      notes: notes.trim() || `Rental payment cleared via ${paymentMethod}.`,
      receivedBy: 'Mohamed Mohamoud'
    };

    onConfirmPayment(record);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div 
        id="record-tenant-payment-modal"
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8"
      >
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-orange-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Record Rent Payment</h2>
              <p className="text-xs text-slate-500">Apply payments towards rent, advance deposits, or outstanding arrears.</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Row 1: Tenant Name & Leased Space */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tenant Name</label>
              {units.length > 0 ? (
                <select
                  value={selectedUnit?.unitNumber || ''}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                >
                  <option value="" disabled>-- Select Tenant / Space --</option>
                  {occupiedUnits.map(u => (
                    <option key={u.id} value={u.unitNumber}>
                      {u.currentTenant?.name} ({u.unitNumber})
                    </option>
                  ))}
                  {occupiedUnits.length === 0 && units.map(u => (
                    <option key={u.id} value={u.unitNumber}>
                      {u.unitNumber} ({u.occupancyStatus})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={manualTenantName}
                  onChange={(e) => setManualTenantName(e.target.value)}
                  placeholder="Enter tenant name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Leased Space</label>
              {selectedUnit ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 font-medium">
                  <Store className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">{selectedUnit.unitNumber} ({selectedUnit.floor})</span>
                  <span className="ml-auto font-bold text-blue-700 shrink-0">{selectedUnit.sizeSqM} m²</span>
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={manualUnitNumber}
                  onChange={(e) => setManualUnitNumber(e.target.value)}
                  placeholder="e.g. Unit G-001"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              )}
            </div>
          </div>

          {/* Row 2: Payment Date & Rent Accounting Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Date</label>
              <div className="relative">
                <input
                  type="text"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rent Accounting Period</label>
              <select
                value={accountingPeriod}
                onChange={(e) => setAccountingPeriod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value="October 2024">October 2024</option>
                <option value="November 2024">November 2024</option>
                <option value="December 2024">December 2024</option>
                <option value="September 2024">September 2024</option>
              </select>
            </div>
          </div>

          {/* Row 3: Payment Currency & Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Currency</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>USD ($)</span>
                  {currency === 'USD' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrency('SSP')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    currency === 'SSP'
                      ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>SSP (SSP)</span>
                  {currency === 'SSP' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Channel / Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value="Cash (Office Management Desk)">Cash (Office Management Desk)</option>
                <option value="EVC Plus / Mobile Money">EVC Plus / Mobile Money</option>
                <option value="Bank Wire Transfer">Bank Wire Transfer</option>
                <option value="Cheque / Slip">Cheque / Slip</option>
              </select>
            </div>
          </div>

          {/* LEDGER ALLOCATION & BALANCE PREVIEW (Exact card from Image 3) */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Ledger Allocation & Balance Preview</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                Auto-Calculated
              </span>
            </div>

            {/* 3 Metric columns */}
            <div className="grid grid-cols-3 gap-3 pt-1 border-t border-slate-200/70">
              <div>
                <span className="text-[10px] text-slate-500 block">Monthly Base Rent</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {currency === 'USD' ? `$${baseRent.toLocaleString()}` : `${baseRent.toLocaleString()} SSP`} {currency}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Previous Arrears</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-600">
                  {currency === 'USD' ? `$${previousArrears.toFixed(2)}` : `${previousArrears.toLocaleString()} SSP`} {currency}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Total Due Amount</span>
                <span className="text-xs sm:text-sm font-bold text-blue-700">
                  {currency === 'USD' ? `$${totalDue.toLocaleString()}` : `${totalDue.toLocaleString()} SSP`} {currency}
                </span>
              </div>
            </div>

            {/* Payment Amount Input */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Payment Amount Received</span>
                <span className="text-[11px] text-slate-500 font-normal">Currency: {currency}</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-600">
                  {currency === 'USD' ? '$' : 'SSP'}
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Breakdown Result Rows */}
            <div className="space-y-1.5 pt-2 text-xs border-t border-slate-200/70">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Applied to {accountingPeriod.split(' ')[0]} Rent:</span>
                <span className="font-bold text-emerald-700">
                  {currency === 'USD' ? `$${appliedToRent.toFixed(2)}` : `${appliedToRent.toLocaleString()} SSP`} {currency}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Remaining Rent Balance:</span>
                  {remainingRentBalance > 0 ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                      PARTIALLY PAID
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      PAID IN FULL
                    </span>
                  )}
                </div>
                <span className={`font-bold ${remainingRentBalance > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {currency === 'USD' ? `$${remainingRentBalance.toFixed(2)}` : `${remainingRentBalance.toLocaleString()} SSP`} {currency}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Advance Balance Held:</span>
                <span className="font-bold text-slate-700">
                  {currency === 'USD' ? `$${advanceBalanceHeld.toFixed(2)}` : `${advanceBalanceHeld.toLocaleString()} SSP`} {currency}
                </span>
              </div>
            </div>

          </div>

          {/* Transaction Notes & Audit Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction Notes & Audit Reference
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter audit notes or promised clearance dates..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white resize-none"
            />
          </div>

          {/* Auto-generate official printable receipt Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="auto-receipt-check"
              checked={autoGenerateReceipt}
              onChange={(e) => setAutoGenerateReceipt(e.target.checked)}
              className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="auto-receipt-check" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Auto-generate official printable receipt (<span className="text-orange-600 font-bold">{nextReceiptNumber}</span>)
            </label>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm & Issue Receipt</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
