import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();

interface OtpSession {
  otp: string;
  identifier: string;
  purpose: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpSession>();

function normalizeKey(val: string): string {
  return val.trim().toLowerCase();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. Send OTP Endpoint (for Coaching Owner Gmail or Student Mobile/Email)
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { identifier, purpose } = req.body as {
        identifier?: string;
        purpose?: string;
      };

      if (!identifier || !identifier.trim()) {
        return res.status(400).json({ error: 'कृपया ईमेल या मोबाइल नंबर दर्ज करें।' });
      }

      const key = normalizeKey(identifier);
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      otpStore.set(key, {
        otp,
        identifier: identifier.trim(),
        purpose: purpose || 'AUTH',
        expiresAt,
      });

      // Return OTP in response for instant sandbox/preview verification alongside dispatch confirmation
      return res.json({
        success: true,
        otp,
        identifier: identifier.trim(),
        message: `OTP (${otp}) सफलतापूर्वक ${identifier.trim()} के लिए जनरेट कर दिया गया है।`,
      });
    } catch (error) {
      console.error('Error in /api/auth/send-otp:', error);
      return res.status(500).json({ error: 'OTP भेजने में त्रुटि हुई।' });
    }
  });

  // 2. Verify OTP & Provision/Update Firebase Auth User (Email + Password)
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
      const session = otpStore.get(key);

      if (!session || session.expiresAt < Date.now() || session.otp !== otp.trim()) {
        return res.status(400).json({ error: 'अमान्य या समाप्त हो चुका OTP। कृपया सही 6-अंकीय OTP दर्ज करें।' });
      }

      const cleanEmail = authEmail.trim().toLowerCase();
      let userRecord;

      try {
        const existingUser = await adminAuth.getUserByEmail(cleanEmail);
        userRecord = await adminAuth.updateUser(existingUser.uid, {
          password,
          emailVerified: true,
          displayName: displayName?.trim() || existingUser.displayName || 'User',
        });
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email: cleanEmail,
            password,
            emailVerified: true,
            displayName: displayName?.trim() || 'User',
          });
        } else {
          throw err;
        }
      }

      let customToken = '';
      try {
        customToken = await adminAuth.createCustomToken(userRecord.uid, {
          email: cleanEmail,
          email_verified: true,
        });
      } catch {
        // Custom token is optional if signInWithEmailAndPassword is used
      }

      otpStore.delete(key);

      return res.json({
        success: true,
        uid: userRecord.uid,
        email: userRecord.email,
        customToken,
      });
    } catch (error: unknown) {
      console.error('Error in /api/auth/verify-otp-and-create-account:', error);
      const msg = error instanceof Error ? error.message : 'Account creation failed';
      return res.status(500).json({ error: msg });
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
