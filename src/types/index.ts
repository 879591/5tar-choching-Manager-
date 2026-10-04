export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  INSTITUTE_ADMIN = 'INSTITUTE_ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Institute {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  owner_name: string;
  owner_uid: string;
  primary_color: string;
  status: 'Active' | 'Suspended';
  created_at: string;
}

export interface Profile {
  id: string;
  auth_user_id: string;
  institute_id: string;
  full_name: string;
  phone?: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  status: 'Active' | 'Inactive';
  linked_student_id?: string;
  linked_teacher_id?: string;
  created_at: string;
}

export interface Student {
  id: string;
  institute_id: string;
  admission_number: string;
  full_name: string;
  father_name?: string;
  mother_name?: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  address?: string;
  photo_url?: string;
  admission_date?: string;
  batch_id: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}

export interface Teacher {
  id: string;
  institute_id: string;
  name: string;
  phone: string;
  email: string;
  qualification?: string;
  subject: string;
  photo_url?: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}

export interface Batch {
  id: string;
  institute_id: string;
  name: string;
  course: string;
  subject: string;
  teacher_id?: string;
  start_date?: string;
  timing: string;
  room?: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

export interface Attendance {
  id: string;
  institute_id: string;
  student_id: string;
  batch_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  marked_by: string;
  created_at: string;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';

export interface Fee {
  id: string;
  institute_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  receipt_number: string;
  month: string;
  remarks?: string;
  collected_by: string;
  created_at: string;
}

export interface FeePlan {
  id: string;
  institute_id: string;
  batch_id: string;
  total_fee: number;
  installment_amount: number;
  due_date?: string;
  created_at: string;
}

export interface Test {
  id: string;
  institute_id: string;
  batch_id: string;
  title: string;
  subject: string;
  test_date: string;
  total_marks: number;
  passing_marks: number;
  created_at: string;
}

export interface Mark {
  id: string;
  institute_id: string;
  test_id: string;
  student_id: string;
  marks: number;
  remarks?: string;
  created_at: string;
}

export interface Notice {
  id: string;
  institute_id: string;
  title: string;
  message: string;
  target_role: 'Everyone' | 'Students' | 'Teachers';
  publish_date: string;
  created_at: string;
}

export type SubscriptionPlan = 'FREE' | 'BASIC' | 'PRO' | 'PREMIUM';

export interface Subscription {
  id: string;
  institute_id: string;
  plan: SubscriptionPlan;
  status: 'Active' | 'Expired' | 'Suspended';
  start_date: string;
  expiry_date: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  institute_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  record_type: string;
  record_id: string;
  created_at: string;
}
