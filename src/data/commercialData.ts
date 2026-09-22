import { 
  PropertyUnit, 
  PaymentRecord, 
  DepositRecord, 
  NotificationAlert, 
  MallSettings,
  TenantInfo,
  CommercialNotification,
  CashflowTransaction
} from '../types';

export const initialSettings: MallSettings = {
  mallName: 'Juba Central Mall',
  companyName: 'MallCore ENTERPRISE CRE',
  activeBuilding: 'Juba Central Mall',
  exchangeRate: 1300, // 1 USD = 1,300 SSP
  currencyMode: 'ALL',
  totalGFA: 18458,
  officePhone: '+211 922 400 888',
  officeEmail: 'management@jubacentral.com',
  managerName: 'D. Deng Bol'
};

export const defaultMallSettings: MallSettings = {
  mallName: 'Juba Central Mall',
  address: 'Plot 14, Commercial District, Juba, South Sudan',
  contactPhone: '+211 922 400 888',
  contactEmail: 'leasing@jubacentralmall.com',
  baseCurrency: 'USD',
  exchangeRateUSDtoSSP: 1300,
  standardSecurityDepositMonths: 2
};

// All initial datasets are empty for fresh user testing
export const initialTenants: TenantInfo[] = [];

export const initialUnits: PropertyUnit[] = [];

export const initialPayments: PaymentRecord[] = [];

export const initialDeposits: DepositRecord[] = [];

export const initialNotifications: NotificationAlert[] = [];

export const initialCommercialNotifications: CommercialNotification[] = [];

export const monthlyCollectionData: { month: string; usd: number; ssp: number; target: number; overdue: number }[] = [];

export const initialCashflowTransactions: CashflowTransaction[] = [];
