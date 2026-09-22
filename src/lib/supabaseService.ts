import { supabase } from './supabase';
import { PropertyUnit, PaymentRecord } from '../types';

// Map database row to PropertyUnit
export function mapRowToUnit(row: any): PropertyUnit {
  const sizeM = Number(row.gross_area_sqm || row.size_sqm) || 35;
  return {
    id: row.id,
    unitNumber: row.unit_number,
    codeBadge: row.code_badge || row.unit_number.replace('Unit ', ''),
    floor: row.floor || 'Ground Floor',
    type: (row.type as any) || 'Shop',
    subType: row.sub_type || 'Retail',
    sizeSqM: sizeM,
    sizeSqFt: Math.round(sizeM * 10.764),
    meterNumber: row.meter_number || `MTR-${row.unit_number.replace(/\D/g, '') || '101'}`,
    currentTenant: row.current_tenant ? {
      id: `t-${row.id}`,
      name: row.current_tenant,
      trade: row.tenant_trade || 'Retail',
      code: `TNT-${row.unit_number.replace(/\D/g, '') || '101'}`,
      phone: row.tenant_phone || '',
      email: row.tenant_email || '',
      balanceUSD: Number(row.arrears_usd) || 0,
      balanceSSP: Number(row.arrears_ssp) || 0,
      status: 'Active'
    } : undefined,
    monthlyRateUSD: Number(row.monthly_rate_usd) || 0,
    monthlyRateSSP: Number(row.monthly_rate_ssp) || 0,
    escrowDepositUSD: Number(row.escrow_deposit_usd) || 0,
    escrowDepositSSP: Number(row.escrow_deposit_ssp) || 0,
    leaseStart: row.lease_start || undefined,
    leaseEnd: row.lease_end || undefined,
    occupancyStatus: row.occupancy_status || 'Available',
    billingStatus: (row.billing_status as any) || 'Paid',
    billingMonthText: row.billing_month_text || undefined,
    arrearsUSD: Number(row.arrears_usd) || 0,
    arrearsSSP: Number(row.arrears_ssp) || 0,
    footfallBadge: row.footfall_badge || undefined,
    notes: row.notes || undefined,
  };
}

// Map PropertyUnit to database row
export function mapUnitToRow(unit: PropertyUnit) {
  return {
    id: unit.id,
    unit_number: unit.unitNumber,
    floor: unit.floor,
    gross_area_sqm: unit.sizeSqM,
    usable_area_sqm: unit.sizeSqM,
    occupancy_status: unit.occupancyStatus,
    monthly_rate_usd: unit.monthlyRateUSD,
    monthly_rate_ssp: unit.monthlyRateSSP,
    current_tenant: unit.currentTenant?.name || null,
    tenant_phone: unit.currentTenant?.phone || null,
    tenant_email: unit.currentTenant?.email || null,
    tenant_trade: unit.currentTenant?.trade || null,
    lease_start: unit.leaseStart || null,
    lease_end: unit.leaseEnd || null,
    arrears_usd: unit.arrearsUSD,
    arrears_ssp: unit.arrearsSSP,
    escrow_deposit_usd: unit.escrowDepositUSD,
    escrow_deposit_ssp: unit.escrowDepositSSP,
  };
}

// Map database row to PaymentRecord
export function mapRowToPayment(row: any): PaymentRecord {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    tenantName: row.tenant_name,
    tenantId: row.tenant_id || `t-${row.id}`,
    unitNumber: row.unit_number,
    unitSpace: row.unit_space || `Unit ${row.unit_number}`,
    date: row.date,
    accountingPeriod: row.accounting_period,
    currency: row.currency as 'USD' | 'SSP',
    amount: Number(row.amount) || 0,
    paymentMethod: row.payment_method,
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

// Map PaymentRecord to database row
export function mapPaymentToRow(payment: PaymentRecord) {
  return {
    id: payment.id,
    receipt_number: payment.receiptNumber,
    tenant_name: payment.tenantName,
    tenant_id: payment.tenantId,
    unit_number: payment.unitNumber,
    unit_space: payment.unitSpace,
    date: payment.date,
    accounting_period: payment.accountingPeriod,
    currency: payment.currency,
    amount: payment.amount,
    payment_method: payment.paymentMethod,
    monthly_base_rent: payment.monthlyBaseRent,
    previous_arrears: payment.previousArrears,
    total_due: payment.totalDue,
    remaining_balance: payment.remainingBalance,
    advance_balance: payment.advanceBalance,
    status: payment.status,
    notes: payment.notes || null,
    received_by: payment.receivedBy || null,
  };
}

// API Functions
export async function getUnitsFromSupabase(): Promise<PropertyUnit[]> {
  try {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('created_at', { ascending: false });

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

export async function clearAllSupabaseData(): Promise<boolean> {
  try {
    await supabase.from('payments').delete().neq('id', '___');
    await supabase.from('units').delete().neq('id', '___');
    return true;
  } catch (err) {
    console.warn('Network error clearing Supabase data:', err);
    return false;
  }
}

export interface AdminCredentials {
  email: string;
  password: string;
  name: string;
  role: string;
}

export const DEFAULT_ADMIN: AdminCredentials = {
  email: 'ducaysane@gmail.com',
  password: 'ducaysane1212',
  name: 'Ahmed Ducaysane',
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
      const cachedPwd = localStorage.getItem('ducaysane_admin_pwd');
      return {
        ...DEFAULT_ADMIN,
        password: cachedPwd || DEFAULT_ADMIN.password,
      };
    }

    localStorage.setItem('ducaysane_admin_pwd', data.password);
    return {
      email: data.email || DEFAULT_ADMIN.email,
      password: data.password || DEFAULT_ADMIN.password,
      name: data.name || DEFAULT_ADMIN.name,
      role: data.role || DEFAULT_ADMIN.role,
    };
  } catch {
    const cachedPwd = localStorage.getItem('ducaysane_admin_pwd');
    return {
      ...DEFAULT_ADMIN,
      password: cachedPwd || DEFAULT_ADMIN.password,
    };
  }
}

export async function updateAdminPassword(newPassword: string): Promise<boolean> {
  try {
    localStorage.setItem('ducaysane_admin_pwd', newPassword);

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
