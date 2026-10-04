import React, { useState } from 'react';
import { Building2, CheckCircle2, Lock, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { createFirstInstituteForAdmin, seedSampleCoachingData } from '../services/database';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const LoginAndOnboardingView: React.FC = () => {
  const { user, signInWithGoogle, logout } = useApp();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Institute Creation Form State (when user is logged in but has no institute profile yet)
  const [instName, setInstName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [loadSampleData, setLoadSampleData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (signingIn) return;
    setErrorMsg(null);
    setAuthNotice(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-blocked') {
        setAuthNotice(
          'ब्राउज़र ने लॉगिन पॉप-अप रोक दिया है। कृपया ऊपर पॉप-अप अनुमति दें या ऐप को नए टैब (Open in new tab) में खोलकर लॉगिन करें।'
        );
      } else {
        setErrorMsg('Google साइन-इन पूरा नहीं हो सका। कृपया दोबारा कोशिश करें या नए टैब में खोलें।');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthNotice(
      'सुरक्षा के लिए इस क्लाउड वातावरण में Google Sign-In सक्रिय है। कृपया नीचे "Sign in with Google" बटन दबाएं या Firebase Console से Email/Password provider सक्षम करें।'
    );
  };

  const handleForgotPassword = () => {
    setAuthNotice(
      'पासवर्ड रीसेट के लिए कृपया अपने पंजीकृत Google खाते का उपयोग करें या व्यवस्थापक से संपर्क करें।'
    );
  };

  const handleCreateInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instName.trim() || !ownerName.trim() || !phone.trim()) {
      setErrorMsg('कृपया कोचिंग का नाम, मालिक का नाम और फ़ोन नंबर भरें।');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { institute } = await createFirstInstituteForAdmin({
        name: instName,
        ownerName,
        phone,
        address,
        primaryColor,
        plan: 'PRO',
      });
      if (loadSampleData) {
        await seedSampleCoachingData(institute.id, ownerName.trim());
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Institute तैयार नहीं हो सका। कृपया दोबारा कोशिश करें।');
    } finally {
      setSubmitting(false);
    }
  };

  // State 2: Authenticated user needs to create/initialize their Coaching Institute tenant
  if (user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-8">
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">5tar Coaching Manager</span>
          </div>
          <div className="flex items-center gap-3">
            <PWAInstallButton />
            <button
              type="button"
              onClick={logout}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="max-w-xl w-full mx-auto my-8 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Set Up Your Coaching Institute</h1>
              <p className="text-xs text-slate-500">
                Welcome, {user.email} · Isolated Multi-Tenant Workspace Setup
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreateInstitute} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Coaching Institute Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Sankalp IIT & NEET Academy"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Director / Owner Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rajesh Verma"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institute Helpline Phone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g., +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Campus Address
              </label>
              <input
                type="text"
                placeholder="e.g., 2nd Floor, Vidya Plaza, Civil Lines, Prayagraj"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institute Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-14 rounded-lg border border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-600">{primaryColor}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loadSampleData}
                  onChange={(e) => setLoadSampleData(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span className="text-xs text-slate-700 leading-snug">
                  <strong className="font-semibold text-slate-900 block">Include Demo Sample Data</strong>
                  Pre-load sample batches, students, attendance &amp; receipts for instant testing
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 rounded-xl bg-slate-900 py-3 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? 'Initializing Institute Workspace...' : 'Create Coaching Institute & Launch Dashboard'}
            </button>
          </form>
        </main>

        <footer className="text-center text-xs text-slate-500 py-4">
          5tar Coaching Manager · Multi-Tenant Row-Level Security Enabled
        </footer>
      </div>
    );
  }

  // State 1: Unauthenticated Login Screen
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="w-full border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-lg font-bold tracking-tight text-slate-900">
          5tar Coaching Manager
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
          <a href="#security" className="hover:text-slate-900 transition-colors">Tenant Security</a>
          <a href="#roles" className="hover:text-slate-900 transition-colors">Role Access</a>
        </nav>
        <div className="flex items-center gap-3">
          <PWAInstallButton />
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            Login / Register Institute
          </button>
        </div>
      </header>

      {/* Main Split Content */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Value Proposition */}
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Designed for Indian Coaching Institutes · Mobile &amp; Desktop Ready
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            Manage Students, Batches, Fees, Attendance &amp; Results in One Secure Platform.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            5tar Coaching Manager gives every coaching institute its own isolated database, custom branding, printable A4/thermal fee receipts, student ID cards, and dedicated dashboards for Owners, Teachers, and Students.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2" id="features">
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">01. Strict Tenant Isolation</h3>
              <p className="text-xs text-slate-600 mt-1">
                Every student, batch, fee, and test record is locked to your <span className="font-mono">institute_id</span> with server-side security rules.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">02. Instant Receipts &amp; ID Cards</h3>
              <p className="text-xs text-slate-600 mt-1">
                Generate numbered receipts (<span className="font-mono">REC-2026-00001</span>), printable student ID cards, and report cards with your institute logo.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">03. Fast Mobile Attendance</h3>
              <p className="text-xs text-slate-600 mt-1">
                One-tap &quot;Mark All Present&quot; and individual Present/Absent/Late/Leave toggles built for Android phones.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">04. Installable App (PWA)</h3>
              <p className="text-xs text-slate-600 mt-1">
                Click the <strong>Download App</strong> button to install directly on your Android phone or computer home screen.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sign In to Portal</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin · Teacher · Student · Super Admin
                </p>
              </div>
              <Lock className="w-5 h-5 text-slate-400" />
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {errorMsg}
              </div>
            )}

            {authNotice && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {authNotice}
              </div>
            )}

            {/* Primary Google Auth Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[46px]"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Continue with Google Account</span>
              </button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-medium text-slate-400 uppercase">Or Email Login</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Standard Email & Password Form */}
            <form onSubmit={handleEmailFormSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="director@coaching.in"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer min-h-[42px]"
              >
                Login with Email
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <PWAInstallButton variant="full" />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
        © 2026 5tar Coaching Manager · Built for Indian Coaching Institutes
      </footer>
    </div>
  );
};
