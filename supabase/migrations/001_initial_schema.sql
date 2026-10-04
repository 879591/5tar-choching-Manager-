-- ============================================================================
-- 5tar Coaching Manager — Complete Multi-Tenant PostgreSQL / Supabase Migration
-- Includes: Tables, Foreign Keys, Indexes, Constraints, RLS, and RLS Policies
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. INSTITUTES
CREATE TABLE IF NOT EXISTS public.institutes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  logo_url VARCHAR(500) DEFAULT '',
  address VARCHAR(300) DEFAULT '',
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(120) DEFAULT '',
  website VARCHAR(200) DEFAULT '',
  owner_name VARCHAR(100) NOT NULL,
  owner_uid VARCHAR(128) NOT NULL,
  primary_color VARCHAR(20) NOT NULL DEFAULT '#0f172a',
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id VARCHAR(128) UNIQUE NOT NULL,
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) DEFAULT '',
  email VARCHAR(120) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'STUDENT')),
  avatar_url VARCHAR(500) DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  linked_student_id UUID,
  linked_teacher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TEACHERS
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(120) NOT NULL,
  qualification VARCHAR(120) DEFAULT '',
  subject VARCHAR(100) NOT NULL,
  photo_url VARCHAR(500) DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BATCHES
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  course VARCHAR(100) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  start_date DATE,
  timing VARCHAR(80) NOT NULL,
  room VARCHAR(50) DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  admission_number VARCHAR(50) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  father_name VARCHAR(100) DEFAULT '',
  mother_name VARCHAR(100) DEFAULT '',
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(120) DEFAULT '',
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other')),
  address VARCHAR(300) DEFAULT '',
  photo_url VARCHAR(500) DEFAULT '',
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institute_id, admission_number)
);

-- 6. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave')),
  marked_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institute_id, student_id, batch_id, attendance_date)
);

-- 7. FEES
CREATE TABLE IF NOT EXISTS public.fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Other')),
  receipt_number VARCHAR(50) NOT NULL,
  month VARCHAR(50) NOT NULL,
  remarks VARCHAR(250) DEFAULT '',
  collected_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institute_id, receipt_number)
);

-- 8. FEE PLANS
CREATE TABLE IF NOT EXISTS public.fee_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  total_fee NUMERIC(10, 2) NOT NULL CHECK (total_fee >= 0),
  installment_amount NUMERIC(10, 2) NOT NULL CHECK (installment_amount >= 0),
  due_date VARCHAR(20) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institute_id, batch_id)
);

-- 9. TESTS
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  test_date DATE NOT NULL,
  total_marks NUMERIC(6, 2) NOT NULL CHECK (total_marks > 0),
  passing_marks NUMERIC(6, 2) NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= total_marks),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. MARKS
CREATE TABLE IF NOT EXISTS public.marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks NUMERIC(6, 2) NOT NULL CHECK (marks >= 0),
  remarks VARCHAR(250) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institute_id, test_id, student_id)
);

-- 11. NOTICES
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  target_role VARCHAR(20) NOT NULL CHECK (target_role IN ('Everyone', 'Students', 'Teachers')),
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('FREE', 'BASIC', 'PRO', 'PREMIUM')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('Active', 'Expired', 'Suspended')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL,
  user_name VARCHAR(100) DEFAULT '',
  action VARCHAR(150) NOT NULL,
  record_type VARCHAR(50) NOT NULL,
  record_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_institute ON public.profiles(institute_id);
CREATE INDEX IF NOT EXISTS idx_students_institute ON public.students(institute_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON public.students(batch_id);
CREATE INDEX IF NOT EXISTS idx_teachers_institute ON public.teachers(institute_id);
CREATE INDEX IF NOT EXISTS idx_batches_institute ON public.batches(institute_id);
CREATE INDEX IF NOT EXISTS idx_attendance_institute_date ON public.attendance(institute_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_fees_institute_student ON public.fees(institute_id, student_id);
CREATE INDEX IF NOT EXISTS idx_tests_institute_batch ON public.tests(institute_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_marks_institute_test ON public.marks(institute_id, test_id);
CREATE INDEX IF NOT EXISTS idx_notices_institute ON public.notices(institute_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_institute ON public.audit_logs(institute_id);

-- ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_user_institute_id()
RETURNS UUID AS $$
  SELECT institute_id FROM public.profiles WHERE auth_user_id = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
  SELECT role FROM public.profiles WHERE auth_user_id = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- TENANT ISOLATION RLS POLICIES
CREATE POLICY "Tenant isolation for institutes" ON public.institutes
  FOR ALL USING (id = public.current_user_institute_id() OR public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Tenant isolation for profiles" ON public.profiles
  FOR ALL USING (institute_id = public.current_user_institute_id() OR auth_user_id = auth.uid()::text OR public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Tenant isolation for students" ON public.students
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for teachers" ON public.teachers
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for batches" ON public.batches
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for attendance" ON public.attendance
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for fees" ON public.fees
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for fee_plans" ON public.fee_plans
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for tests" ON public.tests
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for marks" ON public.marks
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for notices" ON public.notices
  FOR ALL USING (institute_id = public.current_user_institute_id());

CREATE POLICY "Tenant isolation for subscriptions" ON public.subscriptions
  FOR ALL USING (institute_id = public.current_user_institute_id() OR public.current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "Tenant isolation for audit_logs" ON public.audit_logs
  FOR ALL USING (institute_id = public.current_user_institute_id() OR public.current_user_role() = 'SUPER_ADMIN');
