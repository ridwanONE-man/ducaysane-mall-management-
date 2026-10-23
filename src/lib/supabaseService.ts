import { supabase } from './supabase';
import { 
  PropertyUnit, 
  PaymentRecord, 
  DepositRecord, 
  CashflowTransaction, 
  TenantInfo, WaitingEntry, ElectricityEntry } from '../types';

// ==========================================
// 0. VERIFIED DELETES
// ==========================================

type DeletableTable = 'units' | 'payments' | 'deposits' | 'cashflow_transactions' | 'tenants' | 'waiting_list' | 'electricity';

// Supabase reports success even when a row-level-security policy silently blocks a
// delete, so check that the row is really gone before reporting success.
async function deleteRowById(table: DeletableTable, id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
    if (error) {
      console.warn(`Could not delete from ${table}:`, error.message);
      return false;
    }
    if (data && data.length > 0) return true;
    const { data: stillThere } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
    if (stillThere) {
      console.warn(`Delete from ${table} was blocked by the database (row ${id} still exists).`);
      return false;
    }
    return true; // row never existed in the database
  } catch (err) {
    console.warn(`Network error deleting from ${table}:`, err);
    return false;
  }
}

async function clearTable(table: DeletableTable): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).delete().neq('id', '___');
    if (error) {
      console.warn(`Could not clear ${table}:`, error.message);
      return false;
    }
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (count) {
      console.warn(`Clearing ${table} was blocked by the database (${count} rows remain).`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Network error clearing ${table}:`, err);
    return false;
  }
}

// ==========================================
// 1. MAPPING FUNCTIONS
// ==========================================

export function mapRowToUnit(row: any): PropertyUnit {
  const sizeM = Number(row.gross_area_sqm || row.usable_area_sqm) || 35;
  const unitNum = row.unit_number || 'Unit G-000';
  const digits = unitNum.replace(/\D/g, '') || '101';
  
  let daysRemaining = 7;
  if (row.lease_end) {
    const endMs = new Date(row.lease_end).getTime();
    if (!isNaN(endMs)) {
      daysRemaining = Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24));
    }
  }

  const isMarkedAvailable = row.occupancy_status === 'Available';
  const hasTenant = !isMarkedAvailable && Boolean(row.current_tenant && String(row.current_tenant).trim().length > 0);
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
    leaseStart: row.lease_start || undefined,
    leaseEnd: row.lease_end || 'Dec 31, 2025',
    daysRemaining,
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
    daysRemaining,
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
    // Left empty on purpose: payments.unit_id is a foreign key to units, so linking it would
    // reject payments whose unit isn't in the table and could remove payment history when
    // a unit is deleted. The unit is recorded by unit_number instead.
    unit_id: null,
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

// Returns null (not []) when the database is unreachable, so callers keep what they have.
export async function getUnitsFromSupabase(): Promise<PropertyUnit[] | null> {
  try {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('unit_number', { ascending: true });

    if (error) {
      console.warn('Could not load units from Supabase:', error.message);
      return null;
    }
    return (data || []).map(mapRowToUnit);
  } catch (err) {
    console.warn('Network error loading units from Supabase:', err);
    return null;
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

    // Keep public.tenants in step with the unit's occupant
    try {
      if (unit.currentTenant && unit.occupancyStatus !== 'Available') {
        await supabase.from('tenants').upsert({
          id: `t-${unit.id}`,
          name: unit.currentTenant.name,
          trade: unit.currentTenant.trade,
          unit_number: unit.unitNumber,
          phone: unit.currentTenant.phone,
          email: unit.currentTenant.email,
          status: 'Active',
          balance_usd: unit.arrearsUSD || 0,
          balance_ssp: unit.arrearsSSP || 0,
        });
      } else {
        await supabase.from('tenants').update({ status: 'Vacated' }).eq('id', `t-${unit.id}`);
      }
    } catch (tErr) {
      console.warn('Could not sync tenant for unit to Supabase:', tErr);
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
    const { data: unitData } = await supabase
      .from('units')
      .select('unit_number')
      .eq('id', unitId)
      .maybeSingle();

    if (!(await deleteRowById('units', unitId))) return false;

    // Delete associated tenant from public.tenants table to keep them 100% connected
    try {
      await supabase.from('tenants').delete().eq('id', `t-${unitId}`);
      if (unitData?.unit_number) {
        await supabase.from('tenants').delete().eq('unit_number', unitData.unit_number);
      }
    } catch (tErr) {
      console.warn('Could not delete associated tenant from Supabase:', tErr);
    }

    return true;
  } catch (err) {
    console.warn('Network error deleting unit from Supabase:', err);
    return false;
  }
}

export async function deleteTenantFromUnitInSupabase(
  unitId: string, 
  unitNumber?: string
): Promise<{ success: boolean; unit?: PropertyUnit; error?: string }> {
  try {
    const updateRow = {
      occupancy_status: 'Available',
      current_tenant: null,
      tenant_phone: null,
      tenant_email: null,
      tenant_trade: null,
      tenant_code: null,
      lease_start: null,
      lease_end: null,
      billing_status: 'No Balance',
      billing_month_text: null,
      arrears_usd: 0,
      arrears_ssp: 0,
      notes: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('units')
      .update(updateRow)
      .eq('id', unitId)
      .select()
      .single();

    if (error) {
      console.error('Error clearing tenant from unit in Supabase:', error);
      return { success: false, error: error.message };
    }

    // Delete tenant from public.tenants table so they are removed from tenants page
    try {
      await supabase.from('tenants').delete().eq('id', `t-${unitId}`);
      const targetUnitNumber = unitNumber || data.unit_number;
      if (targetUnitNumber) {
        await supabase.from('tenants').delete().eq('unit_number', targetUnitNumber);
      }
    } catch (tErr) {
      console.warn('Could not delete tenant from tenants table in Supabase:', tErr);
    }

    const updatedUnit = mapRowToUnit(data);
    return { success: true, unit: updatedUnit };
  } catch (err: any) {
    console.error('Network error deleting tenant from unit in Supabase:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

// Removes every tenant: occupied units become Available and public.tenants is emptied.
// Units, payments, deposits and cashflow are NOT touched, so receipts, reports and
// analytics keep their full history.
export async function clearAllTenantsInSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('units')
      .update({
        occupancy_status: 'Available',
        current_tenant: null,
        tenant_phone: null,
        tenant_email: null,
        tenant_trade: null,
        tenant_code: null,
        lease_start: null,
        lease_end: null,
        billing_status: 'No Balance',
        billing_month_text: null,
        arrears_usd: 0,
        arrears_ssp: 0,
        updated_at: new Date().toISOString(),
      })
      .not('current_tenant', 'is', null);

    if (error) {
      console.warn('Could not clear tenants from units in Supabase:', error.message);
      return false;
    }

    const { count } = await supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .not('current_tenant', 'is', null);
    if (count) {
      console.warn(`Clearing tenants was blocked by the database (${count} units still leased).`);
      return false;
    }

    await clearTable('tenants');
    return true;
  } catch (err) {
    console.warn('Network error clearing tenants in Supabase:', err);
    return false;
  }
}

export async function deleteAllUnitsFromSupabase(): Promise<boolean> {
  try {
    const unitsCleared = await clearTable('units');

    // Also delete all tenants from tenants table
    try {
      await supabase
        .from('tenants')
        .delete()
        .neq('id', '___');
    } catch (tErr) {
      console.warn('Could not delete all tenants from Supabase:', tErr);
    }

    return unitsCleared;
  } catch (err) {
    console.warn('Network error deleting all units from Supabase:', err);
    return false;
  }
}

export async function deleteUnitsBulkFromSupabase(unitIds: string[]): Promise<boolean> {
  try {
    if (unitIds.length === 0) return true;

    // Get unit numbers first for tenant cleanup
    const { data: unitsList } = await supabase
      .from('units')
      .select('id, unit_number')
      .in('id', unitIds);

    const { error } = await supabase
      .from('units')
      .delete()
      .in('id', unitIds);

    if (error) {
      console.warn('Could not bulk delete units from Supabase:', error.message);
      return false;
    }

    try {
      const tenantIds = unitIds.map(id => `t-${id}`);
      await supabase.from('tenants').delete().in('id', tenantIds);
      if (unitsList && unitsList.length > 0) {
        const unitNums = unitsList.map(u => u.unit_number).filter(Boolean);
        if (unitNums.length > 0) {
          await supabase.from('tenants').delete().in('unit_number', unitNums);
        }
      }
    } catch (tErr) {
      console.warn('Could not bulk delete tenants from Supabase:', tErr);
    }

    return true;
  } catch (err) {
    console.warn('Network error bulk deleting units from Supabase:', err);
    return false;
  }
}

export interface ModifyTenantPricingPayload {
  tenantName: string;
  trade: string;
  phone: string;
  email: string;
  tenantCode?: string;
  monthlyRateUSD: number;
  monthlyRateSSP: number;
  securityDepositUSD: number;
  securityDepositSSP: number;
  leaseStart?: string;
  leaseEnd?: string;
  billingStatus?: string;
  notes?: string;
}

export async function updateTenantAndPricingInSupabase(
  unitId: string, 
  payload: ModifyTenantPricingPayload
): Promise<{ success: boolean; unit?: PropertyUnit; error?: string }> {
  try {
    const updateRow = {
      current_tenant: payload.tenantName.trim(),
      tenant_trade: payload.trade.trim(),
      tenant_phone: payload.phone.trim(),
      tenant_email: payload.email.trim(),
      tenant_code: payload.tenantCode?.trim() || null,
      monthly_rate_usd: payload.monthlyRateUSD,
      monthly_rate_ssp: payload.monthlyRateSSP,
      security_deposit_usd: payload.securityDepositUSD,
      security_deposit_ssp: payload.securityDepositSSP,
      escrow_deposit_usd: payload.securityDepositUSD,
      escrow_deposit_ssp: payload.securityDepositSSP,
      lease_start: payload.leaseStart || null,
      lease_end: payload.leaseEnd || null,
      billing_status: payload.billingStatus || 'Paid',
      notes: payload.notes || null,
      occupancy_status: 'Occupied',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('units')
      .update(updateRow)
      .eq('id', unitId)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant & price in Supabase:', error);
      return { success: false, error: error.message };
    }

    // Sync to public.tenants table as well
    try {
      await supabase.from('tenants').upsert({
        id: `t-${unitId}`,
        name: payload.tenantName.trim(),
        trade: payload.trade.trim(),
        unit_number: data.unit_number,
        phone: payload.phone.trim(),
        email: payload.email.trim(),
        status: 'Active',
        balance_usd: Number(data.arrears_usd) || 0,
        balance_ssp: Number(data.arrears_ssp) || 0,
        created_at: new Date().toISOString(),
      });
    } catch (tErr) {
      console.warn('Could not sync to tenants table:', tErr);
    }

    const updatedUnit = mapRowToUnit(data);
    return { success: true, unit: updatedUnit };
  } catch (err: any) {
    console.error('Network error modifying tenant & price in Supabase:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

export interface VacateUnitPayload {
  vacatedDate?: string;
  reason?: string;
  notes?: string;
}

export async function vacateUnitInSupabase(
  unitId: string, 
  payload?: VacateUnitPayload
): Promise<{ success: boolean; unit?: PropertyUnit; error?: string }> {
  try {
    const vacateDate = payload?.vacatedDate || new Date().toISOString().slice(0, 10);
    const reasonText = payload?.reason ? `Reason: ${payload.reason}` : '';
    const notesText = payload?.notes ? `Notes: ${payload.notes}` : '';
    const vacateLog = `[Vacated on ${vacateDate}] ${reasonText} ${notesText}`.trim();

    const updateRow = {
      occupancy_status: 'Available',
      current_tenant: null,
      tenant_phone: null,
      tenant_email: null,
      tenant_trade: null,
      tenant_code: null,
      lease_start: null,
      lease_end: null,
      billing_status: 'No Balance',
      billing_month_text: null,
      arrears_usd: 0,
      arrears_ssp: 0,
      notes: vacateLog || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('units')
      .update(updateRow)
      .eq('id', unitId)
      .select()
      .single();

    if (error) {
      console.error('Error vacating unit in Supabase:', error);
      return { success: false, error: error.message };
    }

    // Sync to public.tenants table (update status to Vacated)
    try {
      await supabase
        .from('tenants')
        .update({
          status: 'Vacated'
        })
        .eq('unit_number', data.unit_number);
    } catch (tErr) {
      console.warn('Could not update status in tenants table:', tErr);
    }

    const updatedUnit = mapRowToUnit(data);
    return { success: true, unit: updatedUnit };
  } catch (err: any) {
    console.error('Network error vacating unit in Supabase:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}


// ==========================================
// 3. PAYMENTS API
// ==========================================

// Returns null (not []) when the database is unreachable, so callers keep what they have.
export async function getPaymentsFromSupabase(): Promise<PaymentRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load payments from Supabase:', error.message);
      return null;
    }
    return (data || []).map(mapRowToPayment);
  } catch (err) {
    console.warn('Network error loading payments from Supabase:', err);
    return null;
  }
}

// Fetches the latest payment history for one tenant straight from the database
// (case-insensitive name match; callers narrow it down to the unit).
// Returns null when the database can't be reached so callers can fall back to cached data.
export async function getTenantPaymentsFromSupabase(tenantName: string): Promise<PaymentRecord[] | null> {
  try {
    const escapedName = tenantName.trim().replace(/[\\%_]/g, ch => `\\${ch}`);
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .ilike('tenant_name', escapedName)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load tenant payments from Supabase:', error.message);
      return null;
    }
    return (data || []).map(mapRowToPayment);
  } catch (err) {
    console.warn('Network error loading tenant payments from Supabase:', err);
    return null;
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

export async function deletePaymentFromSupabase(id: string): Promise<boolean> {
  return deleteRowById('payments', id);
}

// Deletes every row of a table (payments, deposits or cashflow_transactions).
export async function clearTableInSupabase(
  table: 'payments' | 'deposits' | 'cashflow_transactions'
): Promise<boolean> {
  return clearTable(table);
}

// ==========================================
// 4. DEPOSITS API
// ==========================================

// Returns null (not []) when the database is unreachable, so callers keep what they have.
export async function getDepositsFromSupabase(): Promise<DepositRecord[] | null> {
  try {
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load deposits from Supabase:', error.message);
      return null;
    }
    return (data || []).map(mapRowToDeposit);
  } catch (err) {
    console.warn('Network error loading deposits from Supabase:', err);
    return null;
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
  return deleteRowById('deposits', id);
}

// ==========================================
// 5. CASHFLOW API
// ==========================================

// Returns null (not []) when the database is unreachable, so callers keep what they have.
export async function getCashflowFromSupabase(): Promise<CashflowTransaction[] | null> {
  try {
    const { data, error } = await supabase
      .from('cashflow_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load cashflow from Supabase:', error.message);
      return null;
    }
    return (data || []).map(mapRowToCashflow);
  } catch (err) {
    console.warn('Network error loading cashflow from Supabase:', err);
    return null;
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
  return deleteRowById('cashflow_transactions', id);
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
    await supabase.from('tenants').delete().neq('id', '___');
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

// ==========================================
// WAITING LIST
// ==========================================

function mapRowToWaitingEntry(row: any): WaitingEntry {
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    unitType: row.unit_type === 'Space' ? 'Space' : 'Shop',
    trade: row.trade || undefined,
    requestedDate: String(row.requested_date || row.created_at || '').slice(0, 10),
    notes: row.notes || undefined,
    status: row.status === 'Leased' || row.status === 'Removed' ? row.status : 'Waiting',
    leasedUnit: row.leased_unit || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapWaitingEntryToRow(e: WaitingEntry) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone || null,
    unit_type: e.unitType,
    trade: e.trade || null,
    requested_date: e.requestedDate,
    notes: e.notes || null,
    status: e.status,
    leased_unit: e.leasedUnit || null,
    created_at: e.createdAt,
  };
}

// null = the table can't be read (not created yet, or offline)
export async function getWaitingListFromSupabase(): Promise<WaitingEntry[] | null> {
  try {
    const { data, error } = await supabase.from('waiting_list').select('*');
    if (error) {
      console.warn('Could not load the waiting list:', error.message);
      return null;
    }
    return (data || []).map(mapRowToWaitingEntry);
  } catch (err) {
    console.warn('Network error loading the waiting list:', err);
    return null;
  }
}

export async function saveWaitingEntryToSupabase(entry: WaitingEntry): Promise<boolean> {
  try {
    const { error } = await supabase.from('waiting_list').upsert(mapWaitingEntryToRow(entry));
    if (error) {
      console.warn('Could not save waiting list entry:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error saving waiting list entry:', err);
    return false;
  }
}

export async function deleteWaitingEntryFromSupabase(id: string): Promise<boolean> {
  return deleteRowById('waiting_list', id);
}

// ==========================================
// ELECTRICITY (its own table)
// ==========================================

function mapRowToElectricity(row: any): ElectricityEntry {
  return {
    id: row.id,
    referenceNumber: row.reference_number || row.id,
    date: String(row.date || row.created_at || '').slice(0, 10),
    unitNumber: row.unit_number || '',
    unitType: row.unit_type === 'Space' ? 'Space' : 'Shop',
    tenantName: row.tenant_name || '',
    amount: Number(row.amount) || 0,
    currency: row.currency === 'SSP' ? 'SSP' : 'USD',
    kwh: row.kwh === null || row.kwh === undefined ? undefined : Number(row.kwh),
    notes: row.notes || undefined,
    recordedBy: row.recorded_by || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapElectricityToRow(e: ElectricityEntry) {
  return {
    id: e.id,
    reference_number: e.referenceNumber,
    date: e.date,
    unit_number: e.unitNumber,
    unit_type: e.unitType,
    tenant_name: e.tenantName || null,
    amount: e.amount,
    currency: e.currency,
    kwh: e.kwh ?? null,
    notes: e.notes || null,
    recorded_by: e.recordedBy || null,
    created_at: e.createdAt,
  };
}

// null = the table can't be read (not created yet, or offline)
export async function getElectricityFromSupabase(): Promise<ElectricityEntry[] | null> {
  try {
    const { data, error } = await supabase.from('electricity').select('*');
    if (error) {
      console.warn('Could not load electricity:', error.message);
      return null;
    }
    return (data || []).map(mapRowToElectricity);
  } catch (err) {
    console.warn('Network error loading electricity:', err);
    return null;
  }
}

export async function saveElectricityToSupabase(entry: ElectricityEntry): Promise<boolean> {
  try {
    const { error } = await supabase.from('electricity').upsert(mapElectricityToRow(entry));
    if (error) {
      console.warn('Could not save electricity entry:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error saving electricity entry:', err);
    return false;
  }
}

export async function deleteElectricityFromSupabase(id: string): Promise<boolean> {
  return deleteRowById('electricity', id);
}
