import { supabase } from './supabase';
import { 
  PropertyUnit, 
  PaymentRecord, 
  DepositRecord, 
  CashflowTransaction, 
  TenantInfo 
} from '../types';

// ==========================================
// 1. MAPPING FUNCTIONS
// ==========================================

export function mapRowToUnit(row: any): PropertyUnit {
  const sizeM = Number(row.gross_area_sqm || row.usable_area_sqm) || 35;
  const unitNum = row.unit_number || 'Unit G-000';
  const digits = unitNum.replace(/\D/g, '') || '101';
  
  const hasTenant = Boolean(row.current_tenant && String(row.current_tenant).trim().length > 0);
  const currentTenant: TenantInfo | undefined = hasTenant ? {
    id: `t-${row.id}`,
    name: String(row.current_tenant),
    trade: row.tenant_trade || 'Commercial Retail',
    code: row.tenant_code || `TNT-${digits}`,
    phone: row.tenant_phone || '+211 92 000 0000',
    email: row.tenant_email || 'tenant@nyakuron.com',
    unitNumber: unitNum,
    balanceUSD: Number(row.arrears_usd) || 0,
    balanceSSP: Number(row.arrears_ssp) || 0,
    balanceStatus: Number(row.arrears_usd) > 0 || Number(row.arrears_ssp) > 0 ? 'Overdue' : 'Current',
    status: 'Active',
    leaseEnd: row.lease_end || 'Dec 31, 2025',
  } : undefined;

  return {
    id: row.id,
    unitNumber: unitNum,
    codeBadge: row.code_badge || unitNum.replace('Unit ', ''),
    floor: row.floor || 'Ground Floor',
    type: (row.type as any) || (row.category as any) || 'Standard Shop',
    subType: row.sub_type || 'Retail Space',
    sizeSqM: sizeM,
    sizeSqFt: Math.round(sizeM * 10.764 * 10) / 10,
    meterNumber: row.meter_number || `MTR-${digits}`,
    currentTenant,
    monthlyRateUSD: Number(row.monthly_rate_usd) || 0,
    monthlyRateSSP: Number(row.monthly_rate_ssp) || 0,
    escrowDepositUSD: Number(row.escrow_deposit_usd ?? row.security_deposit_usd) || 0,
    escrowDepositSSP: Number(row.escrow_deposit_ssp ?? row.security_deposit_ssp) || 0,
    leaseStart: row.lease_start || undefined,
    leaseEnd: row.lease_end || undefined,
    occupancyStatus: (row.occupancy_status as any) || (hasTenant ? 'Occupied' : 'Available'),
    billingStatus: (row.billing_status as any) || (hasTenant ? 'Paid' : 'No Balance'),
    billingMonthText: row.billing_month_text || (hasTenant ? 'Paid' : undefined),
    arrearsUSD: Number(row.arrears_usd) || 0,
    arrearsSSP: Number(row.arrears_ssp) || 0,
    footfallBadge: row.footfall_badge || undefined,
    notes: row.notes || undefined,
  };
}

export function mapUnitToRow(unit: PropertyUnit) {
  return {
    id: unit.id,
    unit_number: unit.unitNumber,
    floor: unit.floor,
    type: unit.type,
    sub_type: unit.subType || 'Retail Space',
    category: unit.type,
    code_badge: unit.codeBadge || unit.unitNumber.replace('Unit ', ''),
    meter_number: unit.meterNumber || `MTR-${unit.unitNumber.replace(/\D/g, '') || '101'}`,
    gross_area_sqm: unit.sizeSqM,
    usable_area_sqm: unit.sizeSqM,
    occupancy_status: unit.occupancyStatus,
    billing_status: unit.billingStatus || (unit.occupancyStatus === 'Occupied' ? 'Paid' : 'No Balance'),
    billing_month_text: unit.billingMonthText || null,
    monthly_rate_usd: unit.monthlyRateUSD || 0,
    monthly_rate_ssp: unit.monthlyRateSSP || 0,
    security_deposit_usd: unit.escrowDepositUSD || 0,
    security_deposit_ssp: unit.escrowDepositSSP || 0,
    escrow_deposit_usd: unit.escrowDepositUSD || 0,
    escrow_deposit_ssp: unit.escrowDepositSSP || 0,
    arrears_usd: unit.arrearsUSD || 0,
    arrears_ssp: unit.arrearsSSP || 0,
    current_tenant: unit.currentTenant?.name || null,
    tenant_phone: unit.currentTenant?.phone || null,
    tenant_email: unit.currentTenant?.email || null,
    tenant_trade: unit.currentTenant?.trade || null,
    tenant_code: unit.currentTenant?.code || null,
    lease_start: unit.leaseStart || null,
    lease_end: unit.leaseEnd || null,
    footfall_badge: unit.footfallBadge || null,
    notes: unit.notes || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapRowToPayment(row: any): PaymentRecord {
  return {
    id: row.id,
    receiptNumber: row.receipt_number || `#RCP-${row.id}`,
    tenantName: row.tenant_name || 'Commercial Tenant',
    tenantId: row.tenant_id || `t-${row.id}`,
    unitNumber: row.unit_number || 'Unit G-001',
    unitSpace: row.unit_space || `Unit ${row.unit_number || ''}`,
    date: row.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    accountingPeriod: row.accounting_period || 'Current Period',
    currency: (row.currency as 'USD' | 'SSP') || 'USD',
    amount: Number(row.amount) || 0,
    paymentMethod: row.payment_method || 'Cash (Office Management Desk)',
    monthlyBaseRent: Number(row.monthly_base_rent) || Number(row.amount) || 0,
    previousArrears: Number(row.previous_arrears) || 0,
    totalDue: Number(row.total_due) || Number(row.amount) || 0,
    remainingBalance: Number(row.remaining_balance) || 0,
    advanceBalance: Number(row.advance_balance) || 0,
    status: (row.status as any) || 'Paid',
    notes: row.notes || undefined,
    receivedBy: row.received_by || undefined,
  };
}

export function mapPaymentToRow(payment: PaymentRecord) {
  return {
    id: payment.id,
    receipt_number: payment.receiptNumber || `#RCP-${Date.now()}`,
    unit_id: payment.tenantId || null,
    unit_number: payment.unitNumber || 'Unit G-001',
    tenant_name: payment.tenantName || 'Commercial Tenant',
    tenant_id: payment.tenantId || null,
    unit_space: payment.unitSpace || payment.unitNumber,
    date: payment.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    accounting_period: payment.accountingPeriod || 'Current Period',
    currency: payment.currency || 'USD',
    amount: payment.amount || 0,
    payment_method: payment.paymentMethod || 'Cash (Office Management Desk)',
    monthly_base_rent: payment.monthlyBaseRent || payment.amount || 0,
    previous_arrears: payment.previousArrears || 0,
    total_due: payment.totalDue || payment.amount || 0,
    remaining_balance: payment.remainingBalance || 0,
    advance_balance: payment.advanceBalance || 0,
    status: payment.status || 'Paid',
    notes: payment.notes || null,
    received_by: payment.receivedBy || 'Mohamed Mohamoud (Management In-Charge)',
  };
}

export function mapRowToDeposit(row: any): DepositRecord {
  const amtUSD = Number(row.amount_usd) || 0;
  const amtSSP = Number(row.amount_ssp) || 0;
  return {
    id: row.id,
    depositSlip: row.receipt_number || `DEP-${row.id}`,
    tenantName: row.tenant_name || 'Commercial Tenant',
    tenantId: `t-${row.id}`,
    unitNumber: row.unit_number || 'Unit G-001',
    amountUSD: amtUSD,
    amountSSP: amtSSP,
    currency: amtUSD > 0 && amtSSP > 0 ? 'DUAL' : amtUSD > 0 ? 'USD' : 'SSP',
    heldSince: row.deposit_date || 'Oct 2024',
    status: (row.status as any) || 'Held in Escrow',
    bankAccount: row.bank_account || 'Stanbic Bank - Escrow Liability #8892-01',
    notes: row.notes || undefined,
  };
}

export function mapDepositToRow(dep: DepositRecord) {
  return {
    id: dep.id,
    receipt_number: dep.depositSlip || `DEP-${Date.now()}`,
    unit_number: dep.unitNumber || null,
    tenant_name: dep.tenantName || null,
    amount_usd: dep.amountUSD || 0,
    amount_ssp: dep.amountSSP || 0,
    deposit_date: dep.heldSince || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    bank_account: dep.bankAccount || null,
    status: dep.status || 'Held in Escrow',
    notes: dep.notes || null,
  };
}

export function mapRowToCashflow(row: any): CashflowTransaction {
  return {
    id: row.id,
    referenceNumber: row.reference_number || `CF-${row.id}`,
    date: row.date || 'Oct 2024',
    title: row.title || 'Transaction Voucher',
    category: (row.category as any) || 'Rent Collection',
    type: (row.type as any) || 'Inflow',
    amount: Number(row.amount) || 0,
    currency: (row.currency as any) || 'USD',
    account: (row.account as any) || 'Central Vault Cash Float',
    recordedBy: row.recorded_by || 'Mohamed Mohamoud',
    status: (row.status as any) || 'Completed',
    notes: row.notes || undefined,
  };
}

export function mapCashflowToRow(item: CashflowTransaction) {
  return {
    id: item.id,
    reference_number: item.referenceNumber || `CF-${Date.now()}`,
    date: item.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    title: item.title,
    category: item.category,
    type: item.type,
    amount: item.amount,
    currency: item.currency,
    account: item.account,
    recorded_by: item.recordedBy || 'Mohamed Mohamoud',
    status: item.status || 'Completed',
    notes: item.notes || null,
  };
}

// ==========================================
// 2. UNITS API
// ==========================================

export async function getUnitsFromSupabase(): Promise<PropertyUnit[]> {
  try {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('unit_number', { ascending: true });

    if (error) {
      console.warn('Could not load units from Supabase:', error.message);
      return [];
    }
    return (data || []).map(mapRowToUnit);
  } catch (err) {
    console.warn('Network error loading units from Supabase:', err);
    return [];
  }
}

export async function saveUnitToSupabase(unit: PropertyUnit): Promise<boolean> {
  try {
    const row = mapUnitToRow(unit);
    const { error } = await supabase
      .from('units')
      .upsert(row);

    if (error) {
      console.warn('Could not save unit to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error saving unit to Supabase:', err);
    return false;
  }
}

export async function saveUnitsBulkToSupabase(units: PropertyUnit[]): Promise<boolean> {
  if (!units.length) return true;
  try {
    const rows = units.map(mapUnitToRow);
    const { error } = await supabase
      .from('units')
      .upsert(rows);

    if (error) {
      console.warn('Could not bulk save units to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error bulk saving units to Supabase:', err);
    return false;
  }
}

export async function deleteUnitFromSupabase(unitId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', unitId);

    if (error) {
      console.warn('Could not delete unit from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error deleting unit from Supabase:', err);
    return false;
  }
}

// ==========================================
// 3. PAYMENTS API
// ==========================================

export async function getPaymentsFromSupabase(): Promise<PaymentRecord[]> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load payments from Supabase:', error.message);
      return [];
    }
    return (data || []).map(mapRowToPayment);
  } catch (err) {
    console.warn('Network error loading payments from Supabase:', err);
    return [];
  }
}

export async function savePaymentToSupabase(payment: PaymentRecord): Promise<boolean> {
  try {
    const row = mapPaymentToRow(payment);
    const { error } = await supabase
      .from('payments')
      .upsert(row);

    if (error) {
      console.warn('Could not save payment to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error saving payment to Supabase:', err);
    return false;
  }
}

export async function savePaymentsBulkToSupabase(payments: PaymentRecord[]): Promise<boolean> {
  if (!payments.length) return true;
  try {
    const rows = payments.map(mapPaymentToRow);
    const { error } = await supabase
      .from('payments')
      .upsert(rows);

    if (error) {
      console.warn('Could not bulk save payments to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error bulk saving payments to Supabase:', err);
    return false;
  }
}

// ==========================================
// 4. DEPOSITS API
// ==========================================

export async function getDepositsFromSupabase(): Promise<DepositRecord[]> {
  try {
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load deposits from Supabase:', error.message);
      return [];
    }
    return (data || []).map(mapRowToDeposit);
  } catch (err) {
    console.warn('Network error loading deposits from Supabase:', err);
    return [];
  }
}

export async function saveDepositToSupabase(deposit: DepositRecord): Promise<boolean> {
  try {
    const row = mapDepositToRow(deposit);
    const { error } = await supabase
      .from('deposits')
      .upsert(row);

    if (error) {
      console.warn('Could not save deposit to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error saving deposit to Supabase:', err);
    return false;
  }
}

export async function saveDepositsBulkToSupabase(deposits: DepositRecord[]): Promise<boolean> {
  if (!deposits.length) return true;
  try {
    const rows = deposits.map(mapDepositToRow);
    const { error } = await supabase
      .from('deposits')
      .upsert(rows);

    if (error) {
      console.warn('Could not bulk save deposits to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error bulk saving deposits to Supabase:', err);
    return false;
  }
}

export async function deleteDepositFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deposits')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Could not delete deposit from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error deleting deposit from Supabase:', err);
    return false;
  }
}

// ==========================================
// 5. CASHFLOW API
// ==========================================

export async function getCashflowFromSupabase(): Promise<CashflowTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('cashflow_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load cashflow from Supabase:', error.message);
      return [];
    }
    return (data || []).map(mapRowToCashflow);
  } catch (err) {
    console.warn('Network error loading cashflow from Supabase:', err);
    return [];
  }
}

export async function saveCashflowToSupabase(item: CashflowTransaction): Promise<boolean> {
  try {
    const row = mapCashflowToRow(item);
    const { error } = await supabase
      .from('cashflow_transactions')
      .upsert(row);

    if (error) {
      console.warn('Could not save cashflow to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error saving cashflow to Supabase:', err);
    return false;
  }
}

export async function saveCashflowsBulkToSupabase(items: CashflowTransaction[]): Promise<boolean> {
  if (!items.length) return true;
  try {
    const rows = items.map(mapCashflowToRow);
    const { error } = await supabase
      .from('cashflow_transactions')
      .upsert(rows);

    if (error) {
      console.warn('Could not bulk save cashflows to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error bulk saving cashflows to Supabase:', err);
    return false;
  }
}

export async function deleteCashflowFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cashflow_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Could not delete cashflow from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error deleting cashflow from Supabase:', err);
    return false;
  }
}

// ==========================================
// 6. CLEAR ALL DATA
// ==========================================

export async function clearAllSupabaseData(): Promise<boolean> {
  try {
    await supabase.from('payments').delete().neq('id', '___');
    await supabase.from('deposits').delete().neq('id', '___');
    await supabase.from('cashflow_transactions').delete().neq('id', '___');
    await supabase.from('units').delete().neq('id', '___');
    return true;
  } catch (err) {
    console.warn('Network error clearing Supabase data:', err);
    return false;
  }
}

// ==========================================
// 7. REALTIME SYNCHRONIZATION
// ==========================================

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RealtimeCallbacks {
  onUnitChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', unit: PropertyUnit, oldId?: string) => void;
  onPaymentChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', payment: PaymentRecord, oldId?: string) => void;
  onDepositChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', deposit: DepositRecord, oldId?: string) => void;
  onCashflowChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', tx: CashflowTransaction, oldId?: string) => void;
  onStatusChange?: (status: RealtimeStatus) => void;
}

export function subscribeToRealtimeChanges(callbacks: RealtimeCallbacks) {
  callbacks.onStatusChange?.('connecting');

  const channel = supabase
    .channel('nbc-live-sync-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'units' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) callbacks.onUnitChange?.('DELETE', { id: oldId } as PropertyUnit, oldId);
        } else if (payload.new) {
          const unit = mapRowToUnit(payload.new);
          callbacks.onUnitChange?.(payload.eventType as 'INSERT' | 'UPDATE', unit);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payments' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) callbacks.onPaymentChange?.('DELETE', { id: oldId } as PaymentRecord, oldId);
        } else if (payload.new) {
          const payment = mapRowToPayment(payload.new);
          callbacks.onPaymentChange?.(payload.eventType as 'INSERT' | 'UPDATE', payment);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'deposits' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) callbacks.onDepositChange?.('DELETE', { id: oldId } as DepositRecord, oldId);
        } else if (payload.new) {
          const deposit = mapRowToDeposit(payload.new);
          callbacks.onDepositChange?.(payload.eventType as 'INSERT' | 'UPDATE', deposit);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cashflow_transactions' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) callbacks.onCashflowChange?.('DELETE', { id: oldId } as CashflowTransaction, oldId);
        } else if (payload.new) {
          const tx = mapRowToCashflow(payload.new);
          callbacks.onCashflowChange?.(payload.eventType as 'INSERT' | 'UPDATE', tx);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        callbacks.onStatusChange?.('connected');
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.warn('Realtime channel error:', status, err);
        callbacks.onStatusChange?.('error');
      } else if (status === 'CLOSED') {
        callbacks.onStatusChange?.('disconnected');
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

// ==========================================
// 8. ADMIN CREDENTIALS
// ==========================================

export interface AdminCredentials {
  email: string;
  password: string;
  name: string;
  role: string;
}

export const DEFAULT_ADMIN: AdminCredentials = {
  email: 'admin@nyakuron.com',
  password: 'admin',
  name: 'Mohamed Mohamoud',
  role: 'Super Admin',
};

export async function getAdminCredentials(): Promise<AdminCredentials> {
  try {
    const { data, error } = await supabase
      .from('admin_credentials')
      .select('*')
      .eq('id', 'admin-1')
      .single();

    if (error || !data) {
      const cachedPwd = localStorage.getItem('nbc_admin_pwd');
      return {
        ...DEFAULT_ADMIN,
        password: cachedPwd || DEFAULT_ADMIN.password,
      };
    }

    localStorage.setItem('nbc_admin_pwd', data.password);
    return {
      email: data.email || DEFAULT_ADMIN.email,
      password: data.password || DEFAULT_ADMIN.password,
      name: data.name || DEFAULT_ADMIN.name,
      role: data.role || DEFAULT_ADMIN.role,
    };
  } catch {
    const cachedPwd = localStorage.getItem('nbc_admin_pwd');
    return {
      ...DEFAULT_ADMIN,
      password: cachedPwd || DEFAULT_ADMIN.password,
    };
  }
}

export async function updateAdminPassword(newPassword: string): Promise<boolean> {
  try {
    localStorage.setItem('nbc_admin_pwd', newPassword);

    const { error } = await supabase
      .from('admin_credentials')
      .update({ 
        password: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'admin-1');

    if (error) {
      console.warn('Could not update password in Supabase:', error.message);
    }
    return true;
  } catch (err) {
    console.warn('Network error updating password in Supabase:', err);
    return true;
  }
}
