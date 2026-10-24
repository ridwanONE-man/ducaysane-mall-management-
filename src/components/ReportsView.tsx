import React from 'react';
import { FileText } from 'lucide-react';
import { PropertyUnit, PaymentRecord, DepositRecord } from '../types';
import { TenantReport } from './TenantReport';
import { ClearAllButton } from './DeleteControls';

interface ReportsViewProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
  deposits?: DepositRecord[];
  onSelectReceiptForPrint?: (payment: PaymentRecord) => void;
  onDeletePayment?: (payment: PaymentRecord) => void;
  onClearAllPayments?: () => void;
}

// Tenant payment reports: per-tenant statements, period filters and printing.
// Portfolio-wide charts and tables live in AnalyticsView.
export const ReportsView: React.FC<ReportsViewProps> = ({
  units,
  payments,
  deposits = [],
  onSelectReceiptForPrint,
  onDeletePayment,
  onClearAllPayments
}) => {
  return (
    <div id="reports-view" className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/25">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tenant Reports
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Open a tenant to see paid, partly paid and unpaid months, deposits and receipts — then print the report.
          </p>
        </div>

        {onClearAllPayments && (
          <ClearAllButton count={payments.length} itemLabel="payments" onClear={onClearAllPayments} />
        )}
      </div>

      <TenantReport
        units={units}
        payments={payments}
        deposits={deposits}
        onSelectReceiptForPrint={onSelectReceiptForPrint}
        onDeletePayment={onDeletePayment}
      />
    </div>
  );
};
