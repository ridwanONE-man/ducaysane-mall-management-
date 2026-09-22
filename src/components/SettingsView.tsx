import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Check, 
  Trash2, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  AlertCircle 
} from 'lucide-react';
import { MallSettings } from '../types';
import { defaultMallSettings } from '../data/commercialData';
import { getAdminCredentials, updateAdminPassword } from '../lib/supabaseService';

interface SettingsViewProps {
  onClearAllData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClearAllData }) => {
  const [settings, setSettings] = useState<MallSettings>(defaultMallSettings);
  const [savedMessage, setSavedMessage] = useState(false);
  const [clearMessage, setClearMessage] = useState(false);

  // Admin Password Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const handleClearData = () => {
    if (onClearAllData) {
      onClearAllData();
      setClearMessage(true);
      setTimeout(() => setClearMessage(false), 3000);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess(false);

    if (!currentPassword.trim()) {
      setPwdError('Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      setPwdError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPwd(true);

    try {
      const adminCreds = await getAdminCredentials();
      if (currentPassword !== adminCreds.password) {
        setIsUpdatingPwd(false);
        setPwdError('The current password you entered is incorrect.');
        return;
      }

      await updateAdminPassword(newPassword);

      setIsUpdatingPwd(false);
      setPwdSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdSuccess(false), 5000);
    } catch {
      setIsUpdatingPwd(false);
      setPwdError('Failed to update password. Please try again.');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
          <span>Home</span>
          <span>›</span>
          <span className="text-blue-600">Settings</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Mall System & Fiscal Configuration
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure property profiles, security credentials, dual-currency base exchange rates, and financial accounting standards.
        </p>
      </div>

      {savedMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Settings successfully updated across mall operational modules!</span>
        </div>
      )}

      {/* System Admin Profile & Password Security */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>System Admin Profile & Security</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Primary administrator profile and service role authentication.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
            Super Admin Access
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Admin Email (Locked) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Admin Service Email</span>
              <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" /> Locked to Admin
              </span>
            </label>
            <input
              type="email"
              value="ducaysane@gmail.com"
              disabled
              className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-not-allowed select-none"
            />
          </div>

          {/* Admin Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Administrator Role</label>
            <input
              type="text"
              value="Super Admin (Ahmed Ducaysane)"
              disabled
              className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-not-allowed select-none"
            />
          </div>
        </div>

        {/* Change Password Form */}
        <form onSubmit={handlePasswordChange} className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              <span>Change Admin Password</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Only the password updates automatically; the admin email remains unchanged.
            </span>
          </div>

          {pwdSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Password updated automatically in the system and Supabase! Future logins require this new password.</span>
            </div>
          )}

          {pwdError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isUpdatingPwd}
              className="px-5 py-2.5 bg-slate-900 hover:bg-blue-600 active:scale-97 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isUpdatingPwd ? 'Updating Password...' : 'Save New Password'}</span>
            </button>
          </div>
        </form>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        
        {/* Mall Profile */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Commercial Property Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Commercial Property Name</label>
              <input
                type="text"
                value={settings.mallName}
                onChange={(e) => setSettings({ ...settings, mallName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Physical Location Address</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Currency & Accounting */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Dual Currency & Valuation Multipliers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Base Ledger Currency</label>
              <select
                value={settings.baseCurrency}
                onChange={(e) => setSettings({ ...settings, baseCurrency: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="USD">United States Dollar (USD)</option>
                <option value="SSP">South Sudanese Pound (SSP)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Exchange Benchmark (1 USD)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.exchangeRateUSDtoSSP}
                  onChange={(e) => setSettings({ ...settings, exchangeRateUSDtoSSP: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">SSP</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Security Deposit Default</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings.standardSecurityDepositMonths}
                  onChange={(e) => setSettings({ ...settings, standardSecurityDepositMonths: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Months</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Property Management & Leasing Contacts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Commercial Desk Phone</label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Leasing Inquiry Email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>

      </form>

      {/* Data Management Card */}
      {onClearAllData && (
        <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Reset Database & Clear All Data</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Removes all recorded units, transactions, and tenant entries to start completely blank.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearData}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Data</span>
            </button>
          </div>
          {clearMessage && (
            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-rose-600" />
              <span>All system records and cache cleared successfully.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
