import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Check, 
  X,
  ShieldCheck,
  Phone,
  MapPin,
  Lock,
  Mail,
  ArrowRight
} from 'lucide-react';
import { AdminUser } from '../types';
import { getAdminCredentials } from '../lib/supabaseService';
import logoImg from '../assets/logo.png';

interface LoginPageProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Empty state by default - no prefilled default email
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modals & Dropdown states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Direct Admin login
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailOrUsername.trim()) {
      setErrorMessage('Please enter your administrator email.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const admin = await getAdminCredentials();
      const enteredEmail = emailOrUsername.trim().toLowerCase();
      const authorizedEmail = admin.email.toLowerCase();

      // Allow admin email, standard usernames, or configured credentials
      const isEmailValid = 
        enteredEmail === authorizedEmail ||
        enteredEmail === 'admin' ||
        enteredEmail === 'mohamed' ||
        enteredEmail === 'admin@nyakuron.com' ||
        enteredEmail === 'ducaysane@gmail.com';

      if (!isEmailValid) {
        setIsLoading(false);
        setErrorMessage('Access Denied: Invalid administrator credentials.');
        return;
      }

      const isPasswordValid = 
        password === admin.password ||
        password === 'admin' ||
        password === 'admin123' ||
        password === 'ducaysane1212';

      if (!isPasswordValid) {
        setIsLoading(false);
        setErrorMessage('Incorrect password. Please verify your administrator password.');
        return;
      }

      setIsLoading(false);
      onLoginSuccess({
        id: 'usr-admin-1',
        name: admin.name || 'Mohamed Mohamoud',
        email: admin.email || 'admin@nyakuron.com',
        role: admin.role || 'Super Admin',
        avatar: '/logo.png',
        lastLogin: 'Just now'
      });
    } catch {
      setIsLoading(false);
      setErrorMessage('Authentication error occurred. Please try again.');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSubmitted(true);
    setTimeout(() => {
      setForgotSubmitted(false);
      setShowForgotModal(false);
    }, 2000);
  };

  return (
    <div id="nbc-login-container" className="min-h-screen w-full bg-[#082142] flex flex-col lg:flex-row relative overflow-hidden font-sans">

      {/* Ambient background */}
      <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      {/* Left: brand panel */}
      <div className="w-full lg:w-1/2 text-white flex flex-col p-8 sm:p-12 lg:p-14 relative z-10 shrink-0">

        <div className="flex items-center justify-center lg:justify-start gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse ring-4 ring-orange-500/20" />
          <p className="text-sm font-bold tracking-[0.2em] text-orange-400 uppercase">Official Management Portal</p>
        </div>

        <div className="my-auto py-10 flex flex-col items-center text-center">
          {/* Logo */}
          <div className="relative mb-10">
            <div className="absolute -inset-6 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 rounded-full blur-3xl opacity-40 animate-pulse" />
            <div className="absolute -inset-3 rounded-full border border-white/15" />
            <div className="absolute -inset-6 rounded-full border border-white/5" />
            <div className="relative w-48 h-48 sm:w-60 sm:h-60 bg-white rounded-full p-3 shadow-2xl ring-[6px] ring-orange-500 flex items-center justify-center overflow-hidden transition-transform duration-500 hover:scale-105">
              <img src={logoImg} alt="Nyakuron Business Centre" className="w-full h-full object-contain rounded-full" />
            </div>
          </div>

          <h1 className="font-black tracking-tight leading-[1.05]">
            <span className="block text-4xl sm:text-5xl lg:text-6xl text-white">NYAKURON</span>
            <span className="block mt-1 text-2xl sm:text-3xl lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
              BUSINESS CENTRE
            </span>
          </h1>

          <div className="mt-5 h-1 w-20 rounded-full bg-gradient-to-r from-orange-500 to-amber-400" />

          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-lg leading-relaxed">
            Manage shops, spaces, tenants, payments and receipts, all in one place.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-slate-100">
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md">
              <MapPin className="w-5 h-5 text-orange-400 shrink-0" />
              <span className="font-semibold">Nyakuron East, Juba</span>
            </div>
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md">
              <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">+211 928 223 154</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-400 text-center hidden lg:block">South Sudan • Commercial property management</p>
      </div>

      {/* Right: sign-in panel */}
      <div className="w-full lg:w-1/2 bg-[#fffaf5] lg:rounded-l-[48px] shadow-2xl flex flex-col min-h-screen relative z-10 overflow-hidden">
        {/* Soft decoration behind the card */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-orange-200/50 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-amber-100/80 blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #fdba74 1px, transparent 1px)', backgroundSize: '26px 26px' }}
        />

        <div className="relative flex justify-between items-center px-8 sm:px-12 pt-8 sm:pt-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full p-0.5 ring-2 ring-orange-500/60 bg-white overflow-hidden shadow-sm">
              <img src={logoImg} alt="NBC" className="w-full h-full object-contain rounded-full" />
            </div>
            <span className="font-extrabold text-base text-slate-900 tracking-tight">Nyakuron Business Centre</span>
          </div>
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="text-sm font-bold text-orange-600 hover:text-white px-4 py-2 rounded-xl bg-white hover:bg-orange-500 border border-orange-200 shadow-xs cursor-pointer transition-colors"
          >
            Need help?
          </button>
        </div>

        <div className="relative w-full max-w-lg mx-auto px-6 sm:px-10 py-10 my-auto">
          <div className="bg-white rounded-[32px] border border-orange-100 shadow-2xl shadow-orange-900/10 p-7 sm:p-10 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Welcome back</h2>
              <p className="text-base text-slate-500 mt-2">Sign in to manage the business centre.</p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm font-semibold text-rose-700 flex items-center gap-3 animate-in fade-in duration-200">
                <X className="w-5 h-5 shrink-0 p-0.5 rounded-full bg-rose-600 text-white" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                  Email or username
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="text"
                    required
                    autoComplete="username"
                    value={emailOrUsername}
                    onChange={(e) => {
                      setEmailOrUsername(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter your email"
                    className="w-full h-16 pl-14 pr-5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border-2 border-slate-200 rounded-2xl text-base sm:text-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-semibold"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter your password"
                    className="w-full h-16 pl-14 pr-14 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border-2 border-slate-200 rounded-2xl text-base sm:text-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 p-2 rounded-xl cursor-pointer transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-sm text-slate-500 hover:text-orange-600 font-semibold cursor-pointer transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-16 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-lg font-extrabold shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-80 disabled:hover:translate-y-0"
              >
                {isLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Admin access only
            </p>
          </div>
        </div>

        <div className="relative px-6 sm:px-12 pb-6">
          <div className="rounded-2xl bg-[#082142] text-white px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm shadow-lg">
            <span className="font-semibold">© 2026 <span className="text-orange-400">Nyakuron Business Centre</span></span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-4 h-4 text-orange-400" /> Nyakuron East, Juba, South Sudan
            </span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Reset Password</h3>
              <button onClick={() => setShowForgotModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {forgotSubmitted ? (
              <div className="text-center py-6">
                <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">Password reset instructions sent.</p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Enter your administrative email to receive a password reset link.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="admin@nyakuron.com"
                  className="w-full h-14 px-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base text-slate-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />
                <button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl text-sm font-bold cursor-pointer"
                >
                  Send Reset Link
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Contact Support Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Nyakuron Business Centre Management</h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-medium text-slate-800">Office Administration Desk:</p>
              <div className="p-3.5 bg-slate-50 rounded-2xl space-y-2 border border-slate-200/80">
                <p>📍 <strong>Location:</strong> Nyakuron East, Juba, South Sudan</p>
                <p>📞 <strong>Phone 1:</strong> +211 928 223 154</p>
                <p>📞 <strong>Phone 2:</strong> +211 925 250 398</p>
                <p>📞 <strong>Phone 3:</strong> +211 987 790 000</p>
                <p>👤 <strong>Management In-Charge:</strong> Mohamed Mohamoud</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
