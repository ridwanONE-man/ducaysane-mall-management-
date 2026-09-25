export type NavigationTab = 
  | 'dashboard' 
  | 'units' 
  | 'occupancy'
  | 'tenants' 
  | 'payments' 
  | 'deposits' 
  | 'cashflow' 
  | 'receipts' 
  | 'reports' 
  | 'analytics' 
  | 'notifications' 
  | 'settings';

export type CurrencyMode = 'ALL' | 'USD' | 'SSP' | 'DUAL';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  lastLogin: string;
}

export type UnitType = 'Shop' | 'Space' | 'Standard Shop' | 'Open Atrium Space' | 'Kiosk' | 'Corner Unit' | 'Anchor Store';
export type OccupancyStatus = 'Occupied' | 'Available' | 'Reserved' | 'Maintenance';
export type BillingStatus = 'Paid' | 'Partially Paid' | 'Overdue' | 'No Balance';

export interface TenantInfo {
  id: string;
  name: string;
  trade: string;
  code: string; // e.g. TNT-9082
  phone: string;
  email: string;
  unitNumber?: string;
  contactPerson?: string;
  balanceUSD: number;
  balanceSSP: number;
  balanceStatus?: 'Current' | 'Overdue' | 'Partial';
  leaseStart?: string;
  leaseEnd?: string;
  daysRemaining?: number;
  status: 'Active' | 'Under Notice' | 'Pending Renewal';
  joinDate?: string;
}

export interface PropertyUnit {
  id: string;
  unitNumber: string; // e.g. "G001" or "BW-1-A"
  codeBadge: string; // e.g. "G001" or "BW-1-A"
  floor: 'Ground Floor' | 'Floor 1' | 'Floor 2' | 'Floor 3';
  type: UnitType;
  categoryType?: 'Shop' | 'Space';
  subType: string; // e.g. "Retail Shop", "Open Space", "Commercial"
  sizeSqM: number;
  sizeSqFt: number;
  meterNumber: string; // e.g. "MTR-8821" or "2 meter"
  currentTenant?: TenantInfo;
  monthlyRateUSD: number;
  monthlyRateSSP: number;
  escrowDepositUSD: number;
  escrowDepositSSP: number;
  leaseStart?: string;
  leaseEnd?: string;
  leaseTermMonths?: number;
  daysToExpiry?: number;
  daysRemaining?: number;
  occupancyStatus: OccupancyStatus;
  billingStatus: BillingStatus;
  billingMonthText?: string;
  arrearsUSD: number;
  arrearsSSP: number;
  footfallBadge?: string;
  notes?: string;
  maintenanceReason?: string;
}

export type PaymentMethodType = 
  | 'Cash (Office Management Desk)'
  | 'EVC Plus / Mobile Money'
  | 'Bank Wire Transfer'
  | 'Cheque / Slip';

export interface PaymentRecord {
  id: string;
  receiptNumber: string; // e.g. "#RCP-2024-894"
  tenantName: string;
  tenantId: string;
  unitNumber: string;
  unitSpace: string; // e.g. "Unit G-012 (Ground Floor Shop) 64 m²"
  date: string; // e.g. "Oct 24, 2024"
  accountingPeriod: string; // e.g. "October 2024"
  currency: 'USD' | 'SSP';
  amount: number;
  paymentMethod: PaymentMethodType;
  monthlyBaseRent: number;
  previousArrears: number;
  totalDue: number;
  remainingBalance: number;
  advanceBalance: number;
  status: 'Paid' | 'Partially Paid' | 'Pending Review';
  notes?: string;
  receivedBy?: string;
}

export interface DepositRecord {
  id: string;
  depositSlip?: string; // e.g. "DEP-2024-08"
  tenantName: string;
  tenantId?: string;
  unitNumber: string;
  amountUSD: number;
  amountSSP: number;
  currency?: 'USD' | 'SSP' | 'DUAL';
  heldSince: string;
  status: 'Held in Escrow' | 'Under Review' | 'Refunded';
  bankAccount: string;
  interestEarned?: number;
  notes?: string;
}

export type CashflowCategory = 
  | 'Rent Collection' 
  | 'Escrow Deposit' 
  | 'Utilities Surcharge' 
  | 'Kiosk Permit' 
  | 'Diesel & Generator' 
  | 'Security & Guards' 
  | 'Cleaning & Waste' 
  | 'Repairs & Maintenance' 
  | 'Taxes & Licensing' 
  | 'Staff Payroll';

export interface CashflowTransaction {
  id: string;
  referenceNumber: string; // e.g. "CF-2024-114"
  date: string;
  title: string;
  category: CashflowCategory;
  type: 'Inflow' | 'Outflow';
  amount: number;
  currency: 'USD' | 'SSP';
  account: 'Central Vault Cash Float' | 'Stanbic Bank Operating' | 'Ecobank Operating' | 'Escrow Trust Account';
  recordedBy: string;
  status: 'Completed' | 'Pending Verification';
  notes?: string;
}

export interface NotificationAlert {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'arrears' | 'lease' | 'maintenance' | 'payment' | 'system';
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface CommercialNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'arrears' | 'lease' | 'maintenance' | 'payment';
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface MallSettings {
  mallName: string;
  companyName?: string;
  activeBuilding?: string;
  address?: string;
  baseCurrency?: 'USD' | 'SSP';
  exchangeRate?: number; // 1 USD = 1,300 SSP
  exchangeRateUSDtoSSP?: number;
  standardSecurityDepositMonths?: number;
  currencyMode?: CurrencyMode;
  totalGFA?: number; // 18,458 sq.m
  officePhone?: string;
  officeEmail?: string;
  contactPhone?: string;
  contactEmail?: string;
  managerName?: string;
}
