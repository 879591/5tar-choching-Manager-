# 🎓 5tar Coaching Manager

**5tar Coaching Manager** is a production-ready, mobile-first, multi-tenant Coaching Management Software designed for small and medium-sized coaching institutes in India. It also supports one-click **PWA App Installation ("Download App")** on Android, iOS, and Desktop devices.

---

## 1. Project Overview

Each coaching institute operates as an isolated tenant (`institute_id`) with its own branding (name, logo, address, helpline, primary theme color), students, batches, faculty, daily attendance, fee receipts, test results, notices, and audit logs.

---

## 2. Features

- **Multi-Tenant Isolation**: Every table/collection enforces `institute_id` isolation via server-side security rules (`firestore.rules` + PostgreSQL RLS migration in `supabase/migrations/001_initial_schema.sql`).
- **Role-Based Access Control (RBAC)**:
  - **Super Admin**: Create institutes, suspend/activate tenants, manage SaaS subscriptions (`FREE`, `BASIC`, `PRO`, `PREMIUM`), and switch active tenant workspaces.
  - **Institute Admin**: Full coaching management (students, teachers, batches, fees, receipts, attendance, tests, results, notices, ID cards, reports, and custom branding).
  - **Teacher**: View assigned batches & students, mark attendance, create tests, and enter validated marks (`marks <= total_marks`). Financial settings are restricted.
  - **Student**: Mobile-friendly portal to view profile, attendance percentage, fee receipts, test results, notices, and download/print Student ID Card.
- **Printable A4 / Thermal Fee Receipts**: Auto-numbered receipts (`REC-2026-00001`) with institute logo, student details, payment method (`Cash`, `UPI`, `Bank Transfer`, `Other`), and authorized signature block.
- **Printable Student ID Cards & Report Cards**: Branded identity cards and cumulative test result cards with automatic percentage and Pass/Fail calculation.
- **Installable App (PWA)**: Built-in service worker, manifest, and in-app **Download App** button for offline-capable mobile & desktop installation.

---

## 3. Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **PWA / App Download**: `vite-plugin-pwa`, Web App Manifest, Service Worker Caching
- **Cloud Database & Auth (Active Runtime)**: Firebase Authentication (Google Sign-In) + Cloud Firestore with strict zero-trust `firestore.rules`
- **PostgreSQL / Supabase SQL Migration**: Complete SQL schema, indexes, foreign keys, and Row-Level Security (RLS) policies provided in `supabase/migrations/001_initial_schema.sql`

---

## 4. Database Setup (Supabase / PostgreSQL & Cloud Firestore)

### A. Cloud Firestore (Pre-configured in AI Studio)
- Provisioned automatically via `firebase-applet-config.json`.
- Security rules are defined in `firestore.rules` and validated via `@firebase/eslint-plugin-security-rules`.

### B. Supabase / PostgreSQL Setup (For External Deployment)
1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Copy and run the entire contents of `supabase/migrations/001_initial_schema.sql`.
4. This initializes all 13 tables (`institutes`, `profiles`, `students`, `teachers`, `batches`, `attendance`, `fees`, `fee_plans`, `tests`, `marks`, `notices`, `subscriptions`, `audit_logs`), foreign keys, indexes, and tenant-isolating RLS policies.

---

## 5. Environment Variables

Copy `.env.example` to `.env` for local development:

```env
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

Never expose secret service-role keys in frontend code.

---

## 6. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server on port 3000
npm run dev

# 3. Type-check and build for production
npm run lint
npm run build
```

---

## 7. Vercel Deployment

1. Push this repository to GitHub / GitLab.
2. Import the project into **Vercel**.
3. Set the Framework Preset to **Vite**.
4. Build Command: `npm run build` | Output Directory: `dist`.
5. Add your environment variables in the Vercel dashboard and click **Deploy**.

---

## 8. Creating First Admin & First Institute

1. Open the application and click **Continue with Google Account** on the login page.
2. On first sign-in, the **Set Up Your Coaching Institute** screen appears automatically.
3. Enter your **Coaching Institute Name**, **Director/Owner Name**, **Phone Number**, **Address**, and pick your **Brand Color**.
4. Keep **"Include Demo Sample Data"** checked if you want sample teachers, batches, students, attendance, and fee receipts pre-loaded.
5. Click **Create Coaching Institute & Launch Dashboard**.

---

## 9. Testing Roles & Multi-Tenant Isolation

- **Role Switching**: Use the **Active Portal Role View** selector in the sidebar (or top header) to test how the application behaves for **Institute Admin**, **Teacher**, **Student**, and **Super Admin**.
- **Multi-Tenant Isolation**: Open the **Super Admin** role view, click **Create New Coaching Tenant** to create a second coaching institute ("Institute B"), and use **Switch Tenant** to verify that Institute A and Institute B have completely separate students, batches, fees, and branding.

---

## 10. Production Security Checklist

- [x] Every tenant collection requires and validates `institute_id`.
- [x] All write operations validate schema keys, field lengths, and numeric bounds server-side.
- [x] Teachers are blocked from modifying fees, fee plans, or institute settings.
- [x] Students have read-only access to their own institute records.
- [x] Duplicate attendance records for the same student, batch, and date are prevented deterministically.
- [x] Audit logs cannot be modified or deleted by client users (`allow update, delete: if false;`).
