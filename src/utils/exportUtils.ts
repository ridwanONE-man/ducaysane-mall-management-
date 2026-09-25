import { PropertyUnit, PaymentRecord } from '../types';

export function formatCurrency(amount: number, currency: 'USD' | 'SSP'): string {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} SSP`;
}

export function exportUnitsToCSV(units: PropertyUnit[]) {
  const headers = [
    'Unit Number',
    'Floor',
    'Type',
    'Sub-Type',
    'Size (sq.m)',
    'Size (sq.ft)',
    'Meter Number',
    'Tenant Name',
    'Tenant ID',
    'Monthly Rate (USD)',
    'Monthly Rate (SSP)',
    'Deposit (USD)',
    'Lease Start',
    'Lease End',
    'Occupancy Status',
    'Billing Status',
    'Arrears (USD)'
  ];

  const rows = units.map(u => [
    `"${u.unitNumber}"`,
    `"${u.floor}"`,
    `"${u.type}"`,
    `"${u.subType}"`,
    u.sizeSqM,
    u.sizeSqFt,
    `"${u.meterNumber}"`,
    `"${u.currentTenant?.name || 'Vacant'}"`,
    `"${u.currentTenant?.code || 'N/A'}"`,
    u.monthlyRateUSD,
    u.monthlyRateSSP,
    u.escrowDepositUSD,
    `"${u.leaseStart || 'N/A'}"`,
    `"${u.leaseEnd || 'N/A'}"`,
    `"${u.occupancyStatus}"`,
    `"${u.billingStatus}"`,
    u.arrearsUSD
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `NBC_Units_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportPaymentsToCSV(payments: PaymentRecord[]) {
  const headers = [
    'Receipt #',
    'Date',
    'Tenant Name',
    'Tenant ID',
    'Unit Number',
    'Accounting Period',
    'Currency',
    'Amount',
    'Payment Method',
    'Base Rent',
    'Remaining Balance',
    'Status',
    'Received By'
  ];

  const rows = payments.map(p => [
    `"${p.receiptNumber}"`,
    `"${p.date}"`,
    `"${p.tenantName}"`,
    `"${p.tenantId}"`,
    `"${p.unitNumber}"`,
    `"${p.accountingPeriod}"`,
    `"${p.currency}"`,
    p.amount,
    `"${p.paymentMethod}"`,
    p.monthlyBaseRent,
    p.remainingBalance,
    `"${p.status}"`,
    `"${p.receivedBy || 'Mohamed Mohamoud'}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `NBC_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
