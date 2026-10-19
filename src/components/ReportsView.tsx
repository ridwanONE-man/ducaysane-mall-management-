import React from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { PropertyUnit, PaymentRecord, DepositRecord } from '../types';
import { TenantStatementReport } from './TenantStatementReport';

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
    <div id="reports-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tenant Payment Reports
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Select any tenant, filter by month, year or custom dates, and print statements or receipts.
          </p>
        </div>

        {onClearAllPayments && (
          <button
            type="button"
            disabled={payments.length === 0}
            onClick={() => {
              if (window.confirm(`Delete ALL ${payments.length} payment records for every tenant? This cannot be undone.`)) {
                onClearAllPayments();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Payments</span>
          </button>
        )}
      </div>

      <TenantStatementReport
        units={units}
        payments={payments}
        deposits={deposits}
        onSelectReceiptForPrint={onSelectReceiptForPrint}
        onDeletePayment={onDeletePayment}
      />
    </div>
  );
};
