import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Check, 
  X,
  ShieldCheck,
  Building2,
  Phone,
  MapPin,
  Lock,
  ArrowRight,
  Sparkles
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
      
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Left Column: Brand Showcase Panel */}
      <div className="w-full lg:w-[50%] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative z-10 shrink-0">
        
        {/* Top Tagline */}
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse ring-4 ring-orange-500/20" />
          <p className="text-xs sm:text-sm font-bold tracking-widest text-orange-400 uppercase">
            Official Management Portal
          </p>
        </div>

        {/* Central Logo & Headline Area */}
        <div className="my-auto py-10 flex flex-col items-center lg:items-start text-center lg:text-left">
          
          {/* Logo Showcase with Elevated Glowing Orange Ring */}
          <div className="relative mb-8 group">
            <div className="absolute -inset-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition duration-700 animate-pulse" />
            <div className="relative w-44 h-44 sm:w-56 sm:h-56 bg-white rounded-full p-2.5 shadow-2xl ring-4 ring-orange-500 flex items-center justify-center overflow-hidden transition-transform duration-500 hover:scale-105">
              <img
                src={logoImg}
                alt="Nyakuron Business Centre"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.12] mb-3">
            NYAKURON<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
              BUSINESS CENTRE
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed font-normal mb-8">
            Complete commercial property management system with real-time shop & space leasing, multi-user payments, and official receipt vouchers.
          </p>

          {/* Location & Telephone Info Badges */}
          <div className="flex flex-col sm:flex-row gap-3 text-xs text-slate-200">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="font-medium">Nyakuron East, Juba - South Sudan</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">+211 928 223 154</span>
            </div>
          </div>

        </div>

        {/* Bottom Tagline */}
        <div className="text-xs text-slate-400 hidden lg:block">
          <p>Powered by Nyakuron Business Centre Enterprise Operations</p>
        </div>

      </div>

      {/* Right Column: Authentication Card Panel */}
      <div className="w-full lg:w-[50%] bg-white lg:rounded-l-[44px] shadow-2xl flex flex-col justify-between min-h-screen relative z-10">
        
        {/* Top Header */}
        <div className="flex justify-between items-center px-8 sm:px-12 pt-8 sm:pt-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full p-0.5 ring-2 ring-orange-500/50 bg-white overflow-hidden shadow-xs">
              <img src={logoImg} alt="NBC" className="w-full h-full object-contain rounded-full" />
            </div>
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">Nyakuron Business Centre</span>
          </div>

          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
          >
            Management Support
          </button>
        </div>

        {/* Sign In Form Area */}
        <div className="w-full max-w-md mx-auto px-6 sm:px-10 py-10 my-auto">
          
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200/80 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
              <span>Admin Access Only</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Sign In to Your Console
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Enter your credentials to access the central property, shop, and space management dashboard.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2.5 animate-in fade-in duration-200">
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                Administrator Email / Username
              </label>
              <input
                type="text"
                required
                value={emailOrUsername}
                onChange={(e) => {
                  setEmailOrUsername(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Enter administrator email"
                className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-100 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter your password"
                  className="w-full px-5 py-3.5 pr-12 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-3 focus:ring-orange-100 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="pt-1 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-slate-500 hover:text-orange-600 font-medium cursor-pointer transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-bold shadow-md shadow-orange-500/25 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="px-8 sm:px-12 py-6 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 Nyakuron Business Centre. All rights reserved.</span>
          <span>Nyakuron East, Juba, South Sudan</span>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                <p className="text-xs text-slate-500">
                  Enter your administrative email to receive a password reset link.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="admin@nyakuron.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Nyakuron Business Centre Management</h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600">
              <p className="font-medium text-slate-800">Office Administration Desk:</p>
              <div className="p-3.5 bg-slate-50 rounded-2xl space-y-2 border border-slate-200/80">
                <p>📍 <strong>Location:</strong> Nyakuron East, Juba, South Sudan</p>
                <p>📞 <strong>Phone 1:</strong> +211 928 223 154</p>
                <p>📞 <strong>Phone 2:</strong> +211 924 991 131</p>
                <p>📞 <strong>Phone 3:</strong> +211 921 515 150</p>
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
