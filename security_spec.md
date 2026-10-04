# Security Specification — 5tar Coaching Manager

## 1. Data Invariants
1. **Tenant Isolation Invariant**: Every record in `students`, `teachers`, `batches`, `attendance`, `fees`, `fee_plans`, `tests`, `marks`, `notices`, `subscriptions`, and `audit_logs` MUST contain a valid `institute_id` matching the authenticated user's profile `institute_id` (unless the user is a verified `SUPER_ADMIN` accessing platform-level `institutes` or `subscriptions`).
2. **Role-Based Access Control (RBAC)**:
   - `SUPER_ADMIN`: Platform owner (`miss359010@gmail.com` with `email_verified == true` or profile with `role == 'SUPER_ADMIN'`). Can create/manage `institutes` and `subscriptions`. Does not read student personal records across random institutes unless explicitly switching context as institute owner.
   - `INSTITUTE_ADMIN`: Can create, read, update, and delete records belonging to their `institute_id`.
   - `TEACHER`: Can read institute batches, students, tests, notices; can create/update `attendance`, `tests`, and `marks` within their `institute_id`. Cannot write to `fees`, `fee_plans`, `teachers`, or `institutes`.
   - `STUDENT`: Read-only access to their institute's `batches`, `tests`, `notices`, and their own `students`, `attendance`, `fees`, and `marks` records within their `institute_id`.
3. **Strict Schema & Volumetric Validation**: Every string field enforces `.size() <= MAX` and every write validates exact allowed keys via `.keys().hasAll(...)` and `.keys().hasOnly(...)`.

## 2. The "Dirty Dozen" Payloads
1. **Cross-Tenant Student Read**: User from `inst_A` attempts to read `/students/std_1` belonging to `inst_B`.
2. **Shadow Field Injection on Student Create**: Payload includes `{ ..., "isAdmin": true }`.
3. **Unverified Email Admin Spoof**: Token has `email == 'miss359010@gmail.com'` but `email_verified == false`.
4. **Student Privilege Escalation**: Student attempts to update their `/profiles/{uid}` role from `STUDENT` to `INSTITUTE_ADMIN`.
5. **Teacher Financial Tampering**: Teacher attempts to create or modify a document in `/fees/{feeId}`.
6. **ID Poisoning Attack**: Document ID contains 300 characters or special regex-breaking symbols.
7. **Denial of Wallet Oversized String**: `notice.message` exceeds 1500 characters (e.g., 50,000 chars).
8. **Negative Fee Injection**: Admin attempts to create a fee receipt with `amount: -500`.
9. **Marks Exceeding Total Limit**: Teacher attempts to enter `marks: -10` or invalid type `'A+'`.
10. **Immutable Field Mutation**: Admin attempts to change `institute_id` or `created_at` on an existing student record during update.
11. **Unbounded List Query**: Authenticated user executes an unfiltered `list` query on `/students` without restricting `institute_id`.
12. **Orphaned Attendance Record**: User attempts to create attendance for a non-existent `institute_id`.
