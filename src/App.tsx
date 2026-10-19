import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { UnitsView } from './components/UnitsView';
import { PaymentsView } from './components/PaymentsView';
import { DepositsView } from './components/DepositsView';
import { CashflowView } from './components/CashflowView';
import { ReceiptsView } from './components/ReceiptsView';
import { TenantsView } from './components/TenantsView';
import { ReportsView } from './components/ReportsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { ReceiptPrintModal } from './components/ReceiptPrintModal';
import { AddUnitModal } from './components/AddUnitModal';
import { FloorMapView } from './components/FloorMapView';
import { NotificationsView } from './components/NotificationsView';

import { 
  AdminUser, 
  NavigationTab, 
  PropertyUnit, 
  PaymentRecord, 
  DepositRecord,
  CashflowTransaction,
  CurrencyMode,
  CommercialNotification
} from './types';

import { initialCommercialNotifications } from './data/commercialData';

import { 
  getUnitsFromSupabase, 
  saveUnitToSupabase, 
  saveUnitsBulkToSupabase,
  deleteUnitFromSupabase,
  deleteTenantFromUnitInSupabase,
  deleteAllUnitsFromSupabase,
  deleteUnitsBulkFromSupabase,
  updateTenantAndPricingInSupabase,
  vacateUnitInSupabase,
  ModifyTenantPricingPayload,
  VacateUnitPayload,
  getPaymentsFromSupabase, 
  savePaymentToSupabase, 
  getDepositsFromSupabase,
  saveDepositToSupabase,
  getCashflowFromSupabase,
  saveCashflowToSupabase,
  deletePaymentFromSupabase,
  deleteDepositFromSupabase,
  deleteCashflowFromSupabase,
  clearTableInSupabase,
  clearAllSupabaseData,
  subscribeToRealtimeChanges,
  RealtimeStatus
} from './lib/supabaseService';

// Last data seen from the database, shown instantly on load until fresh data arrives.
// The database is the source of truth: the app never writes sample data into it.
function readCache<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const DB_DELETE_FAILED = 'The database refused the delete, so it was restored. Check your connection or database permissions.';

// Cashflow entry created automatically when a payment was recorded.
const isCashflowForPayment = (tx: CashflowTransaction, payment: PaymentRecord) =>
  tx.referenceNumber === `CF-${payment.receiptNumber.replace(/[^a-zA-Z0-9]/g, '')}` ||
  Boolean(tx.notes?.includes(`Receipt: ${payment.receiptNumber}`));

export default function App() {
  // Authentication State with localStorage persistence
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nbc_admin_auth') === 'true';
    } catch {
      return false;
    }
  });

  const [adminUser, setAdminUser] = useState<AdminUser>(() => {
    try {
      const savedUser = localStorage.getItem('nbc_admin_user');
      if (savedUser) return JSON.parse(savedUser);
    } catch {}
    return {
      id: 'usr-admin-1',
      name: 'Mohamed Mohamoud',
      email: 'admin@nyakuron.com',
      role: 'Super Admin',
      avatar: '/logo.png',
      lastLogin: 'Just now'
    };
  });

  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('nbc_admin_auth', 'true');
      localStorage.setItem('nbc_admin_user', JSON.stringify(user));
    } catch {}
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('nbc_admin_auth');
      localStorage.removeItem('nbc_admin_user');
      localStorage.removeItem('nbc_active_tab');
    } catch {}
  };

  // App Navigation & Data State (persisted across page reload)
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    try {
      const savedTab = localStorage.getItem('nbc_active_tab') as NavigationTab;
      if (savedTab) return savedTab;
    } catch {}
    return 'dashboard';
  });

  useEffect(() => {
    try {
      localStorage.setItem('nbc_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  // Core Data States (cached copy first, then loaded from Supabase)
  const [units, setUnits] = useState<PropertyUnit[]>(() => readCache('nbc_units', []));
  const [payments, setPayments] = useState<PaymentRecord[]>(() => readCache('nbc_payments', []));
  const [deposits, setDeposits] = useState<DepositRecord[]>(() => readCache('nbc_deposits', []));
  const [cashflow, setCashflow] = useState<CashflowTransaction[]>(() => readCache('nbc_cashflow', []));
  const [notifications, setNotifications] = useState<CommercialNotification[]>(
    () => readCache('nbc_notifications', initialCommercialNotifications)
  );
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeBuilding] = useState('Nyakuron Business Centre');

  // Supabase Real-time connection status
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');

  // Unit editing state
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);

  // Persistence to localStorage for offline cache
  useEffect(() => writeCache('nbc_units', units), [units]);
  useEffect(() => writeCache('nbc_payments', payments), [payments]);
  useEffect(() => writeCache('nbc_deposits', deposits), [deposits]);
  useEffect(() => writeCache('nbc_cashflow', cashflow), [cashflow]);
  useEffect(() => writeCache('nbc_notifications', notifications), [notifications]);

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSelectedUnitId, setPaymentSelectedUnitId] = useState<string | undefined>(undefined);
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
  const [isFloorMapOpen, setIsFloorMapOpen] = useState(false);
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<PaymentRecord | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ==========================================
  // REAL-TIME SUPABASE HYDRATION & LISTENER
  // ==========================================
  useEffect(() => {
    let isMounted = true;
    let lastRefresh = 0;

    // Replace local data with what is in the database. A table that fails to load
    // keeps its current data instead of being wiped.
    async function refreshFromDatabase() {
      const now = Date.now();
      if (now - lastRefresh < 3000) return;
      lastRefresh = now;

      const [dbUnits, dbPayments, dbDeposits, dbCashflow] = await Promise.all([
        getUnitsFromSupabase(),
        getPaymentsFromSupabase(),
        getDepositsFromSupabase(),
        getCashflowFromSupabase(),
      ]);
      if (!isMounted) return;
      if (dbUnits) setUnits(dbUnits);
      if (dbPayments) setPayments(dbPayments);
      if (dbDeposits) setDeposits(dbDeposits);
      if (dbCashflow) setCashflow(dbCashflow);
    }

    setRealtimeStatus('connecting');
    refreshFromDatabase();

    // Changes made while this tab was hidden or offline may have been missed by
    // realtime; reload so stale records (e.g. ones deleted elsewhere) disappear.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshFromDatabase();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refreshFromDatabase);
    let wasConnected = false;

    // Subscribe to multi-user changes across all tables
    const unsubscribe = subscribeToRealtimeChanges({
      onStatusChange: (status) => {
        if (!isMounted) return;
        setRealtimeStatus(status);
        if (status === 'connected') {
          if (wasConnected) refreshFromDatabase();
          wasConnected = true;
        }
      },
      onUnitChange: (event, unit, oldId) => {
        if (!isMounted) return;
        if (event === 'DELETE') {
          const targetId = oldId || unit.id;
          setUnits(prev => prev.filter(u => u.id !== targetId));
        } else if (event === 'INSERT') {
          setUnits(prev => {
            if (prev.some(u => u.id === unit.id)) return prev;
            return [unit, ...prev];
          });
        } else if (event === 'UPDATE') {
          setUnits(prev => prev.map(u => u.id === unit.id ? unit : u));
        }
      },
      onPaymentChange: (event, payment, oldId) => {
        if (!isMounted) return;
        if (event === 'DELETE') {
          const targetId = oldId || payment.id;
          setPayments(prev => prev.filter(p => p.id !== targetId));
        } else if (event === 'INSERT') {
          setPayments(prev => {
            if (prev.some(p => p.id === payment.id)) return prev;
            return [payment, ...prev];
          });
        } else if (event === 'UPDATE') {
          setPayments(prev => prev.map(p => p.id === payment.id ? payment : p));
        }
      },
      onDepositChange: (event, deposit, oldId) => {
        if (!isMounted) return;
        if (event === 'DELETE') {
          const targetId = oldId || deposit.id;
          setDeposits(prev => prev.filter(d => d.id !== targetId));
        } else if (event === 'INSERT') {
          setDeposits(prev => {
            if (prev.some(d => d.id === deposit.id)) return prev;
            return [deposit, ...prev];
          });
        } else if (event === 'UPDATE') {
          setDeposits(prev => prev.map(d => d.id === deposit.id ? deposit : d));
        }
      },
      onCashflowChange: (event, tx, oldId) => {
        if (!isMounted) return;
        if (event === 'DELETE') {
          const targetId = oldId || tx.id;
          setCashflow(prev => prev.filter(c => c.id !== targetId));
        } else if (event === 'INSERT') {
          setCashflow(prev => {
            if (prev.some(c => c.id === tx.id)) return prev;
            return [tx, ...prev];
          });
        } else if (event === 'UPDATE') {
          setCashflow(prev => prev.map(c => c.id === tx.id ? tx : c));
        }
      }
    });

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refreshFromDatabase);
      unsubscribe();
    };
  }, []);

  // Clear all data
  const handleClearAllData = async () => {
    setUnits([]);
    setPayments([]);
    setDeposits([]);
    setCashflow([]);
    setNotifications([]);
    try {
      localStorage.clear();
      localStorage.setItem('nbc_cache_v1_purged', 'true');
    } catch (e) {}
    await clearAllSupabaseData();
    showToast('All system records and cache cleared across Supabase and local store.');
  };

  // Payment Confirmation Handler
  const handleConfirmPayment = async (newPayment: PaymentRecord) => {
    // 1. Optimistic update
    setPayments(prev => [newPayment, ...prev]);

    // 2. Update unit's billing status
    let updatedUnitRow: PropertyUnit | null = null;
    setUnits(prev => prev.map(u => {
      if (u.unitNumber === newPayment.unitNumber) {
        const updated: PropertyUnit = {
          ...u,
          billingStatus: newPayment.remainingBalance > 0 ? 'Partially Paid' : 'Paid',
          billingMonthText: newPayment.remainingBalance > 0 
            ? `Partially Paid (${newPayment.currency})` 
            : `Paid • ${newPayment.accountingPeriod}`,
          arrearsUSD: newPayment.currency === 'USD' ? newPayment.remainingBalance : u.arrearsUSD,
          arrearsSSP: newPayment.currency === 'SSP' ? newPayment.remainingBalance : u.arrearsSSP
        };
        updatedUnitRow = updated;
        return updated;
      }
      return u;
    }));

    // 3. Persist payment & unit in Supabase
    await savePaymentToSupabase(newPayment);
    if (updatedUnitRow) {
      await saveUnitToSupabase(updatedUnitRow);
    }

    // 4. Record corresponding Cashflow transaction
    const newTx: CashflowTransaction = {
      id: `cf-pay-${Date.now()}`,
      referenceNumber: `CF-${newPayment.receiptNumber.replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString().slice(-6)}`,
      date: newPayment.date,
      title: `Rent: ${newPayment.tenantName} (${newPayment.unitNumber})`,
      category: 'Rent Collection',
      type: 'Inflow',
      amount: newPayment.amount,
      currency: newPayment.currency,
      account: 'Central Vault Cash Float',
      recordedBy: adminUser.name,
      status: 'Completed',
      notes: `Rent payment for ${newPayment.accountingPeriod}. Receipt: ${newPayment.receiptNumber}`
    };
    setCashflow(prev => [newTx, ...prev]);
    await saveCashflowToSupabase(newTx);

    // 5. Add notification
    const newNotification: CommercialNotification = {
      id: `notif-${Date.now()}`,
      title: `Payment Recorded: ${newPayment.receiptNumber}`,
      description: `Cleared ${newPayment.currency === 'USD' ? `$${newPayment.amount.toFixed(2)}` : `${newPayment.amount.toLocaleString()} SSP`} for ${newPayment.tenantName} (${newPayment.unitNumber}).`,
      timestamp: 'Just now',
      type: 'payment',
      read: false,
      priority: 'medium'
    };
    setNotifications(prev => [newNotification, ...prev]);

    // Open receipt modal for preview/printing
    setSelectedReceiptForPrint(newPayment);
    showToast(`Payment ${newPayment.receiptNumber} recorded and synced in real time.`);
  };

  // Add / Edit Unit Handler
  const handleSaveUnit = async (unitToSave: PropertyUnit) => {
    const isExisting = units.some(u => u.id === unitToSave.id);
    const tenantName = unitToSave.currentTenant?.name;
    if (isExisting) {
      setUnits(prev => prev.map(u => u.id === unitToSave.id ? unitToSave : u));
      showToast(`Unit ${unitToSave.unitNumber} updated and synced.`);
    } else {
      setUnits(prev => [unitToSave, ...prev]);
      if (tenantName) {
        // A new unit created with a tenant is a new lease: show it in the Tenants directory.
        setActiveTab('tenants');
        showToast(`Unit ${unitToSave.unitNumber} created and leased to ${tenantName}.`);
      } else {
        showToast(`Unit ${unitToSave.unitNumber} (${unitToSave.floor}) registered as Available.`);
      }
    }
    const saved = await saveUnitToSupabase(unitToSave);
    if (!saved) {
      showToast(`Unit ${unitToSave.unitNumber} saved on this device, but the database sync failed.`);
    }
  };

  // Reload everything from the database, e.g. after a delete the database refused,
  // so the screen never shows a record as deleted when it still exists.
  const restoreFromDatabase = async () => {
    const [dbUnits, dbPayments, dbDeposits, dbCashflow] = await Promise.all([
      getUnitsFromSupabase(),
      getPaymentsFromSupabase(),
      getDepositsFromSupabase(),
      getCashflowFromSupabase(),
    ]);
    if (dbUnits) setUnits(dbUnits);
    if (dbPayments) setPayments(dbPayments);
    if (dbDeposits) setDeposits(dbDeposits);
    if (dbCashflow) setCashflow(dbCashflow);
  };

  const reportDeleteResult = async (ok: boolean, successMessage: string) => {
    if (ok) {
      showToast(successMessage);
    } else {
      showToast(DB_DELETE_FAILED);
      await restoreFromDatabase();
    }
  };

  // Delete Unit Handler
  const handleDeleteUnit = async (unitId: string) => {
    const found = units.find(u => u.id === unitId);
    setUnits(prev => prev.filter(u => u.id !== unitId));
    const ok = await deleteUnitFromSupabase(unitId);
    await reportDeleteResult(ok, `Unit ${found?.unitNumber || ''} and connected tenant deleted.`);
  };

  // Delete Tenant from Unit Handler (removes tenant from unit & deletes from Tenants page)
  const handleDeleteTenantFromUnit = async (unitId: string) => {
    const targetUnit = units.find(u => u.id === unitId);
    if (!targetUnit) return;
    const tenantName = targetUnit.currentTenant?.name || 'Tenant';

    const clearedUnit: PropertyUnit = {
      ...targetUnit,
      currentTenant: undefined,
      occupancyStatus: 'Available',
      billingStatus: 'No Balance',
      billingMonthText: undefined,
      leaseStart: undefined,
      leaseEnd: undefined,
      daysRemaining: undefined,
      daysToExpiry: undefined,
      arrearsUSD: 0,
      arrearsSSP: 0,
    };

    setUnits(prev => prev.map(u => u.id === unitId ? clearedUnit : u));

    let res = await deleteTenantFromUnitInSupabase(unitId, targetUnit.unitNumber);
    // Unit missing from the database (never synced): save it as vacant instead.
    if (!res.success && (await saveUnitToSupabase(clearedUnit))) {
      res = { success: true, unit: clearedUnit };
    }
    if (res.success) {
      if (res.unit) setUnits(prev => prev.map(u => u.id === unitId ? res.unit! : u));
      const notif: CommercialNotification = {
        id: `notif-${Date.now()}`,
        title: `Tenant Deleted: ${tenantName} (${targetUnit.unitNumber})`,
        description: `Tenant ${tenantName} was removed from unit ${targetUnit.unitNumber}. The unit is now Available.`,
        timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        type: 'lease',
        read: false,
        priority: 'high'
      };
      setNotifications(prev => [notif, ...prev]);
    }
    await reportDeleteResult(res.success, `Tenant "${tenantName}" deleted. ${targetUnit.unitNumber} is now Available.`);
  };

  // Clear All Units at Once Handler
  const handleDeleteAllUnits = async () => {
    setUnits([]);
    const ok = await deleteAllUnitsFromSupabase();
    if (ok) {
      const notif: CommercialNotification = {
        id: `notif-${Date.now()}`,
        title: `All Units Cleared`,
        description: `All commercial units and connected tenants were removed from the inventory.`,
        timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        type: 'maintenance',
        read: false,
        priority: 'high'
      };
      setNotifications(prev => [notif, ...prev]);
    }
    await reportDeleteResult(ok, 'All units and connected tenants have been deleted.');
  };

  // Delete Selected Units Batch Handler
  const handleDeleteSelectedUnits = async (unitIds: string[]) => {
    if (unitIds.length === 0) return;
    setUnits(prev => prev.filter(u => !unitIds.includes(u.id)));
    const ok = await deleteUnitsBulkFromSupabase(unitIds);
    await reportDeleteResult(ok, `${unitIds.length} unit(s) and connected tenant(s) deleted.`);
  };

  // Modify Tenant & Lease Pricing Handler from Tenants Page
  const handleModifyTenantPricing = async (unitId: string, payload: ModifyTenantPricingPayload): Promise<boolean> => {
    const targetUnit = units.find(u => u.id === unitId);
    const res = await updateTenantAndPricingInSupabase(unitId, payload);
    if (res.success && res.unit) {
      const updated = res.unit;
      setUnits(prev => prev.map(u => u.id === unitId ? updated : u));

      // Record commercial notification
      const notif: CommercialNotification = {
        id: `notif-${Date.now()}`,
        title: `Tenant Modified: ${payload.tenantName} (${targetUnit?.unitNumber || ''})`,
        description: `Lease terms updated: Rent set to $${payload.monthlyRateUSD} / ${payload.monthlyRateSSP.toLocaleString()} SSP. Synced to Supabase database.`,
        timestamp: 'Just now',
        type: 'lease',
        read: false,
        priority: 'low'
      };
      setNotifications(prev => [notif, ...prev]);
      showToast(`Tenant details & rent for ${targetUnit?.unitNumber || ''} updated and synced to database.`);
      return true;
    } else {
      showToast(`Error updating tenant: ${res.error || 'Database error'}`);
      return false;
    }
  };

  // Vacate Unit Handler from Tenants Page
  const handleVacateUnit = async (unitId: string, payload?: VacateUnitPayload): Promise<boolean> => {
    const targetUnit = units.find(u => u.id === unitId);
    const tenantName = targetUnit?.currentTenant?.name || 'Tenant';
    let res = await vacateUnitInSupabase(unitId, payload);

    // The unit may exist only locally (never synced); save it as an Available unit instead.
    if (!res.success && targetUnit) {
      const vacatedUnit: PropertyUnit = {
        ...targetUnit,
        currentTenant: undefined,
        occupancyStatus: 'Available',
        billingStatus: 'No Balance',
        billingMonthText: undefined,
        leaseStart: undefined,
        leaseEnd: undefined,
        leaseTermMonths: undefined,
        daysRemaining: undefined,
        daysToExpiry: undefined,
        arrearsUSD: 0,
        arrearsSSP: 0,
        notes: `[Vacated on ${payload?.vacatedDate || new Date().toISOString().slice(0, 10)}]${payload?.reason ? ` Reason: ${payload.reason}` : ''}`,
      };
      if (await saveUnitToSupabase(vacatedUnit)) {
        res = { success: true, unit: vacatedUnit };
      }
    }

    if (res.success && res.unit) {
      const updated = res.unit;
      setUnits(prev => prev.map(u => u.id === unitId ? updated : u));

      // Record commercial notification
      const notif: CommercialNotification = {
        id: `notif-${Date.now()}`,
        title: `Unit Vacated: ${targetUnit?.unitNumber || ''}`,
        description: `${tenantName} has vacated unit ${targetUnit?.unitNumber || ''}. Unit is now marked as Available for lease. Synced to Supabase database.`,
        timestamp: 'Just now',
        type: 'maintenance',
        read: false,
        priority: 'high'
      };
      setNotifications(prev => [notif, ...prev]);
      showToast(`Unit ${targetUnit?.unitNumber || ''} has been vacated and updated in Supabase database.`);
      return true;
    } else {
      showToast(`Error vacating unit: ${res.error || 'Database error'}`);
      return false;
    }
  };

  // Save Deposit Handler
  const handleSaveDeposit = async (dep: DepositRecord) => {
    const isExisting = deposits.some(d => d.id === dep.id);
    if (isExisting) {
      setDeposits(prev => prev.map(d => d.id === dep.id ? dep : d));
      showToast(`Deposit ${dep.depositSlip || dep.id} updated.`);
    } else {
      setDeposits(prev => [dep, ...prev]);
      showToast(`Deposit recorded for ${dep.tenantName}.`);
    }
    await saveDepositToSupabase(dep);
  };

  // Save Cashflow Handler
  const handleSaveCashflow = async (tx: CashflowTransaction) => {
    const isExisting = cashflow.some(c => c.id === tx.id);
    if (isExisting) {
      setCashflow(prev => prev.map(c => c.id === tx.id ? tx : c));
      showToast(`Cashflow voucher ${tx.referenceNumber} updated.`);
    } else {
      setCashflow(prev => [tx, ...prev]);
      showToast(`Cashflow ${tx.type} voucher ${tx.referenceNumber} recorded.`);
    }
    await saveCashflowToSupabase(tx);
  };

  // Delete a payment and the cashflow entry that was recorded with it
  const handleDeletePayment = async (payment: PaymentRecord) => {
    const linked = cashflow.filter(tx => isCashflowForPayment(tx, payment));
    setPayments(prev => prev.filter(p => p.id !== payment.id));
    setCashflow(prev => prev.filter(tx => !linked.some(l => l.id === tx.id)));
    const ok = await deletePaymentFromSupabase(payment.id);
    if (ok) await Promise.all(linked.map(tx => deleteCashflowFromSupabase(tx.id)));
    await reportDeleteResult(ok, `Payment ${payment.receiptNumber} deleted.`);
  };

  const handleClearAllPayments = async () => {
    const linked = cashflow.filter(tx => payments.some(p => isCashflowForPayment(tx, p)));
    setPayments([]);
    setCashflow(prev => prev.filter(tx => !linked.some(l => l.id === tx.id)));
    const ok = await clearTableInSupabase('payments');
    if (ok) await Promise.all(linked.map(tx => deleteCashflowFromSupabase(tx.id)));
    await reportDeleteResult(ok, 'All payments cleared.');
  };

  // Delete a deposit; a deposit still held is also taken off its unit
  const handleDeleteDeposit = async (dep: DepositRecord) => {
    setDeposits(prev => prev.filter(d => d.id !== dep.id));
    const ok = await deleteDepositFromSupabase(dep.id);
    const unit = units.find(u => u.unitNumber === dep.unitNumber);
    if (ok && unit && dep.status === 'Held in Escrow' && unit.escrowDepositUSD) {
      const updatedUnit = { ...unit, escrowDepositUSD: 0, escrowDepositSSP: 0, depositMonths: 0 };
      setUnits(prev => prev.map(u => u.id === unit.id ? updatedUnit : u));
      await saveUnitToSupabase(updatedUnit);
    }
    await reportDeleteResult(ok, `Deposit ${dep.depositSlip || dep.id} deleted.`);
  };

  const handleClearAllDeposits = async () => {
    const heldUnitNumbers = new Set(deposits.filter(d => d.status === 'Held in Escrow').map(d => d.unitNumber));
    const affectedUnits = units
      .filter(u => heldUnitNumbers.has(u.unitNumber) && u.escrowDepositUSD)
      .map(u => ({ ...u, escrowDepositUSD: 0, escrowDepositSSP: 0, depositMonths: 0 }));
    setDeposits([]);
    const ok = await clearTableInSupabase('deposits');
    if (ok && affectedUnits.length) {
      setUnits(prev => prev.map(u => affectedUnits.find(a => a.id === u.id) || u));
      await saveUnitsBulkToSupabase(affectedUnits);
    }
    await reportDeleteResult(ok, 'All deposits cleared.');
  };

  const handleDeleteCashflow = async (tx: CashflowTransaction) => {
    setCashflow(prev => prev.filter(c => c.id !== tx.id));
    const ok = await deleteCashflowFromSupabase(tx.id);
    await reportDeleteResult(ok, `Cashflow entry ${tx.referenceNumber} deleted.`);
  };

  const handleClearAllCashflow = async () => {
    setCashflow([]);
    const ok = await clearTableInSupabase('cashflow_transactions');
    await reportDeleteResult(ok, 'All cashflow entries cleared.');
  };

  // Quick action: record payment for specific unit (navigates to payments page)
  const handleOpenRecordPaymentForUnit = (unitId: string) => {
    setPaymentSelectedUnitId(unitId);
    setActiveTab('payments');
    setIsPaymentModalOpen(true);
  };

  // Quick action: record payment for tenant name or unit number (navigates to payments page)
  const handleRecordPaymentForTenantUnit = (unitNumber: string) => {
    const found = units.find(u => u.unitNumber === unitNumber);
    if (found) {
      setPaymentSelectedUnitId(found.id);
    }
    setActiveTab('payments');
    setIsPaymentModalOpen(true);
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    showToast('All notifications cleared.');
  };

  // Mark all notifications read
  const handleMarkNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('All notifications marked as read.');
  };

  // Unread alerts count
  const unreadAlertsCount = notifications.filter(n => !n.read).length;

  // Render Login Page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="nbc-app-layout" className="min-h-screen bg-slate-50 flex flex-row antialiased text-slate-800">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-60 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        unreadAlertsCount={unreadAlertsCount}
        adminUser={adminUser}
        onLogout={handleLogout}
        activeBuilding={activeBuilding}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* Header with Live Sync Status */}
        <Header
          currentTab={activeTab}
          currencyMode={currencyMode}
          onCurrencyChange={setCurrencyMode}
          onOpenRecordPayment={() => {
            setPaymentSelectedUnitId(undefined);
            setIsPaymentModalOpen(true);
          }}
          onOpenNotifications={() => setActiveTab('notifications')}
          unreadCount={unreadAlertsCount}
          adminUser={adminUser}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (q.trim().length > 0 && (activeTab === 'dashboard' || activeTab === 'reports' || activeTab === 'analytics' || activeTab === 'settings' || activeTab === 'notifications')) {
              setActiveTab('units');
            }
          }}
          onNavigate={setActiveTab}
          onLogout={handleLogout}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          realtimeStatus={realtimeStatus}
          units={units}
          payments={payments}
        />

        {/* Dynamic Views with Real Functions */}
        <main className="flex-1 pb-16">
          
          {/* 1. DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <DashboardView
              units={units}
              payments={payments}
              currencyMode={currencyMode}
              onCurrencyChange={setCurrencyMode}
              onOpenRecordPayment={() => {
                setPaymentSelectedUnitId(undefined);
                setIsPaymentModalOpen(true);
              }}
              onOpenAddUnit={() => {
                setEditingUnit(null);
                setIsAddUnitModalOpen(true);
              }}
              onRecordPaymentForTenant={handleRecordPaymentForTenantUnit}
              onNavigate={setActiveTab}
            />
          )}

          {/* 2. UNITS VIEW */}
          {(activeTab === 'units' || activeTab === 'occupancy') && (
            <UnitsView
              units={units}
              currencyMode={currencyMode}
              onCurrencyChange={setCurrencyMode}
              onOpenRecordPaymentWithUnit={handleOpenRecordPaymentForUnit}
              onOpenAddUnit={() => {
                setEditingUnit(null);
                setIsAddUnitModalOpen(true);
              }}
              onOpenFloorMap={() => setIsFloorMapOpen(true)}
              onEditUnit={(unit) => {
                setEditingUnit(unit);
                setIsAddUnitModalOpen(true);
              }}
              onDeleteUnit={handleDeleteUnit}
              onDeleteTenant={handleDeleteTenantFromUnit}
              onDeleteAllUnits={handleDeleteAllUnits}
              onDeleteSelectedUnits={handleDeleteSelectedUnits}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {/* 3. TENANTS DIRECTORY */}
          {activeTab === 'tenants' && (
            <TenantsView
              units={units}
              payments={payments}
              deposits={deposits}
              onRecordPaymentForTenant={handleRecordPaymentForTenantUnit}
              onSelectReceiptForPrint={(p) => setSelectedReceiptForPrint(p)}
              onModifyTenantPricing={handleModifyTenantPricing}
              onVacateUnit={handleVacateUnit}
              onDeleteTenant={handleDeleteTenantFromUnit}
            />
          )}

          {/* 4. PAYMENTS & LEDGER */}
          {activeTab === 'payments' && (
            <PaymentsView
              payments={payments}
              units={units}
              currencyMode={currencyMode}
              onOpenRecordPayment={() => {
                setPaymentSelectedUnitId(undefined);
                setIsPaymentModalOpen(true);
              }}
              onSelectReceiptForPrint={(p) => setSelectedReceiptForPrint(p)}
              onDeletePayment={handleDeletePayment}
              onClearAllPayments={handleClearAllPayments}
            />
          )}

          {/* 6. ESCROW DEPOSITS */}
          {activeTab === 'deposits' && (
            <DepositsView
              units={units}
              currencyMode={currencyMode}
              deposits={deposits}
              onSaveDeposit={handleSaveDeposit}
              onDeleteDeposit={handleDeleteDeposit}
              onClearAllDeposits={handleClearAllDeposits}
            />
          )}

          {/* 7. CASH FLOW & RESERVES */}
          {activeTab === 'cashflow' && (
            <CashflowView
              currencyMode={currencyMode}
              transactions={cashflow}
              onSaveTransaction={handleSaveCashflow}
              onDeleteTransaction={handleDeleteCashflow}
              onClearAllTransactions={handleClearAllCashflow}
            />
          )}

          {/* 8. PRINTABLE RECEIPTS REGISTRY */}
          {activeTab === 'receipts' && (
            <ReceiptsView
              payments={payments}
              currencyMode={currencyMode}
              onSelectReceiptForPrint={(p) => setSelectedReceiptForPrint(p)}
              onOpenRecordPayment={() => {
                setPaymentSelectedUnitId(undefined);
                setIsPaymentModalOpen(true);
              }}
              onDeletePayment={handleDeletePayment}
              onClearAllPayments={handleClearAllPayments}
            />
          )}

          {/* 9. TENANT PAYMENT REPORTS */}
          {activeTab === 'reports' && (
            <ReportsView
              units={units}
              payments={payments}
              deposits={deposits}
              onSelectReceiptForPrint={(p) => setSelectedReceiptForPrint(p)}
              onDeletePayment={handleDeletePayment}
              onClearAllPayments={handleClearAllPayments}
            />
          )}

          {/* 10. ANALYTICS */}
          {activeTab === 'analytics' && (
            <AnalyticsView
              units={units}
              payments={payments}
              deposits={deposits}
              onDeletePayment={handleDeletePayment}
              onClearAllPayments={handleClearAllPayments}
              onDeleteDeposit={handleDeleteDeposit}
              onClearAllDeposits={handleClearAllDeposits}
            />
          )}

          {/* 10. SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsView onClearAllData={handleClearAllData} />
          )}

          {/* 11. NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              onMarkAllRead={handleMarkNotificationsRead}
              onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
              onDelete={handleDeleteNotification}
              onClearAll={handleClearNotifications}
            />
          )}
        </main>

      </div>

      {/* Record Tenant Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        units={units}
        onConfirmPayment={handleConfirmPayment}
        selectedUnitId={paymentSelectedUnitId}
      />

      {/* Official Printable Receipt Voucher */}
      <ReceiptPrintModal
        isOpen={selectedReceiptForPrint !== null}
        onClose={() => setSelectedReceiptForPrint(null)}
        payment={selectedReceiptForPrint}
      />

      {/* Register / Edit Commercial Unit Modal */}
      <AddUnitModal
        isOpen={isAddUnitModalOpen}
        onClose={() => {
          setIsAddUnitModalOpen(false);
          setEditingUnit(null);
        }}
        onSaveUnit={handleSaveUnit}
        editingUnit={editingUnit}
      />

      {/* Floor Map Interactive Architectural View */}
      <FloorMapView
        isOpen={isFloorMapOpen}
        onClose={() => setIsFloorMapOpen(false)}
        units={units}
        onSelectUnitForPayment={handleOpenRecordPaymentForUnit}
      />

    </div>
  );
}
