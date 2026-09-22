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
  CurrencyMode,
  CommercialNotification
} from './types';

import { 
  initialUnits, 
  initialPayments, 
  initialCommercialNotifications 
} from './data/commercialData';
import { 
  getUnitsFromSupabase, 
  saveUnitToSupabase, 
  getPaymentsFromSupabase, 
  savePaymentToSupabase, 
  clearAllSupabaseData 
} from './lib/supabaseService';

export default function App() {
  // Authentication State: Defaults to LoginPage as requested by user
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<AdminUser>({
    id: 'usr-admin-1',
    name: 'Ahmed Ducaysane',
    email: 'ducaysane@gmail.com',
    role: 'Super Admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    lastLogin: 'Just now'
  });

  // App Navigation & Data State
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  // Purge any legacy default caches on load
  const [units, setUnits] = useState<PropertyUnit[]>(() => {
    try {
      // Clear legacy mallcore cache keys
      const legacyKeys = [
        'mallcore_units_clean',
        'mallcore_payments_clean',
        'mallcore_units',
        'mallcore_payments',
        'mallcore_cache',
        'mallcore_settings',
        'mallcore_notifications'
      ];
      legacyKeys.forEach(k => localStorage.removeItem(k));

      // Clear all legacy cache on first version run
      if (!localStorage.getItem('ducaysane_cache_v1_purged')) {
        localStorage.clear();
        localStorage.setItem('ducaysane_cache_v1_purged', 'true');
        return [];
      }

      const saved = localStorage.getItem('ducaysane_units');
      return saved ? JSON.parse(saved) : initialUnits;
    } catch {
      return initialUnits;
    }
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ducaysane_payments');
      return saved ? JSON.parse(saved) : initialPayments;
    } catch {
      return initialPayments;
    }
  });

  const [notifications, setNotifications] = useState<CommercialNotification[]>(initialCommercialNotifications);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeBuilding, setActiveBuilding] = useState('Juba Central Mall');

  // Persistence for user-created records
  useEffect(() => {
    try {
      localStorage.setItem('ducaysane_units', JSON.stringify(units));
    } catch (e) {}
  }, [units]);

  useEffect(() => {
    try {
      localStorage.setItem('ducaysane_payments', JSON.stringify(payments));
    } catch (e) {}
  }, [payments]);

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

  const handleClearAllData = () => {
    setUnits([]);
    setPayments([]);
    setNotifications([]);
    try {
      localStorage.clear();
      localStorage.setItem('ducaysane_cache_v1_purged', 'true');
    } catch (e) {}
    showToast('All system records and cache have been completely cleared.');
  };

  // Login handler
  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setIsAuthenticated(true);
    setActiveTab('dashboard');
    showToast('Logged in successfully. Welcome to MallCore CRE Portal.');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // Payment Confirmation Handler
  const handleConfirmPayment = (newPayment: PaymentRecord) => {
    setPayments(prev => [newPayment, ...prev]);

    // Update the unit's billing status
    setUnits(prev => prev.map(u => {
      if (u.unitNumber === newPayment.unitNumber) {
        return {
          ...u,
          billingStatus: newPayment.remainingBalance > 0 ? 'Partially Paid' : 'Paid',
          billingMonthText: newPayment.remainingBalance > 0 
            ? `Partially Paid (${newPayment.currency})` 
            : `Paid • ${newPayment.accountingPeriod}`,
          arrearsUSD: newPayment.currency === 'USD' ? newPayment.remainingBalance : u.arrearsUSD,
          arrearsSSP: newPayment.currency === 'SSP' ? newPayment.remainingBalance : u.arrearsSSP
        };
      }
      return u;
    }));

    // Add alert notification
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
    showToast(`Payment ${newPayment.receiptNumber} recorded and ledger updated.`);
  };

  // Add Unit Handler
  const handleAddUnit = (newUnit: PropertyUnit) => {
    setUnits(prev => [newUnit, ...prev]);
    showToast(`Unit ${newUnit.unitNumber} (${newUnit.floor}) registered to mall inventory.`);
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
    <div id="mallcore-app-layout" className="min-h-screen bg-slate-50 flex flex-row antialiased text-slate-800">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-60 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
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
        
        {/* Redesigned Minimalist & Attractive Header */}
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
              onOpenAddUnit={() => setIsAddUnitModalOpen(true)}
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
              onOpenAddUnit={() => setIsAddUnitModalOpen(true)}
              onOpenFloorMap={() => setIsFloorMapOpen(true)}
            />
          )}

          {/* 3. TENANTS DIRECTORY */}
          {activeTab === 'tenants' && (
            <TenantsView
              onRecordPaymentForTenant={handleRecordPaymentForTenantUnit}
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
            />
          )}

          {/* 7. CASH FLOW & RESERVES */}
          {activeTab === 'cashflow' && (
            <CashflowView
              currencyMode={currencyMode}
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

      {/* Register New Commercial Unit Modal */}
      <AddUnitModal
        isOpen={isAddUnitModalOpen}
        onClose={() => setIsAddUnitModalOpen(false)}
        onAddUnit={handleAddUnit}
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
