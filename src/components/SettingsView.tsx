import React, { useEffect, useState } from 'react';
import {
  Settings,
  UserCog,
  KeyRound,
  Users,
  UserPlus,
  ShieldCheck,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Power,
  X,
  Check,
  Building2,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { AdminUser, AppRole } from '../types';
import { BUSINESS_PROFILE } from '../data/businessProfile';
import {
  AppAccount,
  MAIN_ADMIN_EMAIL,
  changeMyPassword,
  createAccount,
  deleteAccount,
  listAccounts,
  setAccountPassword,
  updateAccount,
} from '../lib/auth';
import { useConfirm } from './ConfirmDialog';

interface SettingsViewProps {
  user: AdminUser;
  onClearAllData?: () => void;
}

const inputCls = 'w-full h-12 px-4 bg-slate-50 focus:bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all';
const labelCls = 'block text-xs font-bold text-slate-700 mb-1.5 ml-1';
const card = 'bg-white rounded-3xl border border-slate-200/80 shadow-xs';

// Password box with a show / hide eye
const PasswordInput: React.FC<{ id: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }> = ({ id, value, onChange, placeholder, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className={`${inputCls} pr-12`} />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-orange-50 cursor-pointer" title={show ? 'Hide' : 'Show'}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

const Notice: React.FC<{ kind: 'ok' | 'error'; text: string }> = ({ kind, text }) => (
  <div className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
    {kind === 'ok' ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
    <span>{text}</span>
  </div>
);

const RoleBadge: React.FC<{ role: AppRole }> = ({ role }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
    {role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
    {role === 'admin' ? 'Admin' : 'View only'}
  </span>
);

const initials = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

export const SettingsView: React.FC<SettingsViewProps> = ({ user, onClearAllData }) => {
  const isAdmin = user.access === 'admin';
  const confirm = useConfirm();

  // ---- My password ----------------------------------------------------------
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const saveMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdNotice(null);
    if (!current || !next) return setPwdNotice({ kind: 'error', text: 'Fill in your current and new password.' });
    if (next !== again) return setPwdNotice({ kind: 'error', text: 'The two new passwords are not the same.' });
    setPwdBusy(true);
    const res = await changeMyPassword(user.email, current, next);
    setPwdBusy(false);
    if (!res.ok) return setPwdNotice({ kind: 'error', text: res.error });
    setCurrent(''); setNext(''); setAgain('');
    setPwdNotice({ kind: 'ok', text: 'Your password is changed. Use the new one next time you log in.' });
  };

  // ---- Accounts (admin) -----------------------------------------------------
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<{ mode: 'create' } | { mode: 'edit'; account: AppAccount } | { mode: 'password'; account: AppAccount } | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const reload = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const res = await listAccounts();
    setLoading(false);
    if (res.ok) { setAccounts(res.value); setAccountsError(''); } else setAccountsError(res.error);
  };
  useEffect(() => { reload(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (kind: 'ok' | 'error', text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const toggleActive = async (a: AppAccount) => {
    const res = await updateAccount(a.id, { active: !a.active });
    if (!res.ok) return flash('error', res.error);
    flash('ok', `${a.name} is ${a.active ? 'turned off and can no longer log in' : 'turned on again'}.`);
    reload();
  };

  const remove = async (a: AppAccount) => {
    const ok = await confirm({
      title: 'Delete this account?',
      subject: `${a.name} • ${a.email}`,
      message: 'This person will no longer be able to log in. The business data is not touched.',
      confirmLabel: 'Delete account',
    });
    if (!ok) return;
    const res = await deleteAccount(a.id);
    if (!res.ok) return flash('error', res.error);
    flash('ok', `${a.name}'s account is deleted.`);
    reload();
  };

  const isMain = (a: AppAccount) => a.email.toLowerCase() === MAIN_ADMIN_EMAIL;

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className={`relative overflow-hidden ${card}`}>
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{isAdmin ? 'Your account, other accounts and the business details.' : 'Your account and the business details.'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* My account */}
        <div className={`lg:col-span-2 ${card} overflow-hidden`}>
          <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-base font-black shadow-md">{initials(user.name)}</span>
              <div className="min-w-0">
                <p className="text-base font-black truncate">{user.name}</p>
                <p className="text-xs text-slate-300 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <RoleBadge role={isAdmin ? 'admin' : 'viewer'} />
              <span className="text-[11px] text-slate-300">{isAdmin ? 'Can change everything' : 'Can read and print only'}</span>
            </div>
          </div>

          <form onSubmit={saveMyPassword} className="p-5 space-y-3">
            <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-orange-500" /> Change my password</p>
            <div>
              <label htmlFor="pw-current" className={labelCls}>Current password</label>
              <PasswordInput id="pw-current" value={current} onChange={setCurrent} placeholder="Your password now" autoComplete="current-password" />
            </div>
            <div>
              <label htmlFor="pw-next" className={labelCls}>New password</label>
              <PasswordInput id="pw-next" value={next} onChange={setNext} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="pw-again" className={labelCls}>New password again</label>
              <PasswordInput id="pw-again" value={again} onChange={setAgain} placeholder="Type it once more" autoComplete="new-password" />
            </div>
            {pwdNotice && <Notice {...pwdNotice} />}
            <button
              type="submit"
              disabled={pwdBusy}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-extrabold shadow-md shadow-orange-500/25 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {pwdBusy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
              Save new password
            </button>
          </form>
        </div>

        {/* Accounts (admin) or view-only note */}
        <div className={`lg:col-span-3 ${card} overflow-hidden`}>
          {isAdmin ? (
            <>
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><Users className="w-4 h-4 text-orange-500" /> Accounts</p>
                  <p className="text-xs text-slate-500">People who can log in. View-only accounts read and print, nothing else.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={reload} title="Refresh" className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-orange-600 hover:border-orange-200 cursor-pointer">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditor({ mode: 'create' })}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-orange-500/25 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" /> Create account
                  </button>
                </div>
              </div>

              {notice && <div className="px-5 pt-4"><Notice {...notice} /></div>}
              {accountsError && <div className="px-5 pt-4"><Notice kind="error" text={accountsError} /></div>}

              {accounts.length === 0 && !accountsError ? (
                <p className="py-12 text-center text-sm text-slate-400">{loading ? 'Loading…' : 'No accounts yet.'}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {accounts.map(a => (
                    <li key={a.id} className={`px-5 py-3.5 flex flex-wrap items-center gap-3 ${a.active ? '' : 'opacity-60'}`}>
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 bg-gradient-to-br ${a.role === 'admin' ? 'from-orange-500 to-amber-500' : 'from-blue-500 to-indigo-600'}`}>
                        {initials(a.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                          {a.name || a.email} {a.id === user.id && <span className="text-[10px] font-bold text-slate-400">(you)</span>}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{a.email}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <RoleBadge role={a.role} />
                          {!a.active && <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-600 text-[10px] font-black uppercase">Turned off</span>}
                        </div>
                      </div>
                      {!isMain(a) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => setEditor({ mode: 'edit', account: a })} title="Change name or role" className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"><Pencil className="w-4 h-4" /></button>
                          <button type="button" onClick={() => setEditor({ mode: 'password', account: a })} title="Set a new password" className="p-2 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 cursor-pointer"><KeyRound className="w-4 h-4" /></button>
                          <button type="button" onClick={() => toggleActive(a)} title={a.active ? 'Turn off (cannot log in)' : 'Turn on'} className={`p-2 rounded-lg cursor-pointer ${a.active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}><Power className="w-4 h-4" /></button>
                          <button type="button" onClick={() => remove(a)} title="Delete account" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <span className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Eye className="w-7 h-7" /></span>
              <p className="mt-3 text-base font-extrabold text-slate-900">View-only account</p>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">You can open every page, choose any day, month, year or custom period, and print. Only the admin can add, change, pay or delete.</p>
              <p className="mt-3 text-xs text-slate-400">Forgot your password? Ask the admin to set a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Business details */}
      <div className={`${card} p-5`}>
        <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-orange-500" /> Business details</p>
        <p className="text-xs text-slate-500">Printed on every voucher and report</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { icon: Building2, label: 'Name', value: BUSINESS_PROFILE.name },
            { icon: MapPin, label: 'Address', value: BUSINESS_PROFILE.address },
            { icon: Phone, label: 'Phones', value: BUSINESS_PROFILE.phones.join(' • ') },
            { icon: Mail, label: 'Email', value: BUSINESS_PROFILE.email },
            { icon: UserCog, label: 'Manager', value: BUSINESS_PROFILE.managerName },
          ].map(r => {
            const Icon = r.icon;
            return (
              <div key={r.label} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Icon className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{r.label}</p>
                  <p className="font-semibold text-slate-800 break-words">{r.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danger zone (admin) */}
      {isAdmin && onClearAllData && (
        <div className={`${card} p-5 border-rose-200`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-rose-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Clear all data</p>
              <p className="text-xs text-slate-500">Deletes every unit, tenant, payment, deposit and cash flow entry. This cannot be undone.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({ title: 'Clear ALL data?', subject: 'Units, tenants, payments, deposits and cash flow', message: 'Everything is deleted from the database for every user. This cannot be undone.', confirmLabel: 'Clear everything' });
                if (ok) onClearAllData();
              }}
              className="shrink-0 px-4 py-2.5 rounded-xl border-2 border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-extrabold cursor-pointer"
            >
              Clear all data
            </button>
          </div>
        </div>
      )}

      {editor && (
        <AccountEditor
          editor={editor}
          onClose={() => setEditor(null)}
          onDone={text => { setEditor(null); flash('ok', text); reload(); }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Create an account, change its name / role, or set a new password
// ---------------------------------------------------------------------------

const randomPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), n => chars[n % chars.length]).join('');
};

const AccountEditor: React.FC<{
  editor: { mode: 'create' } | { mode: 'edit'; account: AppAccount } | { mode: 'password'; account: AppAccount };
  onClose: () => void;
  onDone: (message: string) => void;
}> = ({ editor, onClose, onDone }) => {
  const account = editor.mode === 'create' ? null : editor.account;
  const [name, setName] = useState(account?.name || '');
  const [email, setEmail] = useState(account?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>(account?.role || 'viewer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const title = editor.mode === 'create' ? 'Create account' : editor.mode === 'edit' ? 'Change account' : 'Set a new password';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = editor.mode === 'create'
      ? await createAccount({ name, email, password, role })
      : editor.mode === 'edit'
        ? await updateAccount(editor.account.id, { name: name.trim(), role })
        : await setAccountPassword(editor.account.id, password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone(
      editor.mode === 'create' ? `${name.trim()} can now log in with ${email.trim().toLowerCase()}.`
        : editor.mode === 'edit' ? `${name.trim()} is saved.`
        : `New password set for ${editor.account.name}. Give it to them.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
              {editor.mode === 'password' ? <KeyRound className="w-6 h-6" /> : editor.mode === 'create' ? <UserPlus className="w-6 h-6" /> : <Pencil className="w-6 h-6" />}
            </span>
            <div>
              <h2 className="text-lg font-black">{title}</h2>
              <p className="text-xs text-white/85">{account ? account.email : 'Name, email, password and what they can do'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/20 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {editor.mode !== 'password' && (
            <div>
              <label htmlFor="acc-name" className={labelCls}>Full name</label>
              <input id="acc-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amina Hassan" className={inputCls} autoFocus />
            </div>
          )}
          {editor.mode === 'create' && (
            <div>
              <label htmlFor="acc-email" className={labelCls}>Email (used to log in)</label>
              <input id="acc-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className={inputCls} autoComplete="off" />
            </div>
          )}
          {editor.mode !== 'edit' && (
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="acc-pass" className={labelCls}>{editor.mode === 'create' ? 'Password' : 'New password'}</label>
                <button type="button" onClick={() => setPassword(randomPassword())} className="text-[11px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer mb-1.5">Make one for me</button>
              </div>
              <PasswordInput id="acc-pass" value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
          )}
          {editor.mode !== 'password' && (
            <div>
              <p className={labelCls}>What can they do?</p>
              <div className="grid grid-cols-2 gap-2">
                {([['viewer', 'View only', 'Read and print', Eye], ['admin', 'Admin', 'Change everything', ShieldCheck]] as [AppRole, string, string, typeof Eye][]).map(([r, label, sub, Icon]) => {
                  const on = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-2xl border-2 p-3 text-left transition-all cursor-pointer ${
                        on ? (r === 'admin' ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50') : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${r === 'admin' ? 'text-orange-600' : 'text-blue-600'}`} />
                      <p className="mt-1 text-sm font-extrabold text-slate-900">{label}</p>
                      <p className="text-[11px] text-slate-500">{sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {error && <Notice kind="error" text={error} />}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-extrabold shadow-md shadow-orange-500/25 cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {busy && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {editor.mode === 'create' ? 'Create account' : editor.mode === 'edit' ? 'Save' : 'Set password'}
          </button>
        </div>
      </form>
    </div>
  );
};
