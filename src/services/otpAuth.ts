import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CustomAuthSessionUser, db } from '../lib/firebase';
import { identifierToAuthEmail } from '../utils/image';

interface OtpAuthRecord {
  identifier: string;
  otp: string;
  expiresAt: number;
  purpose: string;
  uid?: string;
  email?: string;
  passwordHash?: string;
  displayName?: string;
  updatedAt: string;
}

function normalizeKey(val: string): string {
  return val.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_').slice(0, 100);
}

function simpleHashPassword(password: string): string {
  let h1 = 0xdeadbeef ^ password.length;
  let h2 = 0x41c6ce57 ^ password.length;
  for (let i = 0, ch; i < password.length; i++) {
    ch = password.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `h_${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}`;
}

function makeDeterministicUid(cleanEmail: string): string {
  const safe = cleanEmail.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hash = simpleHashPassword(cleanEmail).replace(/[^a-z0-9]/g, '');
  return `usr_${safe.slice(0, 14)}_${hash}`.slice(0, 64);
}

function extractTenDigitPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return null;
}

async function safeParseJsonResponse(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<') || text.trim().startsWith('The page')) {
      return null;
    }
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function sendUniversalOtp(params: {
  identifier: string;
  email?: string;
  phone?: string;
  purpose: string;
}): Promise<{ otp: string; message: string; whatsappOtpUrl: string | null }> {
  const primaryIdent = (params.identifier || params.email || params.phone || '').trim();
  if (!primaryIdent) {
    throw new Error('कृपया ईमेल या मोबाइल नंबर दर्ज करें।');
  }

  const targetPhone = (params.phone || (!primaryIdent.includes('@') ? primaryIdent : '')).trim();
  const tenDigitPhone = targetPhone ? extractTenDigitPhone(targetPhone) : null;

  // 1. Try Server API first (if running on Express backend with Nodemailer / Fast2SMS)
  let serverOtp: string | null = null;
  let serverMessage: string | null = null;
  let serverWhatsappUrl: string | null = null;

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await safeParseJsonResponse(res);
    if (res.ok && data && typeof data.otp === 'string') {
      serverOtp = data.otp;
      serverMessage = typeof data.message === 'string' ? data.message : null;
      serverWhatsappUrl = typeof data.whatsappOtpUrl === 'string' ? data.whatsappOtpUrl : null;
    }
  } catch {
    // Server route unavailable (e.g., Vercel static deployment or installed PWA standalone) — use Firestore fallback
  }

  const otp = serverOtp || String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const nowIso = new Date().toISOString();

  // 2. Always persist OTP session to Firestore `auth_otps` so verification works across any device/deployment
  const keysToSave = new Set<string>();
  keysToSave.add(normalizeKey(primaryIdent));
  if (params.email?.trim()) keysToSave.add(normalizeKey(params.email));
  if (params.phone?.trim()) keysToSave.add(normalizeKey(params.phone));

  for (const key of keysToSave) {
    try {
      const ref = doc(db, 'auth_otps', key);
      const existingSnap = await getDoc(ref);
      const existingData = existingSnap.exists() ? (existingSnap.data() as Partial<OtpAuthRecord>) : {};
      const record: OtpAuthRecord = {
        identifier: primaryIdent.slice(0, 120),
        otp,
        expiresAt,
        purpose: (params.purpose || 'AUTH').slice(0, 60),
        uid: existingData.uid || '',
        email: existingData.email || '',
        passwordHash: existingData.passwordHash || '',
        displayName: existingData.displayName || '',
        updatedAt: nowIso,
      };
      await setDoc(ref, record);
    } catch {
      // non-fatal if server already stored it
    }
  }

  const whatsappOtpUrl =
    serverWhatsappUrl ||
    (tenDigitPhone
      ? `https://wa.me/91${tenDigitPhone}?text=${encodeURIComponent(
          `*5tar Coaching Manager*\nआपका वेरिफिकेशन OTP है: *${otp}*\nयह 10 मिनट के लिए मान्य है।`
        )}`
      : null);

  const message =
    serverMessage ||
    `आपका 6-अंकीय वेरिफिकेशन OTP (${otp}) जनरेट हो गया है। आप इसे सीधे नीचे दर्ज कर सकते हैं या WhatsApp बटन से अपने फोन पर प्राप्त कर सकते हैं।`;

  return {
    otp,
    message,
    whatsappOtpUrl,
  };
}

export async function verifyUniversalOtpAndCreateAccount(params: {
  identifier: string;
  otp: string;
  authEmail: string;
  password: string;
  displayName: string;
  expectedOtp?: string | null;
}): Promise<CustomAuthSessionUser> {
  if (!params.identifier || !params.otp || !params.authEmail || !params.password) {
    throw new Error('सभी आवश्यक फ़ील्ड (OTP, Email/Mobile, Password) भरें।');
  }
  if (params.password.length < 6) {
    throw new Error('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।');
  }

  const cleanEmail = params.authEmail.trim().toLowerCase();
  const cleanOtp = params.otp.trim();
  const key = normalizeKey(params.identifier);
  const emailKey = normalizeKey(cleanEmail);

  // 1. Try Server API first if available
  try {
    const res = await fetch('/api/auth/verify-otp-and-create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await safeParseJsonResponse(res);
    if (res.ok && data && typeof data.uid === 'string') {
      const uid = data.uid;
      // Also persist credentials in Firestore so login works from installed PWA / Vercel
      const nowIso = new Date().toISOString();
      const pwHash = simpleHashPassword(params.password);
      const record: OtpAuthRecord = {
        identifier: params.identifier.trim().slice(0, 120),
        otp: cleanOtp,
        expiresAt: Date.now(),
        purpose: 'VERIFIED',
        uid,
        email: cleanEmail.slice(0, 120),
        passwordHash: pwHash,
        displayName: (params.displayName || 'User').trim().slice(0, 100),
        updatedAt: nowIso,
      };
      try {
        await setDoc(doc(db, 'auth_otps', emailKey), record);
        await setDoc(doc(db, 'auth_otps', key), record);
      } catch {
        // ignore
      }
      return {
        uid,
        email: cleanEmail,
        displayName: params.displayName.trim() || 'User',
        emailVerified: true,
      };
    }
  } catch {
    // Fallback to Firestore verification below
  }

  // 2. Verify via Firestore `auth_otps` (Works on Vercel static & downloaded PWA app)
  const snapByKey = await getDoc(doc(db, 'auth_otps', key));
  const snapByEmail = !snapByKey.exists() ? await getDoc(doc(db, 'auth_otps', emailKey)) : snapByKey;

  let isOtpValid = false;
  if (snapByKey.exists()) {
    const d = snapByKey.data() as OtpAuthRecord;
    if (d.otp === cleanOtp && d.expiresAt >= Date.now() - 5 * 60 * 1000) {
      isOtpValid = true;
    }
  }
  if (!isOtpValid && snapByEmail.exists()) {
    const d = snapByEmail.data() as OtpAuthRecord;
    if (d.otp === cleanOtp && d.expiresAt >= Date.now() - 5 * 60 * 1000) {
      isOtpValid = true;
    }
  }
  if (!isOtpValid && params.expectedOtp && params.expectedOtp.trim() === cleanOtp) {
    isOtpValid = true;
  }

  if (!isOtpValid) {
    throw new Error('अमान्य या समाप्त हो चुका OTP। कृपया सही 6-अंकीय OTP दर्ज करें।');
  }

  const uid = makeDeterministicUid(cleanEmail);
  const pwHash = simpleHashPassword(params.password);
  const nowIso = new Date().toISOString();

  const verifiedRecord: OtpAuthRecord = {
    identifier: params.identifier.trim().slice(0, 120),
    otp: cleanOtp,
    expiresAt: Date.now(),
    purpose: 'VERIFIED',
    uid,
    email: cleanEmail.slice(0, 120),
    passwordHash: pwHash,
    displayName: (params.displayName || 'User').trim().slice(0, 100),
    updatedAt: nowIso,
  };

  await setDoc(doc(db, 'auth_otps', emailKey), verifiedRecord);
  if (key !== emailKey) {
    await setDoc(doc(db, 'auth_otps', key), verifiedRecord);
  }

  return {
    uid,
    email: cleanEmail,
    displayName: params.displayName.trim() || 'User',
    emailVerified: true,
  };
}

export async function loginUniversalWithPassword(params: {
  identifier: string;
  coachingCode?: string;
  password: string;
}): Promise<CustomAuthSessionUser> {
  const cleanIdent = params.identifier.trim();
  const targetEmail = params.coachingCode
    ? identifierToAuthEmail(cleanIdent, params.coachingCode)
    : cleanIdent.includes('@')
    ? cleanIdent.toLowerCase()
    : identifierToAuthEmail(cleanIdent);

  // 1. Try Server API first if available
  try {
    const res = await fetch('/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authEmail: targetEmail,
        identifier: cleanIdent,
        password: params.password,
      }),
    });
    const data = await safeParseJsonResponse(res);
    if (res.ok && data && typeof data.uid === 'string') {
      return {
        uid: data.uid,
        email: (data.email as string) || targetEmail,
        displayName: (data.displayName as string) || cleanIdent,
        emailVerified: true,
      };
    }
  } catch {
    // Fallback to Firestore below
  }

  // 2. Check Firestore `auth_otps` account store (Works in downloaded PWA / Vercel)
  const emailKey = normalizeKey(targetEmail);
  const identKey = normalizeKey(cleanIdent);
  const pwHash = simpleHashPassword(params.password);

  const snapEmail = await getDoc(doc(db, 'auth_otps', emailKey));
  if (snapEmail.exists()) {
    const d = snapEmail.data() as OtpAuthRecord;
    if (d.passwordHash && d.passwordHash === pwHash && d.uid) {
      return {
        uid: d.uid,
        email: d.email || targetEmail,
        displayName: d.displayName || cleanIdent,
        emailVerified: true,
      };
    }
  }

  const snapIdent = await getDoc(doc(db, 'auth_otps', identKey));
  if (snapIdent.exists()) {
    const d = snapIdent.data() as OtpAuthRecord;
    if (d.passwordHash && d.passwordHash === pwHash && d.uid) {
      return {
        uid: d.uid,
        email: d.email || targetEmail,
        displayName: d.displayName || cleanIdent,
        emailVerified: true,
      };
    }
  }

  throw new Error(
    'ईमेल/मोबाइल या पासवर्ड गलत है। यदि आप नए हैं तो पहले "2. नई कोचिंग (OTP)" या "3. छात्र जुड़ें (OTP)" टैब से रजिस्टर करें।'
  );
}
