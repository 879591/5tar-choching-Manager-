import React, { useState } from 'react';
import {
  Building2,
  Camera,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react';
import { signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import {
  createFirstInstituteForAdmin,
  generateCoachingCode,
  linkStudentToInstituteByCode,
  seedSampleCoachingData,
} from '../services/database';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { compressImageFileToDataUrl, identifierToAuthEmail } from '../utils/image';
import {
  loginUniversalWithPassword,
  sendUniversalOtp,
  verifyUniversalOtpAndCreateAccount,
} from '../services/otpAuth';

type AuthPortalTab = 'LOGIN' | 'REGISTER_COACHING' | 'REGISTER_STUDENT';

export const LoginAndOnboardingView: React.FC = () => {
  const { user, signInWithGoogle, setCustomSessionUser, logout } = useApp();

  const [portalTab, setPortalTab] = useState<AuthPortalTab>('LOGIN');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // --- Tab 1: Standard Login (Coaching Gmail or Student Mobile + Coaching Code) ---
  const [loginMode, setLoginMode] = useState<'ADMIN_EMAIL' | 'STUDENT_CODE'>('ADMIN_EMAIL');
  const [loginEmailOrPhone, setLoginEmailOrPhone] = useState('');
  const [loginCoachingCode, setLoginCoachingCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // --- Tab 2: New Coaching Registration with Personal Gmail OTP ---
  const [instName, setInstName] = useState('');
  const [instCustomCode, setInstCustomCode] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName || '');
  const [ownerEmail, setOwnerEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [adminPassword, setAdminPassword] = useState('');
  const [loadSampleData, setLoadSampleData] = useState(true);
  const [coachingOtpSent, setCoachingOtpSent] = useState(false);
  const [coachingOtpCode, setCoachingOtpCode] = useState('');
  const [coachingServerOtpPreview, setCoachingServerOtpPreview] = useState<string | null>(null);
  const [coachingWhatsappUrl, setCoachingWhatsappUrl] = useState<string | null>(null);

  // --- Tab 3: Student Registration with Coaching Code + OTP + Password + Gallery Photo ---
  const [stuCoachingCode, setStuCoachingCode] = useState('');
  const [stuPhoneOrAdm, setStuPhoneOrAdm] = useState('');
  const [stuEmailOptional, setStuEmailOptional] = useState('');
  const [stuPassword, setStuPassword] = useState('');
  const [stuPhotoDataUrl, setStuPhotoDataUrl] = useState<string>('');
  const [studentOtpSent, setStudentOtpSent] = useState(false);
  const [studentOtpCode, setStudentOtpCode] = useState('');
  const [studentServerOtpPreview, setStudentServerOtpPreview] = useState<string | null>(null);
  const [studentWhatsappUrl, setStudentWhatsappUrl] = useState<string | null>(null);

  // Onboarding Mode (if user logged in via Google and needs to either Setup Coaching or Join as Student)
  const [onboardingMode, setOnboardingMode] = useState<'CREATE_COACHING' | 'JOIN_AS_STUDENT'>('CREATE_COACHING');
  const [submitting, setSubmitting] = useState(false);

  const clearMessages = () => {
    setErrorMsg(null);
    setAuthNotice(null);
  };

  // Helper: Send 6-Digit OTP (Works on Express Backend + Downloaded PWA + Static Cloud Deployments)
  const requestOtpFromServer = async (params: {
    identifier: string;
    email?: string;
    phone?: string;
    purpose: string;
  }): Promise<{ otp: string; message: string; whatsappOtpUrl: string | null }> => {
    return sendUniversalOtp(params);
  };

  // Helper: Verify OTP & Create/Update Account then Activate Session
  const verifyOtpAndSignIn = async (params: {
    identifier: string;
    otp: string;
    authEmail: string;
    password: string;
    displayName: string;
    expectedOtp?: string | null;
  }) => {
    const sessionUser = await verifyUniversalOtpAndCreateAccount(params);
    setCustomSessionUser(sessionUser);
  };

  // Handle Gallery Photo Selection for Student
  const handleStudentGalleryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 360, 360, 0.8);
      setStuPhotoDataUrl(compressed);
    } catch {
      setErrorMsg('फोटो लोड नहीं हो सकी। कृपया दूसरी फोटो चुनें।');
    }
  };

  // 1. Direct Password Login Handler
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!loginEmailOrPhone.trim() || !loginPassword) {
      setErrorMsg('कृपया अपनी आईडी/मोबाइल और पासवर्ड दर्ज करें।');
      return;
    }

    if (loginMode === 'STUDENT_CODE' && !loginCoachingCode.trim()) {
      setErrorMsg('कृपया अपना Coaching Code दर्ज करें।');
      return;
    }

    setSigningIn(true);
    try {
      const sessionUser = await loginUniversalWithPassword({
        identifier: loginEmailOrPhone.trim(),
        coachingCode: loginMode === 'STUDENT_CODE' ? loginCoachingCode.trim() : undefined,
        password: loginPassword,
      });
      setCustomSessionUser(sessionUser);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'लॉगिन नहीं हो सका। यदि आप नए हैं तो पहले OTP द्वारा अपना पासवर्ड बनाएं।'
      );
    } finally {
      setSigningIn(false);
    }
  };

  // 2A. Send OTP to Coaching Owner Personal Gmail
  const handleSendCoachingOtp = async () => {
    clearMessages();
    if (!instName.trim() || !ownerName.trim() || !ownerEmail.trim() || !phone.trim() || !adminPassword) {
      setErrorMsg('कृपया कोचिंग का नाम, अपना नाम, पर्सनल Gmail, मोबाइल नंबर और नया पासवर्ड भरें।');
      return;
    }
    if (adminPassword.length < 6) {
      setErrorMsg('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।');
      return;
    }
    setSubmitting(true);
    try {
      const generatedCode = instCustomCode.trim() || generateCoachingCode(instName);
      setInstCustomCode(generatedCode);
      const { otp, message, whatsappOtpUrl } = await requestOtpFromServer({
        identifier: ownerEmail.trim(),
        email: ownerEmail.trim(),
        phone: phone.trim(),
        purpose: 'Coaching Registration',
      });
      setCoachingOtpSent(true);
      setCoachingServerOtpPreview(otp);
      setCoachingWhatsappUrl(whatsappOtpUrl);
      setAuthNotice(message);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'OTP भेजने में त्रुटि हुई।');
    } finally {
      setSubmitting(false);
    }
  };

  // 2B. Verify Coaching OTP & Create Institute + Profile
  const handleVerifyCoachingOtpAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!coachingOtpCode.trim()) {
      setErrorMsg('कृपया 6-अंकीय OTP दर्ज करें।');
      return;
    }
    setSubmitting(true);
    try {
      await verifyOtpAndSignIn({
        identifier: ownerEmail.trim(),
        otp: coachingOtpCode.trim(),
        authEmail: ownerEmail.trim(),
        password: adminPassword,
        displayName: ownerName.trim(),
        expectedOtp: coachingServerOtpPreview,
      });

      const { institute } = await createFirstInstituteForAdmin({
        name: instName,
        ownerName,
        phone,
        address,
        primaryColor,
        instituteCode: instCustomCode,
        plan: 'PRO',
      });

      if (loadSampleData) {
        await seedSampleCoachingData(institute.id, ownerName.trim());
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'रजिस्ट्रेशन पूरा नहीं हो सका।');
    } finally {
      setSubmitting(false);
    }
  };

  // 3A. Send OTP to Student Mobile / Email
  const handleSendStudentOtp = async () => {
    clearMessages();
    if (!stuCoachingCode.trim() || !stuPhoneOrAdm.trim() || !stuPassword) {
      setErrorMsg('कृपया Coaching Code, अपना मोबाइल/एडमिशन नंबर और नया पासवर्ड भरें।');
      return;
    }
    if (stuPassword.length < 6) {
      setErrorMsg('छात्र पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।');
      return;
    }
    setSubmitting(true);
    try {
      const { otp, message, whatsappOtpUrl } = await requestOtpFromServer({
        identifier: stuPhoneOrAdm.trim(),
        email: stuEmailOptional.trim() || (stuPhoneOrAdm.includes('@') ? stuPhoneOrAdm.trim() : undefined),
        phone: stuPhoneOrAdm.trim(),
        purpose: 'Student Registration',
      });
      setStudentOtpSent(true);
      setStudentServerOtpPreview(otp);
      setStudentWhatsappUrl(whatsappOtpUrl);
      setAuthNotice(message);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'OTP भेजने में त्रुटि हुई।');
    } finally {
      setSubmitting(false);
    }
  };

  // 3B. Verify Student OTP, Create Password & Link to Coaching Code + Gallery Photo
  const handleVerifyStudentOtpAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!studentOtpCode.trim()) {
      setErrorMsg('कृपया 6-अंकीय OTP दर्ज करें।');
      return;
    }
    setSubmitting(true);
    try {
      const studentAuthEmail = identifierToAuthEmail(stuPhoneOrAdm, stuCoachingCode);
      await verifyOtpAndSignIn({
        identifier: stuPhoneOrAdm.trim(),
        otp: studentOtpCode.trim(),
        authEmail: studentAuthEmail,
        password: stuPassword,
        displayName: stuPhoneOrAdm.trim(),
        expectedOtp: studentServerOtpPreview,
      });

      await linkStudentToInstituteByCode({
        coachingCode: stuCoachingCode,
        studentPhoneOrAdmission: stuPhoneOrAdm,
        photoDataUrl: stuPhotoDataUrl || undefined,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'छात्र प्रोफ़ाइल लिंक नहीं हो सकी।');
    } finally {
      setSubmitting(false);
    }
  };

  // Google Sign-In fallback handler
  const handleGoogleLogin = async () => {
    if (signingIn) return;
    clearMessages();
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setAuthNotice(
        'यदि Google पॉप-अप न खुले, तो आप ऊपर दिए गए "New Coaching OTP" या "Student OTP" टैब से सीधे OTP और पासवर्ड से लॉगिन/रजिस्टर कर सकते हैं।'
      );
    } finally {
      setSigningIn(false);
    }
  };

  // Authenticated User Without Profile Yet (Complete Coaching Setup or Link Student via Coaching Code)
  const handleAuthenticatedCreateInstitute = async (e: React.FormEvent) => {
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
        instituteCode: instCustomCode || generateCoachingCode(instName),
        plan: 'PRO',
      });
      if (loadSampleData) {
        await seedSampleCoachingData(institute.id, ownerName.trim());
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Institute तैयार नहीं हो सका।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthenticatedStudentJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuCoachingCode.trim() || !stuPhoneOrAdm.trim()) {
      setErrorMsg('कृपया Coaching Code और अपना मोबाइल या एडमिशन नंबर भरें।');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await linkStudentToInstituteByCode({
        coachingCode: stuCoachingCode,
        studentPhoneOrAdmission: stuPhoneOrAdm,
        photoDataUrl: stuPhotoDataUrl || undefined,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Student लिंक नहीं हो सका।');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // STATE 2: User is Authenticated in Firebase but has no Profile yet
  // ============================================================================
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

        <main className="max-w-xl w-full mx-auto my-6 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {/* Role Switcher inside Onboarding */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setOnboardingMode('CREATE_COACHING');
                setErrorMsg(null);
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                onboardingMode === 'CREATE_COACHING'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Coaching Owner Setup
            </button>
            <button
              type="button"
              onClick={() => {
                setOnboardingMode('JOIN_AS_STUDENT');
                setErrorMsg(null);
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                onboardingMode === 'JOIN_AS_STUDENT'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Join Coaching as Student
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          {onboardingMode === 'CREATE_COACHING' ? (
            <form onSubmit={handleAuthenticatedCreateInstitute} className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Register Your Coaching Institute</h1>
                  <p className="text-xs text-slate-500">
                    Each coaching gets a unique Coaching Code so your students can join inside your institute
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coaching Institute Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Sankalp IIT & NEET Academy"
                    value={instName}
                    onChange={(e) => {
                      setInstName(e.target.value);
                      if (!instCustomCode) {
                        setInstCustomCode(generateCoachingCode(e.target.value));
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coaching Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SANK-2026"
                    value={instCustomCode}
                    onChange={(e) => setInstCustomCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono font-bold text-slate-900 bg-amber-50/60"
                  />
                </div>
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
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Institute Helpline Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g., 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Campus Address
                </label>
                <input
                  type="text"
                  placeholder="e.g., 2nd Floor, Vidya Plaza, Civil Lines"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
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
                    Pre-load sample batches, students, attendance &amp; receipts
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 rounded-xl bg-slate-900 py-3 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Creating Coaching Workspace...' : 'Create Coaching Institute & Launch Dashboard'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuthenticatedStudentJoin} className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Join Your Coaching Institute</h1>
                  <p className="text-xs text-slate-500">
                    Enter your Coaching Code &amp; upload your profile photo from gallery
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Coaching Code (कोचिंग कोड) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., SANK-1234"
                  value={stuCoachingCode}
                  onChange={(e) => setStuCoachingCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 bg-amber-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Mobile Number or Admission No. *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 9811122233 or ADM-2026-001"
                  value={stuPhoneOrAdm}
                  onChange={(e) => setStuPhoneOrAdm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Upload Your Student Photo from Gallery (गैलरी से अपनी फोटो लगाएं)
                </label>
                <div className="flex items-center gap-4">
                  {stuPhotoDataUrl ? (
                    <img
                      src={stuPhotoDataUrl}
                      alt="Student Preview"
                      className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>{stuPhotoDataUrl ? 'Change Gallery Photo' : 'Choose Photo from Mobile Gallery'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleStudentGalleryPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 rounded-xl bg-slate-900 py-3 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Linking Student Profile...' : 'Join Coaching & Open Student Portal'}
              </button>
            </form>
          )}
        </main>

        <footer className="text-center text-xs text-slate-500 py-4">
          5tar Coaching Manager · Multi-Tenant Row-Level Security Enabled
        </footer>
      </div>
    );
  }

  // ============================================================================
  // STATE 1: Unauthenticated Portal — OTP Registration & Password Login
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="w-full border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
            <Star className="w-4 h-4 fill-amber-400" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
            5tar Coaching Manager
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => {
              clearMessages();
              setPortalTab('REGISTER_COACHING');
            }}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Register Coaching (OTP)
          </button>
        </div>
      </header>

      {/* Main Split Content */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Value Proposition & How OTP + Coaching Code Works */}
        <div className="lg:col-span-6 space-y-6 lg:pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Designed for Indian Coaching Institutes · OTP &amp; Coaching Code System
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            हर कोचिंग का अपना अलग कोड, छात्रों का OTP लॉगिन और गैलरी फोटो प्रोफाइल।
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            <strong>5tar Coaching Manager</strong> में हर कोचिंग संस्थान का अपना अलग अकाउंट और{' '}
            <span className="font-mono font-semibold text-slate-900">Coaching Code</span> होता है। एक कोचिंग के सभी विद्यार्थी स्कूल की तरह उसी कोचिंग के अंदर सुरक्षित रहते हैं।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                1. कोचिंग रजिस्ट्रेशन (Gmail OTP)
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                कोचिंग मालिक अपने पर्सनल Gmail पर OTP मंगाकर और अपना पासवर्ड बनाकर नई कोचिंग रजिस्टर कर सकते हैं।
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                2. यूनिक कोचिंग कोड (School System)
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                हर कोचिंग को एक <span className="font-mono">Coaching Code</span> मिलता है। उसके सारे छात्र उसी कोचिंग के अंदर जुड़ते हैं।
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                3. छात्र OTP व खुद का पासवर्ड
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                छात्र अपने मोबाइल/एडमिशन नंबर और Coaching Code पर OTP लेकर अपना पासवर्ड खुद बना सकते हैं।
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                4. गैलरी से अपनी फोटो लगाएं
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                छात्र अपने मोबाइल की गैलरी से अपनी फोटो लगा सकते हैं जो उनके प्रोफाइल और ID Card पर दिखेगी।
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Mode OTP & Password Authentication Card */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs">
            {/* 3 Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setPortalTab('LOGIN');
                }}
                className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  portalTab === 'LOGIN'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. लॉगिन (Login)
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setPortalTab('REGISTER_COACHING');
                }}
                className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  portalTab === 'REGISTER_COACHING'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. नई कोचिंग (OTP)
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setPortalTab('REGISTER_STUDENT');
                }}
                className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  portalTab === 'REGISTER_STUDENT'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. छात्र जुड़ें (OTP)
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {errorMsg}
              </div>
            )}

            {authNotice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
                {authNotice}
              </div>
            )}

            {/* ==============================================================
                TAB 1: DIRECT LOGIN (COACHING ADMIN OR STUDENT)
               ============================================================== */}
            {portalTab === 'LOGIN' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      अपने पासवर्ड से लॉगिन करें (Portal Login)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Coaching Owner (Gmail) या Student (Coaching Code + Mobile)
                    </p>
                  </div>
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>

                {/* Sub-toggle: Coaching Owner vs Student Login */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setLoginMode('ADMIN_EMAIL');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 ${
                      loginMode === 'ADMIN_EMAIL'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Coaching Admin / Teacher</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setLoginMode('STUDENT_CODE');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 ${
                      loginMode === 'STUDENT_CODE'
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Student (विद्यार्थी लॉगिन)</span>
                  </button>
                </div>

                <form onSubmit={handlePasswordLoginSubmit} className="space-y-3.5">
                  {loginMode === 'STUDENT_CODE' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Coaching Code (कोचिंग कोड) *
                      </label>
                      <input
                        type="text"
                        required
                        value={loginCoachingCode}
                        onChange={(e) => setLoginCoachingCode(e.target.value.toUpperCase())}
                        placeholder="e.g., SANK-1234"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 bg-amber-50/40 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {loginMode === 'STUDENT_CODE'
                        ? 'Student Mobile Number or Admission No. *'
                        : 'Personal Gmail / Email Address *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={loginEmailOrPhone}
                      onChange={(e) => setLoginEmailOrPhone(e.target.value)}
                      placeholder={
                        loginMode === 'STUDENT_CODE'
                          ? 'e.g., 9811122233 or ADM-2026-001'
                          : 'director@gmail.com'
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password (आपका पासवर्ड) *
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={signingIn}
                    className="w-full rounded-xl bg-slate-900 py-3 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer min-h-[44px]"
                  >
                    {signingIn ? 'Signing In...' : 'Login to Portal'}
                  </button>
                </form>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setPortalTab('REGISTER_COACHING');
                    }}
                    className="font-semibold text-slate-900 underline cursor-pointer"
                  >
                    नई कोचिंग रजिस्टर करें (OTP द्वारा)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setPortalTab('REGISTER_STUDENT');
                    }}
                    className="font-semibold text-amber-800 underline cursor-pointer"
                  >
                    नए छात्र अपना पासवर्ड बनाएं (OTP)
                  </button>
                </div>

                <div className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-medium text-slate-400 uppercase">Or</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>One-Click Google Sign-In</span>
                </button>
              </div>
            )}

            {/* ==============================================================
                TAB 2: NEW COACHING REGISTRATION WITH PERSONAL GMAIL OTP
               ============================================================== */}
            {portalTab === 'REGISTER_COACHING' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      नई कोचिंग रजिस्टर करें (Coaching OTP Registration)
                    </h2>
                    <p className="text-xs text-slate-500">
                      कोचिंग का नाम भरें और अपने पर्सनल Gmail पर OTP प्राप्त करके पासवर्ड बनाएं
                    </p>
                  </div>
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>

                <form onSubmit={handleVerifyCoachingOtpAndCreate} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Coaching Institute Name (कोचिंग का नाम) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Lakshya Classes"
                        value={instName}
                        onChange={(e) => {
                          setInstName(e.target.value);
                          setInstCustomCode(generateCoachingCode(e.target.value));
                        }}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Coaching Code *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="LAKS-1024"
                        value={instCustomCode}
                        onChange={(e) => setInstCustomCode(e.target.value.toUpperCase())}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900 bg-amber-50/70"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner / Director Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="आपका पूरा नाम"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Personal Gmail (OTP के लिए) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="yourname@gmail.com"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Create Password (कम से कम 6 अक्षर) *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="नया पासवर्ड बनाएं"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Coaching Address (पता)
                    </label>
                    <input
                      type="text"
                      placeholder="शहर / शाखा का पता"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  {!coachingOtpSent ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSendCoachingOtp}
                      className="w-full rounded-xl bg-amber-500 py-3 px-4 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span>
                        {submitting ? 'Sending OTP...' : 'Send 6-Digit OTP to Personal Gmail'}
                      </span>
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-amber-700" />
                          <span>Enter 6-Digit Gmail / Mobile OTP</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {coachingWhatsappUrl && (
                            <a
                              href={coachingWhatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-md hover:bg-emerald-700"
                            >
                              Get OTP on WhatsApp
                            </a>
                          )}
                          {coachingServerOtpPreview && (
                            <span className="text-xs font-mono font-bold bg-slate-900 text-amber-400 px-2.5 py-1 rounded-md">
                              OTP: {coachingServerOtpPreview}
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={coachingOtpCode}
                        onChange={(e) => setCoachingOtpCode(e.target.value)}
                        placeholder="6-अंकीय OTP यहाँ डालें"
                        className="w-full rounded-xl border border-amber-400 bg-white px-3.5 py-2.5 text-center text-base font-mono font-bold tracking-widest text-slate-900"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSendCoachingOtp}
                          className="px-3 py-2.5 rounded-xl border border-amber-400 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                        >
                          Resend OTP
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 rounded-xl bg-slate-900 py-2.5 px-4 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                          {submitting
                            ? 'Verifying & Creating Coaching...'
                            : 'Verify OTP & Launch Coaching Dashboard'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* ==============================================================
                TAB 3: STUDENT REGISTRATION (COACHING CODE + OTP + PASSWORD + GALLERY PHOTO)
               ============================================================== */}
            {portalTab === 'REGISTER_STUDENT' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      विद्यार्थी OTP रजिस्ट्रेशन (Student Profile Setup)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Coaching Code डालें, OTP वेरीफाई करें, पासवर्ड बनाएं और गैलरी से अपनी फोटो लगाएं
                    </p>
                  </div>
                  <GraduationCap className="w-5 h-5 text-amber-600" />
                </div>

                <form onSubmit={handleVerifyStudentOtpAndJoin} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Coaching Code (कोचिंग कोड) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., SANK-1234"
                        value={stuCoachingCode}
                        onChange={(e) => setStuCoachingCode(e.target.value.toUpperCase())}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900 bg-amber-50/60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Student Mobile / Admission No. *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="9811122233 or ADM-2026-001"
                        value={stuPhoneOrAdm}
                        onChange={(e) => setStuPhoneOrAdm(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Student Gmail (OTP पाने के लिए - वैकल्पिक)
                      </label>
                      <input
                        type="email"
                        placeholder="student@gmail.com"
                        value={stuEmailOptional}
                        onChange={(e) => setStuEmailOptional(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Create Your Password (अपना पासवर्ड बनाएं) *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="कम से कम 6 अक्षरों का पासवर्ड"
                        value={stuPassword}
                        onChange={(e) => setStuPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Mobile Gallery Photo Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Profile Photo from Mobile Gallery (अपनी गैलरी से फोटो चुनें)
                    </label>
                    <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      {stuPhotoDataUrl ? (
                        <img
                          src={stuPhotoDataUrl}
                          alt="Student Gallery Preview"
                          className="w-14 h-14 rounded-xl object-cover border-2 border-amber-500 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-white border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                          <Camera className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{stuPhotoDataUrl ? 'दूसरी फोटो चुनें' : 'गैलरी से फोटो अपलोड करें'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleStudentGalleryPhoto}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[11px] text-slate-500 mt-1">
                          यह फोटो आपके Student Portal और कोचिंग ID Card पर लगेगी।
                        </p>
                      </div>
                    </div>
                  </div>

                  {!studentOtpSent ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSendStudentOtp}
                      className="w-full rounded-xl bg-amber-500 py-3 px-4 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>{submitting ? 'Sending OTP...' : 'Send Student Verification OTP'}</span>
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-amber-700" />
                          <span>Enter Student OTP</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {studentWhatsappUrl && (
                            <a
                              href={studentWhatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-md hover:bg-emerald-700"
                            >
                              Get OTP on WhatsApp
                            </a>
                          )}
                          {studentServerOtpPreview && (
                            <span className="text-xs font-mono font-bold bg-slate-900 text-amber-400 px-2.5 py-1 rounded-md">
                              OTP: {studentServerOtpPreview}
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={studentOtpCode}
                        onChange={(e) => setStudentOtpCode(e.target.value)}
                        placeholder="6-अंकीय OTP दर्ज करें"
                        className="w-full rounded-xl border border-amber-400 bg-white px-3.5 py-2.5 text-center text-base font-mono font-bold tracking-widest text-slate-900"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSendStudentOtp}
                          className="px-3 py-2.5 rounded-xl border border-amber-400 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                        >
                          Resend OTP
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 rounded-xl bg-slate-900 py-2.5 px-4 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                          {submitting
                            ? 'Verifying & Linking...'
                            : 'Verify OTP & Open Student Profile'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100">
              <PWAInstallButton variant="full" />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
        © 2026 5tar Coaching Manager · Multi-Tenant Coaching Code &amp; OTP Verification System
      </footer>
    </div>
  );
};
