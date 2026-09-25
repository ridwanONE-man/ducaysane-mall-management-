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
import { SettingsView } from './components/SettingsView';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { ReceiptPrintModal } from './components/ReceiptPrintModal';
import { AddUnitModal } from './components/AddUnitModal';
import { FloorMapView } from './components/FloorMapView';

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

import { 
  initialUnits, 
  initialPayments, 
  initialDeposits,
  initialCashflowTransactions,
  initialCommercialNotifications 
} from './data/commercialData';

import { 
  getUnitsFromSupabase, 
  saveUnitToSupabase, 
  saveUnitsBulkToSupabase,
  deleteUnitFromSupabase,
  getPaymentsFromSupabase, 
  savePaymentToSupabase, 
  savePaymentsBulkToSupabase,
  getDepositsFromSupabase,
  saveDepositToSupabase,
  saveDepositsBulkToSupabase,
  getCashflowFromSupabase,
  saveCashflowToSupabase,
  saveCashflowsBulkToSupabase,
  clearAllSupabaseData,
  subscribeToRealtimeChanges,
  RealtimeStatus
} from './lib/supabaseService';

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

  // Core Data States (initialized with defaults, then hydrated from Supabase)
  const [units, setUnits] = useState<PropertyUnit[]>(() => {
    try {
      const saved = localStorage.getItem('nbc_units');
      return saved ? JSON.parse(saved) : initialUnits;
    } catch {
      return initialUnits;
    }
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('nbc_payments');
      return saved ? JSON.parse(saved) : initialPayments;
    } catch {
      return initialPayments;
    }
  });

  const [deposits, setDeposits] = useState<DepositRecord[]>(() => {
    try {
      const saved = localStorage.getItem('nbc_deposits');
      return saved ? JSON.parse(saved) : initialDeposits;
    } catch {
      return initialDeposits;
    }
  });

  const [cashflow, setCashflow] = useState<CashflowTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('nbc_cashflow');
      return saved ? JSON.parse(saved) : initialCashflowTransactions;
    } catch {
      return initialCashflowTransactions;
    }
  });

  const [notifications, setNotifications] = useState<CommercialNotification[]>(initialCommercialNotifications);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeBuilding] = useState('Nyakuron Business Centre');

  // Supabase Real-time connection status
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');

  // Unit editing state
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);

  // Persistence to localStorage for offline cache
  useEffect(() => {
    try {
      localStorage.setItem('nbc_units', JSON.stringify(units));
    } catch (e) {}
  }, [units]);

  useEffect(() => {
    try {
      localStorage.setItem('nbc_payments', JSON.stringify(payments));
    } catch (e) {}
  }, [payments]);

  useEffect(() => {
    try {
      localStorage.setItem('nbc_deposits', JSON.stringify(deposits));
    } catch (e) {}
  }, [deposits]);

  useEffect(() => {
    try {
      localStorage.setItem('nbc_cashflow', JSON.stringify(cashflow));
    } catch (e) {}
  }, [cashflow]);

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

    async function hydrateAndSync() {
      try {
        setRealtimeStatus('connecting');

        const [dbUnits, dbPayments, dbDeposits, dbCashflow] = await Promise.all([
          getUnitsFromSupabase(),
          getPaymentsFromSupabase(),
          getDepositsFromSupabase(),
          getCashflowFromSupabase(),
        ]);

        if (!isMounted) return;

        // 1. Units Hydration / Seeding
        if (dbUnits.length === 0) {
          console.log('Supabase units table empty. Auto-seeding initial inventory...');
          await saveUnitsBulkToSupabase(initialUnits);
          setUnits(initialUnits);
        } else {
          setUnits(dbUnits);
        }

        // 2. Payments Hydration / Seeding
        if (dbPayments.length === 0) {
          console.log('Supabase payments table empty. Auto-seeding initial ledger...');
          await savePaymentsBulkToSupabase(initialPayments);
          setPayments(initialPayments);
        } else {
          setPayments(dbPayments);
        }

        // 3. Deposits Hydration / Seeding
        if (dbDeposits.length === 0) {
          console.log('Supabase deposits table empty. Auto-seeding initial escrow...');
          await saveDepositsBulkToSupabase(initialDeposits);
          setDeposits(initialDeposits);
        } else {
          setDeposits(dbDeposits);
        }

        // 4. Cashflow Hydration / Seeding
        if (dbCashflow.length === 0) {
          console.log('Supabase cashflow table empty. Auto-seeding initial cashflow...');
          await saveCashflowsBulkToSupabase(initialCashflowTransactions);
          setCashflow(initialCashflowTransactions);
        } else {
          setCashflow(dbCashflow);
        }
      } catch (err) {
        console.warn('Supabase initial fetch failed:', err);
      }
    }

    hydrateAndSync();

    // Subscribe to multi-user changes across all tables
    const unsubscribe = subscribeToRealtimeChanges({
      onStatusChange: (status) => {
        if (isMounted) setRealtimeStatus(status);
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

  // Login handler
  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    showToast('Logged in successfully. Real-time multi-user synchronization active.');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
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
    if (isExisting) {
      setUnits(prev => prev.map(u => u.id === unitToSave.id ? unitToSave : u));
      showToast(`Unit ${unitToSave.unitNumber} updated and synced.`);
    } else {
      setUnits(prev => [unitToSave, ...prev]);
      showToast(`Unit ${unitToSave.unitNumber} (${unitToSave.floor}) registered and synced.`);
    }
    await saveUnitToSupabase(unitToSave);
  };

  // Delete Unit Handler
  const handleDeleteUnit = async (unitId: string) => {
    const found = units.find(u => u.id === unitId);
    setUnits(prev => prev.filter(u => u.id !== unitId));
    showToast(`Unit ${found?.unitNumber || ''} deleted from inventory.`);
    await deleteUnitFromSupabase(unitId);
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

  // Quick action: record payment for specific unit
  const handleOpenRecordPaymentForUnit = (unitId: string) => {
    setPaymentSelectedUnitId(unitId);
    setIsPaymentModalOpen(true);
  };

  // Quick action: record payment for tenant name or unit number
  const handleRecordPaymentForTenantUnit = (unitNumber: string) => {
    const found = units.find(u => u.unitNumber === unitNumber);
    if (found) {
      setPaymentSelectedUnitId(found.id);
    }
    setIsPaymentModalOpen(true);
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
            if (q.trim().length > 0 && activeTab === 'dashboard') {
              setActiveTab('units');
            }
          }}
          onNavigate={setActiveTab}
          onLogout={handleLogout}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          realtimeStatus={realtimeStatus}
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
            />
          )}

          {/* 6. ESCROW DEPOSITS */}
          {activeTab === 'deposits' && (
            <DepositsView
              units={units}
              currencyMode={currencyMode}
              deposits={deposits}
              onSaveDeposit={handleSaveDeposit}
            />
          )}

          {/* 7. CASH FLOW & RESERVES */}
          {activeTab === 'cashflow' && (
            <CashflowView
              currencyMode={currencyMode}
              transactions={cashflow}
              onSaveTransaction={handleSaveCashflow}
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
            />
          )}

          {/* 9. REPORTS & ANALYTICS */}
          {(activeTab === 'reports' || activeTab === 'analytics') && (
            <ReportsView
              units={units}
              payments={payments}
            />
          )}

          {/* 10. SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsView onClearAllData={handleClearAllData} />
          )}

          {/* 11. AUDIT NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Commercial Audit Notifications</h1>
                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkNotificationsRead}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-700 text-xs">No Audit Notifications</p>
                    <p className="text-[11px] text-slate-400 mt-1">Audit notices, payment alerts, and lease warnings will appear here.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{n.title}</span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{n.description}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">{n.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
