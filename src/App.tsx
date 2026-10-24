import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { SmartPayModal, SmartPayRequest } from './components/SmartPayModal';
import { TenantDepositModal, TenantDepositRequest } from './components/TenantDepositModal';
import { DepositManageModal } from './components/DepositManageModal';
import { WaitingListView } from './components/WaitingListView';
import { ElectricityView } from './components/ElectricityView';
import { depositFields, depositIn, RentCurrency } from './utils/currency';
import { formatMoney, parsePaymentDate } from './utils/printUtils';
import { buildTenantAccount, buildTenantAccounts, isLegacyCreditDeposit, DEPOSIT_MONTHS_PREFIX, AMOUNT_DEPOSIT_TAG, depositMonthLabels, withDepositMonths, planDepositApplications, accountKey, coverageEndOf } from './utils/tenantAccount';
import { nextReceiptNumber } from './utils/receiptNumbers';

import { 
  AdminUser, 
  NavigationTab, 
  PropertyUnit, 
  PaymentRecord, 
  DepositRecord,
  CashflowTransaction,
  CurrencyMode,
  CommercialNotification,
  WaitingEntry,
  ElectricityEntry
} from './types';

import { initialCommercialNotifications, initialPayments } from './data/commercialData';

import { 
  getUnitsFromSupabase, 
  saveUnitToSupabase, 
  saveUnitsBulkToSupabase,
  deleteUnitFromSupabase,
  deleteTenantFromUnitInSupabase,
  deleteAllUnitsFromSupabase,
  clearAllTenantsInSupabase,
  deleteUnitsBulkFromSupabase,
  updateTenantAndPricingInSupabase,
  vacateUnitInSupabase,
  ModifyTenantPricingPayload,
  VacateUnitPayload,
  getPaymentsFromSupabase, 
  savePaymentToSupabase,
  savePaymentsBulkToSupabase, 
  getDepositsFromSupabase,
  saveDepositToSupabase,
  saveDepositsBulkToSupabase,
  getCashflowFromSupabase,
  saveCashflowToSupabase,
  saveCashflowsBulkToSupabase,
  deletePaymentFromSupabase,
  deleteDepositFromSupabase,
  deleteCashflowFromSupabase,
  clearTableInSupabase,
  clearAllSupabaseData,
  subscribeToRealtimeChanges,
  getWaitingListFromSupabase,
  saveWaitingEntryToSupabase,
  deleteWaitingEntryFromSupabase,
  getElectricityFromSupabase,
  saveElectricityToSupabase,
  deleteElectricityFromSupabase,
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

// ---------------------------------------------------------------------------
// Records the database hasn't accepted yet. A reload from the database must never
// wipe them: they are kept on screen and saved again on every reload until it works.
// ---------------------------------------------------------------------------
type SyncTable = 'units' | 'payments' | 'deposits' | 'cashflow';
const CACHE_KEYS: Record<SyncTable, string> = {
  units: 'nbc_units',
  payments: 'nbc_payments',
  deposits: 'nbc_deposits',
  cashflow: 'nbc_cashflow',
};
const PENDING_KEY = 'nbc_pending_sync';

function getPending(): Record<SyncTable, string[]> {
  return { units: [], payments: [], deposits: [], cashflow: [], ...readCache(PENDING_KEY, {}) };
}

function setPending(table: SyncTable, id: string, pending: boolean) {
  const all = getPending();
  const ids = new Set(all[table]);
  if (pending) ids.add(id); else ids.delete(id);
  writeCache(PENDING_KEY, { ...all, [table]: [...ids] });
}

function clearPending(table: SyncTable) {
  writeCache(PENDING_KEY, { ...getPending(), [table]: [] });
}

// Waiting list entries the database hasn't accepted yet (e.g. before the table exists).
const WAITING_CACHE = 'nbc_waiting_list';
const WAITING_PENDING = 'nbc_waiting_pending';

function setWaitingPending(id: string, pending: boolean) {
  const ids = new Set(readCache<string[]>(WAITING_PENDING, []));
  if (pending) ids.add(id); else ids.delete(id);
  writeCache(WAITING_PENDING, [...ids]);
}

// Database rows, plus local entries still waiting to be saved (retried here).
async function loadWaitingList(): Promise<WaitingEntry[] | null> {
  const dbRows = await getWaitingListFromSupabase();
  if (dbRows === null) return null;
  const pending = new Set(readCache<string[]>(WAITING_PENDING, []));
  const local = readCache<WaitingEntry[]>(WAITING_CACHE, []).filter(e => pending.has(e.id));
  for (const e of local) {
    if (await saveWaitingEntryToSupabase(e)) setWaitingPending(e.id, false);
  }
  const byId = new Map(local.map(e => [e.id, e]));
  const dbIds = new Set(dbRows.map(e => e.id));
  return [...local.filter(e => !dbIds.has(e.id)), ...dbRows.map(e => byId.get(e.id) || e)];
}

// Electricity entries the database hasn't accepted yet (e.g. before the table exists).
const ELECTRICITY_CACHE = 'nbc_electricity';
const ELECTRICITY_PENDING = 'nbc_electricity_pending';

function setElectricityPending(id: string, pending: boolean) {
  const ids = new Set(readCache<string[]>(ELECTRICITY_PENDING, []));
  if (pending) ids.add(id); else ids.delete(id);
  writeCache(ELECTRICITY_PENDING, [...ids]);
}

// Database rows, plus local entries still waiting to be saved (retried here).
async function loadElectricity(): Promise<ElectricityEntry[] | null> {
  const dbRows = await getElectricityFromSupabase();
  if (dbRows === null) return null;
  const pending = new Set(readCache<string[]>(ELECTRICITY_PENDING, []));
  const local = readCache<ElectricityEntry[]>(ELECTRICITY_CACHE, []).filter(e => pending.has(e.id));
  for (const e of local) {
    if (await saveElectricityToSupabase(e)) setElectricityPending(e.id, false);
  }
  const byId = new Map(local.map(e => [e.id, e]));
  const dbIds = new Set(dbRows.map(e => e.id));
  return [...local.filter(e => !dbIds.has(e.id)), ...dbRows.map(e => byId.get(e.id) || e)];
}

// Payments recorded before the unit_id fix were all rejected by the database and only
// exist in this browser's cache. Queue them once for upload.
const LEGACY_PAYMENTS_FLAG = 'nbc_payments_recovered_v1';
const SAMPLE_PAYMENT_IDS = new Set(initialPayments.map(p => p.id));
const SAMPLE_NOTIFICATION_IDS = new Set(initialCommercialNotifications.map(n => n.id));

function queueLegacyPayments(dbPayments: PaymentRecord[]) {
  try {
    if (localStorage.getItem(LEGACY_PAYMENTS_FLAG) === 'true') return;
    const dbIds = new Set(dbPayments.map(p => p.id));
    readCache<PaymentRecord[]>(CACHE_KEYS.payments, [])
      .filter(p => p?.id && !dbIds.has(p.id) && !SAMPLE_PAYMENT_IDS.has(p.id))
      .forEach(p => setPending('payments', p.id, true));
    localStorage.setItem(LEGACY_PAYMENTS_FLAG, 'true');
  } catch {}
}

// Database rows plus any local rows still waiting to be saved (which are retried here).
async function mergeWithPending<T extends { id: string }>(
  table: SyncTable,
  dbRows: T[],
  saveBulk: (rows: T[]) => Promise<boolean>
): Promise<T[]> {
  const pendingIds = new Set(getPending()[table]);
  if (pendingIds.size === 0) return dbRows;

  const local = readCache<T[]>(CACHE_KEYS[table], []).filter(r => r?.id && pendingIds.has(r.id));
  pendingIds.forEach(id => {
    if (!local.some(r => r.id === id)) setPending(table, id, false); // deleted locally since
  });
  if (local.length && (await saveBulk(local))) {
    local.forEach(r => setPending(table, r.id, false));
  }

  const localById = new Map(local.map(r => [r.id, r]));
  const dbIds = new Set(dbRows.map(r => r.id));
  return [...local.filter(r => !dbIds.has(r.id)), ...dbRows.map(r => localById.get(r.id) || r)];
}

// Loads every table; a table that can't be loaded comes back as null (keep what's on screen).
async function loadAllFromDatabase() {
  const [dbUnits, dbPayments, dbDeposits, dbCashflow] = await Promise.all([
    getUnitsFromSupabase(),
    getPaymentsFromSupabase(),
    getDepositsFromSupabase(),
    getCashflowFromSupabase(),
  ]);
  if (dbPayments) queueLegacyPayments(dbPayments);
  return {
    units: dbUnits && (await mergeWithPending('units', dbUnits, saveUnitsBulkToSupabase)),
    payments: dbPayments && (await mergeWithPending('payments', dbPayments, savePaymentsBulkToSupabase)),
    deposits: dbDeposits && (await mergeWithPending('deposits', dbDeposits, saveDepositsBulkToSupabase)),
    cashflow: dbCashflow && (await mergeWithPending('cashflow', dbCashflow, saveCashflowsBulkToSupabase)),
  };
}

// Saves one row and remembers it if the database didn't accept it.
async function persist<T extends { id: string }>(table: SyncTable, row: T, save: (r: T) => Promise<boolean>) {
  const ok = await save(row);
  setPending(table, row.id, !ok);
  return ok;
}

const DB_DELETE_FAILED = 'The database refused the delete, so it was restored. Check your connection or database permissions.';

// Cashflow entry created automatically when a payment was recorded. Newer entries carry
// the payment id; older ones are matched by receipt number, but only when no other
// payment shares that number (old receipt numbers were not unique).
const isCashflowForPayment = (tx: CashflowTransaction, payment: PaymentRecord, allPayments: PaymentRecord[]) => {
  if (tx.id === `cf-${payment.id}`) return true;
  if (!tx.id.startsWith('cf-pay-')) return false;
  const receiptIsUnique = allPayments.filter(p => p.receiptNumber === payment.receiptNumber).length === 1;
  return receiptIsUnique && Boolean(tx.notes?.includes(`Receipt: ${payment.receiptNumber}`));
};

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
  // Sample alerts from the test period are dropped from any saved copy
  const [notifications, setNotifications] = useState<CommercialNotification[]>(
    () => readCache<CommercialNotification[]>('nbc_notifications', []).filter(n => !SAMPLE_NOTIFICATION_IDS.has(n.id))
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

  // Waiting list: first come, first served
  const [waitingList, setWaitingList] = useState<WaitingEntry[]>(() => readCache(WAITING_CACHE, []));
  const [waitingDbReady, setWaitingDbReady] = useState(true);
  useEffect(() => writeCache(WAITING_CACHE, waitingList), [waitingList]);

  // Daily electricity (its own table)
  const [electricity, setElectricity] = useState<ElectricityEntry[]>(() => readCache(ELECTRICITY_CACHE, []));
  const [electricityDbReady, setElectricityDbReady] = useState(true);
  useEffect(() => writeCache(ELECTRICITY_CACHE, electricity), [electricity]);

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSelectedUnitId, setPaymentSelectedUnitId] = useState<string | undefined>(undefined);
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
  const [isFloorMapOpen, setIsFloorMapOpen] = useState(false);
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<PaymentRecord | null>(null);
  const [smartPayKey, setSmartPayKey] = useState<string | null>(null);

  // Each leased unit's rent account: months paid / owed, and balance
  // Old advance-credit records (overpayments) are hidden and never counted
  const visibleDeposits = useMemo(() => deposits.filter(d => !isLegacyCreditDeposit(d)), [deposits]);
  const tenantAccounts = useMemo(() => buildTenantAccounts(units, payments, visibleDeposits), [units, payments, visibleDeposits]);
  // Units as the pages show them: days remaining also counts months paid past the lease end
  const unitsShown = useMemo(() => {
    const paidThroughById = new Map(tenantAccounts.map(a => [a.unit.id, a.paidThrough]));
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    return units.map(u => {
      const withPaid = { ...u, paidThrough: paidThroughById.get(u.id) };
      const end = parsePaymentDate(coverageEndOf(withPaid));
      if (!end || !u.currentTenant) return withPaid;
      const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);
      return { ...withPaid, daysRemaining: days, currentTenant: { ...u.currentTenant, daysRemaining: days } };
    });
  }, [units, tenantAccounts]);
  const smartPayAccount = tenantAccounts.find(a => a.key === smartPayKey) || null;
  const [depositKey, setDepositKey] = useState<string | null>(null);
  const depositAccount = tenantAccounts.find(a => a.key === depositKey) || null;
  const [manageDepositKey, setManageDepositKey] = useState<string | null>(null);
  const manageDepositAccount = tenantAccounts.find(a => a.key === manageDepositKey) || null;
  // Becomes true once payments and deposits have been loaded from the database
  const [dbReady, setDbReady] = useState(false);
  const appliedDepositRows = useRef<Set<string>>(new Set());

  // Next deposit slip in this year's sequence: DEP-2026-0001, DEP-2026-0002, ...
  const nextDepositSlip = (() => {
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^DEP-${year}-(\\d+)$`);
    const last = deposits.reduce((max, d) => {
      const m = pattern.exec(d.depositSlip || '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    return `DEP-${year}-${String(last + 1).padStart(4, '0')}`;
  })();

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

      const data = await loadAllFromDatabase();
      if (!isMounted) return;
      if (data.units) setUnits(data.units);
      if (data.payments) setPayments(data.payments);
      if (data.deposits) setDeposits(data.deposits);
      if (data.cashflow) setCashflow(data.cashflow);
      if (data.payments && data.deposits) setDbReady(true);
      const waiting = await loadWaitingList();
      if (!isMounted) return;
      setWaitingDbReady(waiting !== null);
      if (waiting) setWaitingList(waiting);
      const electricityRows = await loadElectricity();
      if (!isMounted) return;
      setElectricityDbReady(electricityRows !== null);
      if (electricityRows) setElectricity(electricityRows);
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
    const paymentSaved = await persist('payments', newPayment, savePaymentToSupabase);
    if (!paymentSaved) {
      showToast(`Payment ${newPayment.receiptNumber} is saved on this device and will be uploaded to the database automatically when it's reachable.`);
    }
    if (updatedUnitRow) {
      await persist('units', updatedUnitRow, saveUnitToSupabase);
    }

    // 4. Record corresponding Cashflow transaction
    const newTx: CashflowTransaction = {
      id: `cf-${newPayment.id}`,
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
    await persist('cashflow', newTx, saveCashflowToSupabase);

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
    if (paymentSaved) {
      showToast(`Payment ${newPayment.receiptNumber} recorded and synced in real time.`);
    }
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
    const saved = await persist('units', unitToSave, saveUnitToSupabase);
    if (!saved) {
      showToast(`Unit ${unitToSave.unitNumber} is saved on this device and will be uploaded to the database automatically.`);
    }
  };

  // Reload everything from the database, e.g. after a delete the database refused,
  // so the screen never shows a record as deleted when it still exists.
  const restoreFromDatabase = async () => {
    const data = await loadAllFromDatabase();
    if (data.units) setUnits(data.units);
    if (data.payments) setPayments(data.payments);
    if (data.deposits) setDeposits(data.deposits);
    if (data.cashflow) setCashflow(data.cashflow);
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
    setPending('units', unitId, false);
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
    if (!res.success && (await persist('units', clearedUnit, saveUnitToSupabase))) {
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

  // Remove every tenant but keep units, payments, deposits and cashflow
  const handleClearAllTenants = async () => {
    const leased = units.filter(u => u.currentTenant);
    if (leased.length === 0) return;
    setUnits(prev => prev.map(u => u.currentTenant ? {
      ...u,
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
    } : u));

    const ok = await clearAllTenantsInSupabase();
    if (ok) {
      const notif: CommercialNotification = {
        id: `notif-${Date.now()}`,
        title: `All Tenants Cleared`,
        description: `${leased.length} tenant(s) removed; their units are now Available. Payments, deposits, cashflow and reports were kept.`,
        timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        type: 'lease',
        read: false,
        priority: 'high'
      };
      setNotifications(prev => [notif, ...prev]);
    }
    await reportDeleteResult(ok, `${leased.length} tenant(s) cleared. Payment, deposit and cashflow history was kept.`);
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
      if (await persist('units', vacatedUnit, saveUnitToSupabase)) {
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
    await persist('deposits', dep, saveDepositToSupabase);
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
    await persist('cashflow', tx, saveCashflowToSupabase);
  };

  // Delete a payment and the cashflow entry that was recorded with it
  const handleDeletePayment = async (payment: PaymentRecord) => {
    const linked = cashflow.filter(tx => isCashflowForPayment(tx, payment, payments));
    setPending('payments', payment.id, false);
    setPayments(prev => prev.filter(p => p.id !== payment.id));
    setCashflow(prev => prev.filter(tx => !linked.some(l => l.id === tx.id)));
    const ok = await deletePaymentFromSupabase(payment.id);
    if (ok) await Promise.all(linked.map(tx => deleteCashflowFromSupabase(tx.id)));
    await reportDeleteResult(ok, `Payment ${payment.receiptNumber} deleted.`);
  };

  const handleClearAllPayments = async () => {
    const linked = cashflow.filter(tx => payments.some(p => isCashflowForPayment(tx, p, payments)));
    clearPending('payments');
    setPayments([]);
    setCashflow(prev => prev.filter(tx => !linked.some(l => l.id === tx.id)));
    const ok = await clearTableInSupabase('payments');
    if (ok) await Promise.all(linked.map(tx => deleteCashflowFromSupabase(tx.id)));
    await reportDeleteResult(ok, 'All payments cleared.');
  };

  // Delete a deposit; a deposit still held is also taken off its unit
  const handleDeleteDeposit = async (dep: DepositRecord) => {
    setPending('deposits', dep.id, false);
    setDeposits(prev => prev.filter(d => d.id !== dep.id));
    const ok = await deleteDepositFromSupabase(dep.id);
    const unit = units.find(u => u.unitNumber === dep.unitNumber);
    if (ok && unit && dep.status === 'Held in Escrow' && unit.escrowDepositUSD) {
      const updatedUnit = { ...unit, escrowDepositUSD: 0, escrowDepositSSP: 0, depositMonths: 0 };
      setUnits(prev => prev.map(u => u.id === unit.id ? updatedUnit : u));
      await persist('units', updatedUnit, saveUnitToSupabase);
    }
    await reportDeleteResult(ok, `Deposit ${dep.depositSlip || dep.id} deleted.`);
  };

  const handleClearAllDeposits = async () => {
    const heldUnitNumbers = new Set(deposits.filter(d => d.status === 'Held in Escrow').map(d => d.unitNumber));
    const affectedUnits = units
      .filter(u => heldUnitNumbers.has(u.unitNumber) && u.escrowDepositUSD)
      .map(u => ({ ...u, escrowDepositUSD: 0, escrowDepositSSP: 0, depositMonths: 0 }));
    clearPending('deposits');
    setDeposits([]);
    const ok = await clearTableInSupabase('deposits');
    if (ok && affectedUnits.length) {
      setUnits(prev => prev.map(u => affectedUnits.find(a => a.id === u.id) || u));
      await saveUnitsBulkToSupabase(affectedUnits);
    }
    await reportDeleteResult(ok, 'All deposits cleared.');
  };

  const handleDeleteCashflow = async (tx: CashflowTransaction) => {
    setPending('cashflow', tx.id, false);
    setCashflow(prev => prev.filter(c => c.id !== tx.id));
    const ok = await deleteCashflowFromSupabase(tx.id);
    await reportDeleteResult(ok, `Cashflow entry ${tx.referenceNumber} deleted.`);
  };

  const handleClearAllCashflow = async () => {
    clearPending('cashflow');
    setCashflow([]);
    const ok = await clearTableInSupabase('cashflow_transactions');
    await reportDeleteResult(ok, 'All cashflow entries cleared.');
  };

  // Smart Pay: one payment row per rent month on a single receipt.
  const handleSmartPay = async (req: SmartPayRequest) => {
    const { account, allocations, cash, method, remark, transferId } = req;
    const { tenant, unit, currency } = account;
    const money = (n: number) => formatMoney(n, currency);
    const receiptNumber = nextReceiptNumber(payments.map(p => p.receiptNumber));
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const stamp = Date.now();
    const notes = [remark, transferId && `Transfer ID: ${transferId}`].filter(Boolean).join(' • ') || undefined;

    const rows: PaymentRecord[] = allocations
      .filter(a => a.fromCash > 0)
      .map((a, i) => {
        const remainingAfter = Math.max(0, Math.round((a.month.remaining - a.fromCash) * 100) / 100);
        return {
          id: `pay-${stamp}-${i}`,
          receiptNumber,
          tenantName: tenant.name,
          tenantId: tenant.code,
          unitNumber: unit.unitNumber,
          unitSpace: `${unit.unitNumber} (${unit.floor} ${unit.type})`,
          date,
          accountingPeriod: a.month.label,
          currency,
          amount: a.fromCash,
          paymentMethod: method,
          monthlyBaseRent: a.month.due,
          previousArrears: 0,
          totalDue: a.month.remaining,
          remainingBalance: remainingAfter,
          advanceBalance: 0,
          status: remainingAfter > 0 ? 'Partially Paid' : 'Paid',
          notes,
          receivedBy: adminUser.name,
        };
      });
    if (!rows.length) return;

    const nextPayments = [...rows, ...payments];
    setPayments(nextPayments);

    // Unit balance follows the rent account after this payment
    const after = buildTenantAccount(unit, nextPayments, visibleDeposits);
    const balance = after?.balance || 0;
    const updatedUnit: PropertyUnit = {
      ...unit,
      arrearsUSD: currency === 'USD' ? balance : 0,
      arrearsSSP: currency === 'SSP' ? balance : 0,
      billingStatus: balance > 0 ? (after?.owing.some(m => m.status === 'partial') ? 'Partially Paid' : 'Overdue') : 'Paid',
      billingMonthText: balance > 0 ? `Balance ${money(balance)}` : `Paid • ${allocations[allocations.length - 1]?.month.label || ''}`.trim(),
    };
    setUnits(prev => prev.map(u => u.id === unit.id ? updatedUnit : u));

    const tx: CashflowTransaction = {
      id: `cf-${rows[0].id}`,
      referenceNumber: `CF-${receiptNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
      date,
      title: `Rent: ${tenant.name} (${unit.unitNumber})`,
      category: 'Rent Collection',
      type: 'Inflow',
      amount: cash,
      currency,
      account: 'Central Vault Cash Float',
      recordedBy: adminUser.name,
      status: 'Completed',
      notes: `Rent for ${rows.map(r => r.accountingPeriod).join(', ')}. Receipt: ${receiptNumber}`,
    };
    setCashflow(prev => [tx, ...prev]);

    const results = await Promise.all([
      ...rows.map(r => persist('payments', r, savePaymentToSupabase)),
      persist('units', updatedUnit, saveUnitToSupabase),
      persist('cashflow', tx, saveCashflowToSupabase),
    ]);

    setNotifications(prev => [{
      id: `notif-${stamp}`,
      title: `Payment Recorded: ${receiptNumber}`,
      description: `${money(cash)} from ${tenant.name} (${unit.unitNumber}) for ${allocations.map(a => a.month.short).join(', ')}.`,
      timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      type: 'payment',
      read: false,
      priority: 'medium',
    }, ...prev]);

    setSmartPayKey(null);
    setSelectedReceiptForPrint(rows[0]);
    showToast(results.every(Boolean)
      ? `Payment ${receiptNumber} recorded.`
      : `Payment ${receiptNumber} is saved on this device and will be uploaded to the database automatically.`);
  };

  // Security deposit for chosen months, only offered once rent is paid up to date
  const handleAddTenantDeposit = async ({ account, mode, months, amount, bankAccount, notes }: TenantDepositRequest) => {
    const { tenant, unit, currency } = account;
    const money = (n: number) => formatMoney(n, currency);
    const coverText = mode === 'amount' ? 'any amount (not for a month)' : months.map(m => m.short).join(', ');
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const stamp = Date.now();
    const dep: DepositRecord = {
      id: `dep-${stamp}`,
      depositSlip: nextDepositSlip,
      tenantName: tenant.name,
      tenantId: tenant.id,
      unitNumber: unit.unitNumber,
      ...depositFields(amount, currency),
      depositMonths: months.length,
      monthlyRentUSD: currency === 'USD' ? account.monthlyRent : undefined,
      heldSince: date,
      status: 'Held in Escrow',
      bankAccount,
      notes: `${mode === 'amount' ? AMOUNT_DEPOSIT_TAG : `${DEPOSIT_MONTHS_PREFIX}${months.map(m => m.short).join(', ')}`}.${notes ? ` ${notes}` : ''}`,
    };
    const updatedUnit: PropertyUnit = {
      ...unit,
      ...(currency === 'SSP' ? { escrowDepositSSP: account.depositHeld + amount } : { escrowDepositUSD: account.depositHeld + amount }),
      depositMonths: (unit.depositMonths || 0) + months.length,
    };
    const tx: CashflowTransaction = {
      id: `cf-${dep.id}`,
      referenceNumber: `CF-${dep.depositSlip?.replace(/[^a-zA-Z0-9]/g, '')}`,
      date,
      title: `Deposit: ${tenant.name} (${unit.unitNumber})`,
      category: 'Escrow Deposit',
      type: 'Inflow',
      amount,
      currency,
      account: 'Escrow Trust Account',
      recordedBy: adminUser.name,
      status: 'Completed',
      notes: `Security deposit ${dep.depositSlip} for ${coverText}.`,
    };

    setDeposits(prev => [dep, ...prev]);
    setUnits(prev => prev.map(u => u.id === unit.id ? updatedUnit : u));
    setCashflow(prev => [tx, ...prev]);
    setDepositKey(null);

    const results = await Promise.all([
      persist('deposits', dep, saveDepositToSupabase),
      persist('units', updatedUnit, saveUnitToSupabase),
      persist('cashflow', tx, saveCashflowToSupabase),
    ]);
    setNotifications(prev => [{
      id: `notif-${stamp}`,
      title: `Deposit Held: ${dep.depositSlip}`,
      description: `${money(amount)} from ${tenant.name} (${unit.unitNumber}) for ${coverText}.`,
      timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      type: 'payment',
      read: false,
      priority: 'low',
    }, ...prev]);
    showToast(results.every(Boolean)
      ? `Deposit ${dep.depositSlip} of ${money(amount)} held for ${tenant.name}.`
      : `Deposit ${dep.depositSlip} is saved on this device and will be uploaded automatically.`);
  };

  // Tenant's deposit money still held, written onto the unit
  const unitWithDeposits = (unit: PropertyUnit, allDeposits: DepositRecord[]): PropertyUnit => {
    const key = unit.currentTenant ? accountKey(unit.currentTenant.name, unit.unitNumber) : '';
    const held = allDeposits.filter(d =>
      d.status === 'Held in Escrow' && !isLegacyCreditDeposit(d) && accountKey(d.tenantName, d.unitNumber) === key
    );
    return {
      ...unit,
      escrowDepositUSD: Math.round(held.reduce((s, d) => s + depositIn(d, 'USD'), 0) * 100) / 100,
      escrowDepositSSP: Math.round(held.reduce((s, d) => s + depositIn(d, 'SSP'), 0) * 100) / 100,
      depositMonths: held.reduce((s, d) => s + depositMonthLabels(d).length, 0),
    };
  };

  // Untick months on a month deposit: its money goes down by the removed months
  const handleSaveDepositMonths = async (dep: DepositRecord, keep: string[]) => {
    const labels = depositMonthLabels(dep);
    const removed = labels.filter(l => !keep.includes(l));
    if (!removed.length) return;
    const cur: RentCurrency = (dep.amountSSP || 0) > 0 && !(dep.amountUSD > 0) ? 'SSP' : 'USD';
    const held = depositIn(dep, cur);
    const perMonth = labels.length ? held / labels.length : 0;
    const newAmount = Math.round(perMonth * keep.length * 100) / 100;
    const cut = Math.round((held - newAmount) * 100) / 100;
    const updated: DepositRecord = {
      ...dep,
      ...(cur === 'SSP' ? { amountSSP: newAmount } : { amountUSD: newAmount }),
      depositMonths: keep.length,
      notes: `${withDepositMonths(dep.notes, keep)} Removed ${removed.join(', ')} (${formatMoney(cut, cur)}) on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
    };
    const nextDeposits = deposits.map(d => d.id === dep.id ? updated : d);
    const unit = units.find(u => u.unitNumber === dep.unitNumber);
    const updatedUnit = unit ? unitWithDeposits(unit, nextDeposits) : null;
    const tx = cashflow.find(c => c.id === `cf-${dep.id}`);
    const updatedTx = tx ? { ...tx, amount: Math.max(0, Math.round((tx.amount - cut) * 100) / 100), notes: `${tx.notes || ''} Reduced by ${formatMoney(cut, cur)} (removed ${removed.join(', ')}).`.trim() } : null;

    setDeposits(nextDeposits);
    if (updatedUnit) setUnits(prev => prev.map(u => u.id === updatedUnit.id ? updatedUnit : u));
    if (updatedTx) setCashflow(prev => prev.map(c => c.id === updatedTx.id ? updatedTx : c));

    const results = await Promise.all([
      persist('deposits', updated, saveDepositToSupabase),
      ...(updatedUnit ? [persist('units', updatedUnit, saveUnitToSupabase)] : []),
      ...(updatedTx ? [persist('cashflow', updatedTx, saveCashflowToSupabase)] : []),
    ]);
    showToast(results.every(Boolean)
      ? `Removed ${removed.join(', ')} from ${dep.depositSlip}. Deposit is now ${formatMoney(newAmount, cur)}.`
      : 'Change saved on this device and will be uploaded automatically.');
  };

  // Remove a deposit and its money completely
  const handleClearTenantDeposit = async (dep: DepositRecord) => {
    const nextDeposits = deposits.filter(d => d.id !== dep.id);
    const unit = units.find(u => u.unitNumber === dep.unitNumber);
    const updatedUnit = unit ? unitWithDeposits(unit, nextDeposits) : null;
    const linkedTx = cashflow.filter(c => c.id === `cf-${dep.id}`);

    setPending('deposits', dep.id, false);
    setDeposits(nextDeposits);
    setCashflow(prev => prev.filter(c => !linkedTx.includes(c)));
    if (updatedUnit) setUnits(prev => prev.map(u => u.id === updatedUnit.id ? updatedUnit : u));

    const ok = await deleteDepositFromSupabase(dep.id);
    if (ok) {
      await Promise.all([
        ...linkedTx.map(c => { setPending('cashflow', c.id, false); return deleteCashflowFromSupabase(c.id); }),
        ...(updatedUnit ? [persist('units', updatedUnit, saveUnitToSupabase)] : []),
      ]);
    }
    await reportDeleteResult(ok, `Deposit ${dep.depositSlip || dep.id} cleared.`);
  };

  // When a rent month falls due and is unpaid, pay it from the tenant's deposit.
  // Row ids are fixed per deposit + month, so running this twice (or on two devices)
  // never books the same rent twice.
  useEffect(() => {
    if (!dbReady) return;
    const rows: PaymentRecord[] = [];
    const changedDeposits: DepositRecord[] = [];
    const changedUnits: PropertyUnit[] = [];
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    for (const account of tenantAccounts) {
      const { applications, updated } = planDepositApplications(account);
      const fresh = applications.filter(a => {
        const id = `pay-dep-${a.deposit.id}-${a.month.key}`;
        return !appliedDepositRows.current.has(id) && !payments.some(p => p.id === id);
      });
      if (!fresh.length) continue;
      const left = new Map<string, number>();
      fresh.forEach(a => {
        const id = `pay-dep-${a.deposit.id}-${a.month.key}`;
        appliedDepositRows.current.add(id);
        const before = left.get(a.month.key) ?? a.month.remaining;
        const after = Math.max(0, Math.round((before - a.amount) * 100) / 100);
        left.set(a.month.key, after);
        rows.push({
          id,
          receiptNumber: `#${a.deposit.depositSlip || a.deposit.id}-${a.month.key}`,
          tenantName: account.tenant.name,
          tenantId: account.tenant.code,
          unitNumber: account.unit.unitNumber,
          unitSpace: `${account.unit.unitNumber} (${account.unit.floor} ${account.unit.type})`,
          date,
          accountingPeriod: a.month.label,
          currency: account.currency,
          amount: a.amount,
          paymentMethod: 'Security Deposit',
          monthlyBaseRent: a.month.due,
          previousArrears: 0,
          totalDue: before,
          remainingBalance: after,
          advanceBalance: 0,
          status: after > 0 ? 'Partially Paid' : 'Paid',
          notes: `Paid automatically from deposit ${a.deposit.depositSlip || a.deposit.id}.`,
          receivedBy: adminUser.name,
        });
      });
      const touched = new Set(fresh.map(a => a.deposit.id));
      changedDeposits.push(...updated.filter(d => touched.has(d.id)));
    }
    if (!rows.length) return;

    const nextDeposits = deposits.map(d => changedDeposits.find(c => c.id === d.id) || d);
    const tenantUnits = new Set(changedDeposits.map(d => d.unitNumber));
    units.filter(u => tenantUnits.has(u.unitNumber)).forEach(u => changedUnits.push(unitWithDeposits(u, nextDeposits)));

    setPayments(prev => [...rows.filter(r => !prev.some(p => p.id === r.id)), ...prev]);
    setDeposits(nextDeposits);
    if (changedUnits.length) setUnits(prev => prev.map(u => changedUnits.find(c => c.id === u.id) || u));

    Promise.all([
      ...rows.map(r => persist('payments', r, savePaymentToSupabase)),
      ...changedDeposits.map(d => persist('deposits', d, saveDepositToSupabase)),
      ...changedUnits.map(u => persist('units', u, saveUnitToSupabase)),
    ]);
    const summary = rows.map(r => `${r.tenantName}: ${r.accountingPeriod} ${formatMoney(r.amount, r.currency)}`).join(' • ');
    setNotifications(prev => [{
      id: `notif-dep-${Date.now()}`,
      title: 'Rent paid from deposit',
      description: summary,
      timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      type: 'payment',
      read: false,
      priority: 'low',
    }, ...prev]);
    showToast(`Rent paid from deposit — ${summary}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady, tenantAccounts]);

  // Add or change a waiting list entry; kept on this device until the database accepts it
  const handleSaveWaitingEntry = async (entry: WaitingEntry) => {
    const isNew = !waitingList.some(e => e.id === entry.id);
    setWaitingList(prev => (isNew ? [entry, ...prev] : prev.map(e => (e.id === entry.id ? entry : e))));
    const ok = await saveWaitingEntryToSupabase(entry);
    setWaitingPending(entry.id, !ok);
    if (ok) setWaitingDbReady(true);
    showToast(
      isNew
        ? `${entry.name} added to the ${entry.unitType.toLowerCase()} waiting list.`
        : entry.status === 'Leased'
          ? `${entry.name} leased ${entry.leasedUnit} and left the waiting list.`
          : entry.status === 'Removed'
            ? `${entry.name} taken off the waiting list.`
            : `${entry.name} is back on the waiting list.`
    );
  };

  // Add or change an electricity entry; kept on this device until the database accepts it
  const handleSaveElectricity = async (entry: ElectricityEntry) => {
    const isNew = !electricity.some(e => e.id === entry.id);
    setElectricity(prev => (isNew ? [entry, ...prev.filter(e => e.id !== entry.id)] : prev.map(e => (e.id === entry.id ? entry : e))));
    const ok = await saveElectricityToSupabase(entry);
    setElectricityPending(entry.id, !ok);
    if (ok) setElectricityDbReady(true);
    showToast(`Electricity ${entry.referenceNumber} for ${entry.unitNumber} ${isNew ? 'recorded' : 'updated'}${ok ? '' : ' on this device'}.`);
  };

  const handleDeleteElectricity = async (entry: ElectricityEntry) => {
    setElectricity(prev => prev.filter(e => e.id !== entry.id));
    setElectricityPending(entry.id, false);
    const ok = await deleteElectricityFromSupabase(entry.id);
    showToast(ok ? `Electricity ${entry.referenceNumber} deleted.` : `Electricity ${entry.referenceNumber} deleted on this device.`);
  };

  const handleDeleteWaitingEntry = async (entry: WaitingEntry) => {
    setWaitingList(prev => prev.filter(e => e.id !== entry.id));
    setWaitingPending(entry.id, false);
    const ok = await deleteWaitingEntryFromSupabase(entry.id);
    showToast(ok ? `${entry.name} deleted from the waiting list.` : `${entry.name} deleted on this device.`);
  };

  // Return a held deposit to the tenant
  const handleReleaseDeposit = async (dep: DepositRecord) => {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const released: DepositRecord = {
      ...dep,
      status: 'Refunded',
      notes: `${dep.notes || ''} Released to tenant on ${date}.`.trim(),
    };
    const cur: RentCurrency = (dep.amountSSP || 0) > 0 && !(dep.amountUSD > 0) ? 'SSP' : 'USD';
    const unit = units.find(u => u.unitNumber === dep.unitNumber);
    const updatedUnit = unit
      ? cur === 'SSP'
        ? { ...unit, escrowDepositSSP: Math.max(0, (unit.escrowDepositSSP || 0) - (dep.amountSSP || 0)) }
        : { ...unit, escrowDepositUSD: Math.max(0, (unit.escrowDepositUSD || 0) - dep.amountUSD) }
      : null;
    const tx: CashflowTransaction = {
      id: `cf-release-${dep.id}`,
      referenceNumber: `CF-${(dep.depositSlip || dep.id).replace(/[^a-zA-Z0-9]/g, '')}-R`,
      date,
      title: `Deposit refund: ${dep.tenantName} (${dep.unitNumber})`,
      category: 'Escrow Deposit',
      type: 'Outflow',
      amount: depositIn(dep, cur),
      currency: cur,
      account: 'Escrow Trust Account',
      recordedBy: adminUser.name,
      status: 'Completed',
      notes: `Release of deposit ${dep.depositSlip || dep.id}.`,
    };

    setDeposits(prev => prev.map(d => d.id === dep.id ? released : d));
    if (updatedUnit) setUnits(prev => prev.map(u => u.id === updatedUnit.id ? updatedUnit : u));
    setCashflow(prev => [tx, ...prev]);

    const results = await Promise.all([
      persist('deposits', released, saveDepositToSupabase),
      ...(updatedUnit ? [persist('units', updatedUnit, saveUnitToSupabase)] : []),
      persist('cashflow', tx, saveCashflowToSupabase),
    ]);
    showToast(results.every(Boolean)
      ? `Deposit ${dep.depositSlip || ''} released to ${dep.tenantName}.`
      : 'Release saved on this device and will be uploaded automatically.');
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
    setPaymentSelectedUnitId(found?.id);
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

  // Phones and tablets: the side menu slides in
  const [navOpen, setNavOpen] = useState(false);

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
        <div className="fixed top-3 left-3 right-3 sm:left-auto sm:top-5 sm:right-5 z-60 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
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
          setNavOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        unreadAlertsCount={unreadAlertsCount}
        waitingCount={waitingList.filter(e => e.status === 'Waiting').length}
        adminUser={adminUser}
        onLogout={handleLogout}
        activeBuilding={activeBuilding}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-screen h-dvh overflow-y-auto overflow-x-hidden">
        
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
          units={unitsShown}
          payments={payments}
          onOpenMenu={() => setNavOpen(true)}
        />

        {/* Dynamic Views with Real Functions */}
        <main className="flex-1 pb-16">
          
          {/* 1. DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <DashboardView
              units={unitsShown}
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
              units={unitsShown}
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
              units={unitsShown}
              payments={payments}
              deposits={visibleDeposits}
              onRecordPaymentForTenant={handleRecordPaymentForTenantUnit}
              onSelectReceiptForPrint={(p) => setSelectedReceiptForPrint(p)}
              onModifyTenantPricing={handleModifyTenantPricing}
              onVacateUnit={handleVacateUnit}
              onSaveDeposit={handleSaveDeposit}
              onSaveUnit={handleSaveUnit}
              onDeleteTenant={handleDeleteTenantFromUnit}
              onClearAllTenants={handleClearAllTenants}
              tenantAccounts={tenantAccounts}
              onOpenTenantPayments={(a) => {
                setActiveTab('payments');
                setSmartPayKey(a.key);
              }}
            />
          )}

          {/* 4. PAYMENTS & LEDGER */}
          {activeTab === 'payments' && (
            <PaymentsView
              payments={payments}
              units={unitsShown}
              currencyMode={currencyMode}
              onOpenRecordPayment={() => {
                setPaymentSelectedUnitId(undefined);
                setIsPaymentModalOpen(true);
              }}
              onSelectReceiptForPrint={(p) => setSelectedReceiptForPrint(p)}
              onDeletePayment={handleDeletePayment}
              onClearAllPayments={handleClearAllPayments}
              tenantAccounts={tenantAccounts}
              onOpenTenantAccount={(a) => setSmartPayKey(a.key)}
            />
          )}

          {/* 6. ESCROW DEPOSITS */}
          {activeTab === 'deposits' && (
            <DepositsView
              units={unitsShown}
              currencyMode={currencyMode}
              deposits={visibleDeposits}
              tenantAccounts={tenantAccounts}
              onOpenDeposit={(a) => setDepositKey(a.key)}
              onManageDeposit={(a) => setManageDepositKey(a.key)}
              onOpenTenantPayments={(a) => {
                setActiveTab('payments');
                setSmartPayKey(a.key);
              }}
              onReleaseDeposit={handleReleaseDeposit}
              onDeleteDeposit={handleDeleteDeposit}
              onClearAllDeposits={handleClearAllDeposits}
            />
          )}

          {/* 7. CASH FLOW & RESERVES */}
          {activeTab === 'cashflow' && (
            <CashflowView
              currencyMode={currencyMode}
              transactions={cashflow}
              units={unitsShown}
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
              units={unitsShown}
              payments={payments}
              deposits={visibleDeposits}
              onSelectReceiptForPrint={(p) => setSelectedReceiptForPrint(p)}
              onDeletePayment={handleDeletePayment}
              onClearAllPayments={handleClearAllPayments}
            />
          )}

          {/* 10. ANALYTICS */}
          {activeTab === 'analytics' && (
            <AnalyticsView
              units={unitsShown}
              payments={payments}
              tenantAccounts={tenantAccounts}
              deposits={visibleDeposits}
              cashflow={cashflow}
              waitingList={waitingList}
            />
          )}

          {/* DAILY ELECTRICITY */}
          {activeTab === 'electricity' && (
            <ElectricityView
              entries={electricity}
              units={unitsShown}
              dbReady={electricityDbReady}
              onSave={handleSaveElectricity}
              onDelete={handleDeleteElectricity}
            />
          )}

          {/* WAITING LIST */}
          {activeTab === 'waiting' && (
            <WaitingListView
              entries={waitingList}
              units={unitsShown}
              dbReady={waitingDbReady}
              onAdd={handleSaveWaitingEntry}
              onUpdate={handleSaveWaitingEntry}
              onDelete={handleDeleteWaitingEntry}
              onSaveUnit={handleSaveUnit}
              onSaveDeposit={handleSaveDeposit}
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
        existingReceiptNumbers={payments.map(p => p.receiptNumber)}
        payments={payments}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        units={unitsShown}
        onConfirmPayment={handleConfirmPayment}
        selectedUnitId={paymentSelectedUnitId}
      />

      {/* Official Printable Receipt Voucher */}
      <DepositManageModal
        account={manageDepositAccount}
        onClose={() => setManageDepositKey(null)}
        onSaveMonths={handleSaveDepositMonths}
        onClearDeposit={handleClearTenantDeposit}
      />

      <TenantDepositModal
        account={depositAccount}
        nextSlip={nextDepositSlip}
        onClose={() => setDepositKey(null)}
        onConfirm={handleAddTenantDeposit}
      />

      <SmartPayModal
        account={smartPayAccount}
        onClose={() => setSmartPayKey(null)}
        onConfirm={handleSmartPay}
        onViewReceipt={(p) => setSelectedReceiptForPrint(p)}
        nextReceiptNumber={nextReceiptNumber(payments.map(p => p.receiptNumber))}
      />

      <ReceiptPrintModal
        isOpen={selectedReceiptForPrint !== null}
        onClose={() => setSelectedReceiptForPrint(null)}
        payment={selectedReceiptForPrint}
        allPayments={payments}
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
        units={unitsShown}
        onSelectUnitForPayment={handleOpenRecordPaymentForUnit}
      />

    </div>
  );
}
