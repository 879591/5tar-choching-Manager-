import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

interface OtpSession {
  otp: string;
  identifier: string;
  purpose: string;
  expiresAt: number;
}

interface StoredAccount {
  uid: string;
  email: string;
  identifier: string;
  passwordHash: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: string;
}

const otpStore = new Map<string, OtpSession>();
const ACCOUNTS_FILE = path.join(process.cwd(), '.otp-accounts.json');

function loadAccounts(): Record<string, StoredAccount> {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      return JSON.parse(raw) as Record<string, StoredAccount>;
    }
  } catch (err) {
    console.warn('Could not read accounts file:', err);
  }
  return {};
}

function saveAccounts(accounts: Record<string, StoredAccount>) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not write accounts file:', err);
  }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`5tar_salt_${password}`).digest('hex');
}

function makeDeterministicUid(cleanEmail: string): string {
  const hash = crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 20);
  return `usr_${hash}`;
}

function normalizeKey(val: string): string {
  return val.trim().toLowerCase();
}

function extractTenDigitPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return null;
}

async function sendRealEmailOtp(
  toEmail: string,
  otp: string,
  purpose: string
): Promise<{ sent: boolean; channel: string; detail?: string }> {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpFrom = process.env.SMTP_FROM || `"5tar Coaching Manager" <${smtpUser}>`;

  if (!smtpUser || !smtpPass) {
    return {
      sent: false,
      channel: 'EMAIL_UNCONFIGURED',
      detail: 'SMTP_USER / SMTP_PASS not set in environment secrets',
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const subject = `${otp} is your 5tar Coaching Manager Verification OTP`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden;">
      <div style="background: #0f172a; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 18px;">5tar Coaching Manager</h2>
        <p style="margin: 4px 0 0; font-size: 12px; color: #fbbf24;">Multi-Tenant Coaching Verification</p>
      </div>
      <div style="padding: 24px; color: #1e293b;">
        <p style="margin: 0 0 12px; font-size: 14px;">नमस्ते,</p>
        <p style="margin: 0 0 16px; font-size: 14px;">आपका <strong>5tar Coaching Manager</strong> (${purpose}) सत्यापन ओटीपी (OTP) नीचे दिया गया है:</p>
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">
          ${otp}
        </div>
        <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">यह OTP 10 मिनट के लिए मान्य है। कृपया इसे किसी अनजान व्यक्ति के साथ साझा न करें।</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: smtpFrom,
    to: toEmail,
    subject,
    text: `Your 5tar Coaching Manager OTP is ${otp}. Valid for 10 minutes.`,
    html,
  });

  return { sent: true, channel: 'GMAIL_SMTP' };
}

async function sendRealSmsOtp(
  phoneInput: string,
  otp: string
): Promise<{ sent: boolean; channel: string; detail?: string }> {
  const tenDigits = extractTenDigitPhone(phoneInput);
  if (!tenDigits) {
    return { sent: false, channel: 'INVALID_PHONE' };
  }

  // Option A: Fast2SMS (Popular Indian SMS Gateway)
  const fast2SmsKey = process.env.FAST2SMS_API_KEY;
  if (fast2SmsKey) {
    try {
      const resp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: fast2SmsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: `Your 5tar Coaching Manager verification OTP is ${otp}. Valid for 10 minutes.`,
          language: 'english',
          flash: 0,
          numbers: tenDigits,
        }),
      });
      const json = (await resp.json()) as { return?: boolean; message?: string };
      if (resp.ok && json.return) {
        return { sent: true, channel: 'FAST2SMS' };
      }
      console.warn('Fast2SMS non-ok response:', json);
    } catch (err) {
      console.error('Fast2SMS error:', err);
    }
  }

  // Option B: Twilio SMS Gateway
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const toFormatted = phoneInput.trim().startsWith('+') ? phoneInput.trim() : `+91${tenDigits}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const bodyParams = new URLSearchParams({
        To: toFormatted,
        From: twilioFrom,
        Body: `Your 5tar Coaching Manager verification OTP is ${otp}. Valid for 10 minutes.`,
      });
      const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });
      if (resp.ok) {
        return { sent: true, channel: 'TWILIO_SMS' };
      }
    } catch (err) {
      console.error('Twilio SMS error:', err);
    }
  }

  return {
    sent: false,
    channel: 'SMS_GATEWAY_UNCONFIGURED',
    detail: 'FAST2SMS_API_KEY or TWILIO credentials not set in environment secrets',
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. Send OTP Endpoint (Supports Real Gmail SMTP + Real Mobile SMS + WhatsApp Direct Dispatch)
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { identifier, email, phone, purpose } = req.body as {
        identifier?: string;
        email?: string;
        phone?: string;
        purpose?: string;
      };

      const primaryIdent = (identifier || email || phone || '').trim();
      if (!primaryIdent) {
        return res.status(400).json({ error: 'कृपया ईमेल या मोबाइल नंबर दर्ज करें।' });
      }

      const key = normalizeKey(primaryIdent);
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      otpStore.set(key, {
        otp,
        identifier: primaryIdent,
        purpose: purpose || 'AUTH',
        expiresAt,
      });

      if (email && email.trim()) {
        otpStore.set(normalizeKey(email), {
          otp,
          identifier: email.trim(),
          purpose: purpose || 'AUTH',
          expiresAt,
        });
      }
      if (phone && phone.trim()) {
        otpStore.set(normalizeKey(phone), {
          otp,
          identifier: phone.trim(),
          purpose: purpose || 'AUTH',
          expiresAt,
        });
      }

      const targetEmail = (email || (primaryIdent.includes('@') ? primaryIdent : '')).trim();
      const targetPhone = (phone || (!primaryIdent.includes('@') ? primaryIdent : '')).trim();

      let emailDelivery = { sent: false, channel: 'NONE' };
      let smsDelivery = { sent: false, channel: 'NONE' };

      if (targetEmail && targetEmail.includes('@')) {
        try {
          emailDelivery = await sendRealEmailOtp(targetEmail, otp, purpose || 'Account Verification');
        } catch (err) {
          console.error('Error sending real Gmail OTP:', err);
        }
      }

      if (targetPhone && extractTenDigitPhone(targetPhone)) {
        try {
          smsDelivery = await sendRealSmsOtp(targetPhone, otp);
        } catch (err) {
          console.error('Error sending real SMS OTP:', err);
        }
      }

      const tenDigitPhone = targetPhone ? extractTenDigitPhone(targetPhone) : null;
      const whatsappOtpUrl = tenDigitPhone
        ? `https://wa.me/91${tenDigitPhone}?text=${encodeURIComponent(
            `*5tar Coaching Manager*\nआपका वेरिफिकेशन OTP है: *${otp}*\nयह 10 मिनट के लिए मान्य है।`
          )}`
        : null;

      const deliverySummary: string[] = [];
      if (emailDelivery.sent) deliverySummary.push(`असली Gmail (${targetEmail}) पर भेज दिया गया है`);
      if (smsDelivery.sent) deliverySummary.push(`मोबाइल नंबर (${targetPhone}) पर SMS भेज दिया गया है`);

      const statusMessage =
        deliverySummary.length > 0
          ? `OTP सफलतापूर्वक ${deliverySummary.join(' और ')}!`
          : `OTP (${otp}) जनरेट हो गया है। आप इसे सीधे नीचे डाल सकते हैं या "Get OTP on WhatsApp" बटन से अपने फोन पर भेज सकते हैं।`;

      return res.json({
        success: true,
        otp,
        identifier: primaryIdent,
        emailSent: emailDelivery.sent,
        smsSent: smsDelivery.sent,
        whatsappOtpUrl,
        message: statusMessage,
      });
    } catch (error) {
      console.error('Error in /api/auth/send-otp:', error);
      return res.status(500).json({ error: 'OTP भेजने में त्रुटि हुई।' });
    }
  });

  // 2. Verify OTP & Create/Update Account (Self-Contained, Does NOT fail with Identity Toolkit 403)
  app.post('/api/auth/verify-otp-and-create-account', async (req, res) => {
    try {
      const { identifier, otp, authEmail, password, displayName } = req.body as {
        identifier?: string;
        otp?: string;
        authEmail?: string;
        password?: string;
        displayName?: string;
      };

      if (!identifier || !otp || !authEmail || !password) {
        return res.status(400).json({ error: 'सभी आवश्यक फ़ील्ड (OTP, Email, Password) भरें।' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' });
      }

      const key = normalizeKey(identifier);
      const emailKey = normalizeKey(authEmail);
      const session = otpStore.get(key) || otpStore.get(emailKey);

      if (!session || session.expiresAt < Date.now() || session.otp !== otp.trim()) {
        return res.status(400).json({ error: 'अमान्य या समाप्त हो चुका OTP। कृपया सही 6-अंकीय OTP दर्ज करें।' });
      }

      const cleanEmail = authEmail.trim().toLowerCase();
      const uid = makeDeterministicUid(cleanEmail);
      const accounts = loadAccounts();

      const accountRecord: StoredAccount = {
        uid,
        email: cleanEmail,
        identifier: identifier.trim(),
        passwordHash: hashPassword(password),
        displayName: displayName?.trim() || 'User',
        emailVerified: true,
        createdAt: accounts[cleanEmail]?.createdAt || new Date().toISOString(),
      };

      accounts[cleanEmail] = accountRecord;
      accounts[key] = accountRecord;
      saveAccounts(accounts);

      otpStore.delete(key);
      otpStore.delete(emailKey);

      return res.json({
        success: true,
        uid: accountRecord.uid,
        email: accountRecord.email,
        displayName: accountRecord.displayName,
        emailVerified: true,
      });
    } catch (error: unknown) {
      console.error('Error in /api/auth/verify-otp-and-create-account:', error);
      const msg = error instanceof Error ? error.message : 'Account creation failed';
      return res.status(500).json({ error: msg });
    }
  });

  // 3. Direct Password Login Endpoint (Works for both Coaching Admin Gmail & Student Code + Mobile)
  app.post('/api/auth/login-password', async (req, res) => {
    try {
      const { authEmail, identifier, password } = req.body as {
        authEmail?: string;
        identifier?: string;
        password?: string;
      };

      if ((!authEmail && !identifier) || !password) {
        return res.status(400).json({ error: 'कृपया अपनी लॉगिन आईडी और पासवर्ड दर्ज करें।' });
      }

      const accounts = loadAccounts();
      const lookupEmail = authEmail ? normalizeKey(authEmail) : '';
      const lookupIdent = identifier ? normalizeKey(identifier) : '';

      const account = accounts[lookupEmail] || accounts[lookupIdent];
      if (!account || account.passwordHash !== hashPassword(password)) {
        return res.status(401).json({
          error:
            'ईमेल/मोबाइल या पासवर्ड गलत है। यदि आप नए हैं तो पहले "नई कोचिंग (OTP)" या "छात्र जुड़ें (OTP)" टैब से रजिस्टर करें।',
        });
      }

      return res.json({
        success: true,
        uid: account.uid,
        email: account.email,
        displayName: account.displayName,
        emailVerified: true,
      });
    } catch (error) {
      console.error('Error in /api/auth/login-password:', error);
      return res.status(500).json({ error: 'लॉगिन करने में समस्या आई।' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`5tar Coaching Manager Server running on http://localhost:${PORT}`);
  });
}

startServer();
