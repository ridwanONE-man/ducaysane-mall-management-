import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { AdminUser, AppRole } from '../types';

// The one account that can always change data and manage the other accounts.
export const MAIN_ADMIN_EMAIL = 'ducaysane@gmail.com';

export interface AppAccount {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  active: boolean;
  createdAt: string;
}

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

// Turns Supabase's messages into plain words
function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'This account is not activated yet. Ask the admin to open Settings and save it again.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists.';
  if (m.includes('password should be at least') || m.includes('at least 6')) return 'Password must be at least 6 characters.';
  if (m.includes('only the admin')) return 'Only the admin can do this.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No internet connection. Try again.';
  if (m.includes('does not exist') || m.includes('schema cache')) return 'Accounts are not set up in the database yet (run supabase/accounts_security.sql).';
  return message;
}

// The signed-in person as the app uses them, with their role from app_users
async function profileFor(userId: string, email: string): Promise<AdminUser | null> {
  const isMain = email.toLowerCase() === MAIN_ADMIN_EMAIL;
  const { data } = await supabase.from('app_users').select('*').eq('id', userId).maybeSingle();
  // Only accounts the admin created (and has not turned off) may enter
  if (!isMain && (!data || data.active === false)) return null;
  const access: AppRole = isMain || data?.role === 'admin' ? 'admin' : 'viewer';
  return {
    id: userId,
    name: data?.name || (isMain ? 'Mohamed Mohamoud' : email.split('@')[0]),
    email,
    role: access === 'admin' ? 'Admin' : 'View only',
    access,
    avatar: '/logo.png',
    lastLogin: 'Just now',
  };
}

export async function signIn(email: string, password: string): Promise<Result<AdminUser>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return fail(explain(error?.message || 'Could not sign in.'));
    const user = await profileFor(data.user.id, data.user.email || email);
    if (!user) {
      await supabase.auth.signOut();
      return fail('This account is turned off, or it was not created by the admin.');
    }
    return { ok: true, value: user };
  } catch (err) {
    return fail(explain(String((err as Error)?.message || err)));
  }
}

// The person already signed in on this device (null when nobody is)
export async function currentUser(): Promise<AdminUser | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    const user = await profileFor(u.id, u.email || '');
    if (!user) await supabase.auth.signOut();
    return user;
  } catch {
    return null;
  }
}

export async function signOut() {
  try { await supabase.auth.signOut(); } catch { /* already signed out */ }
}

export function onSignedOut(callback: () => void) {
  const { data } = supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') callback();
  });
  return () => data.subscription.unsubscribe();
}

// Change your own password; the current one is checked first
export async function changeMyPassword(email: string, current: string, next: string): Promise<Result> {
  if (next.length < 6) return fail('The new password must be at least 6 characters.');
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) return fail('Your current password is not correct.');
  const { error } = await supabase.auth.updateUser({ password: next });
  return error ? fail(explain(error.message)) : { ok: true, value: undefined };
}

// ---------------------------------------------------------------------------
// Admin: manage the other accounts
// ---------------------------------------------------------------------------

export async function listAccounts(): Promise<Result<AppAccount[]>> {
  const { data, error } = await supabase.from('app_users').select('*').order('created_at', { ascending: true });
  if (error) return fail(explain(error.message));
  return {
    ok: true,
    value: (data || []).map(r => ({
      id: r.id,
      email: r.email,
      name: r.name || '',
      role: r.role === 'admin' ? 'admin' : 'viewer',
      active: r.active !== false,
      createdAt: r.created_at,
    })),
  };
}

export async function createAccount(input: { name: string; email: string; password: string; role: AppRole }): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  if (!input.name.trim()) return fail('Type the person\'s name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Type a valid email.');
  if (input.password.length < 6) return fail('Password must be at least 6 characters.');
  try {
    // A separate client, so creating the account does not sign the admin out
    const temp = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'nbc-account-create' },
    });
    const { data, error } = await temp.auth.signUp({ email, password: input.password, options: { data: { name: input.name.trim() } } });
    if (error) return fail(explain(error.message));
    const id = data.user?.id;
    if (!id || (data.user?.identities && data.user.identities.length === 0)) return fail('An account with this email already exists.');

    const confirm = await supabase.rpc('admin_confirm_user', { uid: id });
    if (confirm.error) return fail(explain(confirm.error.message));
    const { error: rowError } = await supabase.from('app_users').upsert({ id, email, name: input.name.trim(), role: input.role, active: true });
    if (rowError) return fail(explain(rowError.message));
    return { ok: true, value: undefined };
  } catch (err) {
    return fail(explain(String((err as Error)?.message || err)));
  }
}

export async function updateAccount(id: string, changes: { name?: string; role?: AppRole; active?: boolean }): Promise<Result> {
  const { error } = await supabase.from('app_users').update(changes).eq('id', id);
  if (error) return fail(explain(error.message));
  // Saving again also activates an account that could not log in yet
  await supabase.rpc('admin_confirm_user', { uid: id });
  return { ok: true, value: undefined };
}

export async function setAccountPassword(id: string, password: string): Promise<Result> {
  if (password.length < 6) return fail('Password must be at least 6 characters.');
  const { error } = await supabase.rpc('admin_set_password', { uid: id, new_password: password });
  return error ? fail(explain(error.message)) : { ok: true, value: undefined };
}

export async function deleteAccount(id: string): Promise<Result> {
  const { error } = await supabase.rpc('admin_delete_user', { uid: id });
  return error ? fail(explain(error.message)) : { ok: true, value: undefined };
}
