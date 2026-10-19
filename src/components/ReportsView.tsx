import React from 'react';
import { FileText } from 'lucide-react';
import { PropertyUnit, PaymentRecord, DepositRecord } from '../types';
import { TenantStatementReport } from './TenantStatementReport';

interface ReportsViewProps {
  units: PropertyUnit[];
  payments: PaymentRecord[];
  deposits?: DepositRecord[];
  onSelectReceiptForPrint?: (payment: PaymentRecord) => void;
}

// Tenant payment reports: per-tenant statements, period filters and printing.
// Portfolio-wide charts and tables live in AnalyticsView.
export const ReportsView: React.FC<ReportsViewProps> = ({
  units,
  payments,
  deposits = [],
  onSelectReceiptForPrint
}) => {
  return (
    <div id="reports-view" className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
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

      <TenantStatementReport
        units={units}
        payments={payments}
        deposits={deposits}
        onSelectReceiptForPrint={onSelectReceiptForPrint}
      />
    </div>
  );
};
