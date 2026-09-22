import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  ChevronDown, 
  Check, 
  X,
  ShieldCheck,
  Send,
  MessageSquare
} from 'lucide-react';
import { AdminUser } from '../types';
import { getAdminCredentials } from '../lib/supabaseService';
import skyscraperImg from '../assets/skyscraper.jpg';

interface LoginPageProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modals & Dropdown states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Quick fill helper for admin credentials
  const handleQuickDemoFill = async () => {
    const admin = await getAdminCredentials();
    setEmailOrUsername(admin.email);
    setPassword(admin.password);
    setErrorMessage('');
  };

  // Direct Admin login only - only ducaysane@gmail.com with current password
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

      if (enteredEmail !== authorizedEmail) {
        setIsLoading(false);
        setErrorMessage(`Access Denied: Only ${admin.email} is authorized as system administrator.`);
        return;
      }

      if (password !== admin.password) {
        setIsLoading(false);
        setErrorMessage('Incorrect password. Please verify your administrator password.');
        return;
      }

      setIsLoading(false);
      onLoginSuccess({
        id: 'usr-admin-1',
        name: admin.name || 'Ahmed Ducaysane',
        email: admin.email,
        role: admin.role || 'Super Admin',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
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
    <div id="ducaysane-login-container" className="min-h-screen w-full bg-[#082142] flex flex-col lg:flex-row relative overflow-x-hidden font-sans">
      
      {/* Left Column: Deep Navy Brand Panel with Skyscraper Architecture */}
      <div className="w-full lg:w-[52%] xl:w-[50%] bg-[#082142] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative z-0 shrink-0">
        
        {/* Top Header Tagline */}
        <div className="z-10">
          <p className="text-xs sm:text-sm font-normal text-slate-200/90 tracking-normal">
            Strategic Commercial Real Estate & Asset Management
          </p>
        </div>

        {/* Headline & Skyscraper Visual */}
        <div className="z-10 mt-10 lg:mt-14 mb-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold text-white tracking-tight leading-[1.14]">
            Manage Your<br />
            Asset Portfolio
          </h1>
        </div>

        {/* Architectural Skyscraper Image */}
        <div className="relative mt-8 lg:mt-12 w-full max-w-lg mx-auto lg:mx-0 z-10">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#071d3a]">
            <img
              src={skyscraperImg}
              alt="Ducaysane Commercial Asset Tower"
              className="w-full h-72 sm:h-96 lg:h-[420px] object-cover object-bottom"
            />
            {/* Subtle atmospheric vignette gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#082142] via-transparent to-transparent opacity-60 pointer-events-none" />
          </div>
        </div>

        {/* Subtle background glow effect */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right Column: Crisp White Curved Authentication Panel */}
      <div className="w-full lg:w-[48%] xl:w-[50%] bg-white lg:rounded-l-[48px] xl:rounded-l-[56px] shadow-2xl flex flex-col justify-between min-h-screen relative z-10">
        
        {/* Top Right: Sign Up Action */}
        <div className="flex justify-end items-center px-8 sm:px-12 pt-8 sm:pt-10">
          <button
            type="button"
            onClick={() => setShowSignUpModal(true)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors cursor-pointer group"
          >
            <svg 
              className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-colors" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.8"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="10" r="3" />
              <path d="M6.5 18.5a6 6 0 0 1 11 0" />
            </svg>
            <span>Sign Up</span>
          </button>
        </div>

        {/* Main Sign In Form Area */}
        <div className="w-full max-w-md mx-auto px-6 sm:px-10 py-10 my-auto">
          
          {/* DS Ducaysane Brand Logo */}
          <div className="flex items-center justify-center gap-3.5 mb-10 sm:mb-12">
            {/* DS Stylized Monogram */}
            <svg 
              viewBox="0 0 88 56" 
              className="h-10 sm:h-11 w-auto" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* D Serif Letter */}
              <path
                d="M10 8 H32 C48 8 58 18 58 32 C58 46 48 56 32 56 H10 V8 Z"
                fill="#082142"
              />
              <path
                d="M20 16 H30 C41 16 48 23 48 32 C48 41 41 48 30 48 H20 V16 Z"
                fill="#ffffff"
              />
              {/* Classical Top and Bottom Serif Brackets for D */}
              <rect x="6" y="8" width="16" height="4" fill="#082142" />
              <rect x="6" y="52" width="16" height="4" fill="#082142" />

              {/* Gracefully Intertwined S Letter with Gradient */}
              <path
                d="M66 18 C62 11 53 10 46 12 C38 14 36 21 42 26 L51 31 C60 36 63 43 59 50 C54 58 42 60 32 56 L34 48 C41 52 50 52 53 47 C55 42 51 38 45 34 L38 30 C30 25 29 16 37 10 C46 3 58 5 66 11 L66 18 Z"
                fill="url(#ds_gradient)"
              />

              <defs>
                <linearGradient id="ds_gradient" x1="30" y1="5" x2="68" y2="55" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e40af" />
                  <stop offset="60%" stopColor="#082142" />
                  <stop offset="100%" stopColor="#05162e" />
                </linearGradient>
              </defs>
            </svg>

            {/* Wordmark */}
            <span className="font-['Playfair_Display',Georgia,serif] text-3xl sm:text-4xl font-bold tracking-tight text-[#082142]">
              Ducaysane
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-[34px] font-bold text-slate-900 tracking-tight text-left mb-6">
            Sign In
          </h2>

          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sign In Form - Only Admin */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="text"
                required
                value={emailOrUsername}
                onChange={(e) => {
                  setEmailOrUsername(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Admin Email (ducaysane@gmail.com)"
                className="w-full px-6 py-3.5 sm:py-4 bg-white border border-slate-200 rounded-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#082142] focus:ring-1 focus:ring-[#082142] transition-all"
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Password"
                className="w-full px-6 py-3.5 sm:py-4 pr-12 bg-white border border-slate-200 rounded-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#082142] focus:ring-1 focus:ring-[#082142] transition-all"
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

            {/* Forgot Password and Quick Test Autofill */}
            <div className="pt-0.5 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[#093566] hover:text-[#06203f] hover:underline font-medium cursor-pointer"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="text-slate-400 hover:text-blue-700 hover:underline text-[11px] cursor-pointer"
                title="Fill demo credentials for testing"
              >
                Auto-fill test demo
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 sm:py-4 px-6 rounded-full bg-[#0b2d56] hover:bg-[#071f3c] text-white text-sm sm:text-base font-semibold tracking-wide shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in as Admin...</span>
                  </span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

        </div>

        {/* Bottom Footer: Copyright, Contact Us, and Language Picker */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 px-8 sm:px-12 py-6 sm:py-8 border-t border-slate-100 mt-auto">
          <p className="text-slate-500 text-center sm:text-left text-[11px] sm:text-xs">
            © 2023-2025 Ducaysane Asset Management Inc.
          </p>

          <div className="flex items-center gap-6 text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors cursor-pointer"
            >
              Contact Us
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{selectedLanguage}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showLanguageDropdown && (
                <div className="absolute bottom-full right-0 mb-2 w-32 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {['English', 'Somali (Af-Soomaali)', 'Arabic (العربية)'].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(lang.split(' ')[0]);
                        setShowLanguageDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>{lang}</span>
                      {selectedLanguage === lang.split(' ')[0] && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Reset Administrator Password</h3>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="my-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center space-y-1">
                <p className="font-bold">Password recovery link sent!</p>
                <p>Please check your official inbox at {forgotEmail} for authorization credentials.</p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your registered administrator email address to receive an instant secure password reset token.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#082142]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0b2d56] hover:bg-[#071f3c] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reset Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sign Up Modal */}
      {showSignUpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#082142]" />
                <h3 className="text-base font-bold text-slate-900">Administrator Access Policy</h3>
              </div>
              <button
                onClick={() => setShowSignUpModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <p>
                Self-registration for public users is disabled for Ducaysane Asset Management and Commercial Store Operations.
              </p>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-800">Only Administrator Role is Enabled:</p>
                <p className="text-slate-600">
                  As configured, only the primary Administrator has login credentials to access the portfolio and store dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4">
              <button
                onClick={() => setShowSignUpModal(false)}
                className="px-5 py-2 bg-[#0b2d56] text-white text-xs font-bold rounded-xl"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Us Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#082142]" />
                <h3 className="text-base font-bold text-slate-900">Ducaysane Asset Support</h3>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <p>For executive portal inquiries, asset portfolio verification, and technical assistance:</p>
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 font-mono text-[11px]">
                <p><strong className="text-slate-800">Direct Line:</strong> +252 61 555 0192</p>
                <p><strong className="text-slate-800">Admin Email:</strong> admin@ducaysane.com</p>
                <p><strong className="text-slate-800">Corporate HQ:</strong> Maka Al-Mukarama Ave, Mogadishu</p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4">
              <button
                onClick={() => setShowContactModal(false)}
                className="px-5 py-2 bg-[#0b2d56] text-white text-xs font-bold rounded-xl"
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
